package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("conflict")
var ErrInvalidCredentials = errors.New("invalid credentials")

type User struct {
	ID           string
	Email        string
	PasswordHash string
	FirstName    string
	LastName     string
	Roles        []string
}

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY['CUSTOMER']::TEXT[],
    google_sub TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS allowed_admins (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
	return err
}

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Store) CreateUser(ctx context.Context, email, password, firstName, lastName string, roles []string) (*User, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	_, err = s.db.Exec(ctx, `
INSERT INTO users (id, email, password_hash, first_name, last_name, roles)
VALUES ($1, lower($2), $3, $4, $5, $6)
`, id, email, hash, firstName, lastName, roles)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return &User{ID: id, Email: email, PasswordHash: hash, FirstName: firstName, LastName: lastName, Roles: roles}, nil
}

func (s *Store) Authenticate(ctx context.Context, email, password string) (*User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles
FROM users WHERE email = lower($1)
`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	if u.PasswordHash == "" || !CheckPassword(u.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}
	return &u, nil
}

func (s *Store) GetByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles
FROM users WHERE id = $1
`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) SaveRefreshToken(ctx context.Context, userID, rawToken string, expiresAt time.Time) error {
	_, err := s.db.Exec(ctx, `
INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
`, uuid.NewString(), userID, HashToken(rawToken), expiresAt)
	return err
}

func (s *Store) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	_, err := s.db.Exec(ctx, `
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE token_hash = $1 AND revoked_at IS NULL
`, HashToken(rawToken))
	return err
}

func (s *Store) ValidateRefreshToken(ctx context.Context, rawToken string) (string, error) {
	var userID string
	err := s.db.QueryRow(ctx, `
SELECT user_id FROM refresh_tokens
WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
`, HashToken(rawToken)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return userID, err
}

func (s *Store) UpsertGoogleUser(ctx context.Context, googleSub, email, firstName, lastName string, roles []string) (*User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	err := s.db.QueryRow(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles
FROM users WHERE google_sub = $1 OR email = lower($2)
LIMIT 1
`, googleSub, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles)
	if err == nil {
		_, _ = s.db.Exec(ctx, `
UPDATE users SET google_sub = $2, first_name = COALESCE(NULLIF($3,''), first_name),
  last_name = COALESCE(NULLIF($4,''), last_name), updated_at = NOW()
WHERE id = $1
`, u.ID, googleSub, firstName, lastName)
		if len(roles) > 0 {
			_, _ = s.db.Exec(ctx, `UPDATE users SET roles = $2 WHERE id = $1`, u.ID, roles)
			u.Roles = roles
		}
		u.Email = email
		if firstName != "" {
			u.FirstName = firstName
		}
		if lastName != "" {
			u.LastName = lastName
		}
		return &u, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if roles == nil {
		roles = []string{"CUSTOMER"}
	}
	id := uuid.NewString()
	_, err = s.db.Exec(ctx, `
INSERT INTO users (id, email, password_hash, first_name, last_name, roles, google_sub)
VALUES ($1, lower($2), '', $3, $4, $5, $6)
`, id, email, firstName, lastName, roles, googleSub)
	if err != nil {
		return nil, err
	}
	return &User{ID: id, Email: email, FirstName: firstName, LastName: lastName, Roles: roles}, nil
}

type AllowedAdmin struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedBy string `json:"createdBy,omitempty"`
	CreatedAt string `json:"createdAt,omitempty"`
}

func (s *Store) IsAllowedAdmin(ctx context.Context, email string) (string, bool, error) {
	var role string
	err := s.db.QueryRow(ctx, `SELECT role FROM allowed_admins WHERE email = lower($1)`, email).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return role, true, nil
}

func (s *Store) SeedAllowedAdmins(ctx context.Context, emails []string) error {
	for _, e := range emails {
		e = strings.ToLower(strings.TrimSpace(e))
		if e == "" {
			continue
		}
		_, err := s.db.Exec(ctx, `
INSERT INTO allowed_admins (id, email, role, created_by)
VALUES ($1, $2, 'SUPER_ADMIN', 'env-seed')
ON CONFLICT (email) DO NOTHING
`, uuid.NewString(), e)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) ListAllowedAdmins(ctx context.Context) ([]AllowedAdmin, error) {
	rows, err := s.db.Query(ctx, `
SELECT id, email, role, COALESCE(created_by,''), created_at::text
FROM allowed_admins ORDER BY created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AllowedAdmin
	for rows.Next() {
		var a AllowedAdmin
		if err := rows.Scan(&a.ID, &a.Email, &a.Role, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if out == nil {
		out = []AllowedAdmin{}
	}
	return out, rows.Err()
}

func (s *Store) AddAllowedAdmin(ctx context.Context, email, role, createdBy string) (*AllowedAdmin, error) {
	if role == "" {
		role = "ADMIN"
	}
	a := AllowedAdmin{ID: uuid.NewString(), Email: strings.ToLower(strings.TrimSpace(email)), Role: role, CreatedBy: createdBy}
	_, err := s.db.Exec(ctx, `
INSERT INTO allowed_admins (id, email, role, created_by) VALUES ($1,$2,$3,$4)
`, a.ID, a.Email, a.Role, nullEmpty(a.CreatedBy))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return &a, nil
}

func (s *Store) RemoveAllowedAdmin(ctx context.Context, id string) error {
	ct, err := s.db.Exec(ctx, `DELETE FROM allowed_admins WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) GetByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.db.QueryRow(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles
FROM users WHERE email = lower($1)
`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) CreatePasswordResetToken(ctx context.Context, userID, rawToken string, expiresAt time.Time) error {
	_, _ = s.db.Exec(ctx, `
UPDATE password_reset_tokens SET used_at = NOW()
WHERE user_id = $1 AND used_at IS NULL
`, userID)
	_, err := s.db.Exec(ctx, `
INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
`, uuid.NewString(), userID, HashToken(rawToken), expiresAt)
	return err
}

func (s *Store) ConsumePasswordResetToken(ctx context.Context, rawToken string) (string, error) {
	var userID string
	var id string
	err := s.db.QueryRow(ctx, `
SELECT id, user_id FROM password_reset_tokens
WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
`, HashToken(rawToken)).Scan(&id, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(ctx, `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, id)
	if err != nil {
		return "", err
	}
	return userID, nil
}

func (s *Store) UpdatePassword(ctx context.Context, userID, password string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	ct, err := s.db.Exec(ctx, `
UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1
`, userID, hash)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx, `
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE user_id = $1 AND revoked_at IS NULL
`, userID)
	return err
}

func (s *Store) ListUsers(ctx context.Context, limit int) ([]User, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles
FROM users ORDER BY created_at DESC LIMIT $1
`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	if out == nil {
		out = []User{}
	}
	return out, rows.Err()
}

func (s *Store) UpdateUser(ctx context.Context, id, firstName, lastName string, roles []string) (*User, error) {
	if roles == nil {
		roles = []string{"CUSTOMER"}
	}
	tag, err := s.db.Exec(ctx, `
UPDATE users SET first_name=$2, last_name=$3, roles=$4 WHERE id=$1
`, id, firstName, lastName, roles)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	var u User
	err = s.db.QueryRow(ctx, `
SELECT id, email, password_hash, first_name, last_name, roles FROM users WHERE id=$1
`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FirstName, &u.LastName, &u.Roles)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) DeleteUser(ctx context.Context, id string) error {
	_, _ = s.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id=$1`, id)
	tag, err := s.db.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func nullEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func isUniqueViolation(err error) bool {
	return err != nil && (contains(err.Error(), "duplicate key") || contains(err.Error(), "unique constraint"))
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
