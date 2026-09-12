package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Customer struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Phone     string `json:"phone,omitempty"`
}

type Address struct {
	ID         string `json:"id"`
	CustomerID string `json:"customerId"`
	Title      string `json:"title"`
	Line1      string `json:"line1"`
	Line2      string `json:"line2,omitempty"`
	City       string `json:"city"`
	District   string `json:"district"`
	PostalCode string `json:"postalCode,omitempty"`
	Country    string `json:"country"`
	IsDefault  bool   `json:"isDefault"`
}

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'TR',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_consents (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,
    version TEXT NOT NULL,
    accepted BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
	return err
}

func (s *Store) UpsertFromAuth(ctx context.Context, userID, email, firstName, lastName string) (*Customer, error) {
	var c Customer
	err := s.db.QueryRow(ctx, `SELECT id, user_id, email, first_name, last_name, COALESCE(phone,'') FROM customers WHERE user_id=$1`, userID).
		Scan(&c.ID, &c.UserID, &c.Email, &c.FirstName, &c.LastName, &c.Phone)
	if err == nil {
		return &c, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	c = Customer{ID: uuid.NewString(), UserID: userID, Email: email, FirstName: firstName, LastName: lastName}
	_, err = s.db.Exec(ctx, `
INSERT INTO customers (id, user_id, email, first_name, last_name)
VALUES ($1,$2,$3,$4,$5)
`, c.ID, c.UserID, c.Email, c.FirstName, c.LastName)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) GetByUserID(ctx context.Context, userID string) (*Customer, error) {
	var c Customer
	err := s.db.QueryRow(ctx, `SELECT id, user_id, email, first_name, last_name, COALESCE(phone,'') FROM customers WHERE user_id=$1`, userID).
		Scan(&c.ID, &c.UserID, &c.Email, &c.FirstName, &c.LastName, &c.Phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (s *Store) UpdateProfile(ctx context.Context, userID, firstName, lastName, phone string) (*Customer, error) {
	_, err := s.db.Exec(ctx, `
UPDATE customers SET first_name=$2, last_name=$3, phone=$4, updated_at=NOW()
WHERE user_id=$1
`, userID, firstName, lastName, phone)
	if err != nil {
		return nil, err
	}
	return s.GetByUserID(ctx, userID)
}

func (s *Store) ListAddresses(ctx context.Context, customerID string) ([]Address, error) {
	rows, err := s.db.Query(ctx, `
SELECT id, customer_id, title, line1, COALESCE(line2,''), city, district, COALESCE(postal_code,''), country, is_default
FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC, created_at DESC
`, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Address
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.CustomerID, &a.Title, &a.Line1, &a.Line2, &a.City, &a.District, &a.PostalCode, &a.Country, &a.IsDefault); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if out == nil {
		out = []Address{}
	}
	return out, rows.Err()
}

func (s *Store) CreateAddress(ctx context.Context, customerID string, a Address) (*Address, error) {
	a.ID = uuid.NewString()
	a.CustomerID = customerID
	if a.Country == "" {
		a.Country = "TR"
	}
	_, err := s.db.Exec(ctx, `
INSERT INTO customer_addresses (id, customer_id, title, line1, line2, city, district, postal_code, country, is_default)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, a.ID, a.CustomerID, a.Title, a.Line1, nullIfEmpty(a.Line2), a.City, a.District, nullIfEmpty(a.PostalCode), a.Country, a.IsDefault)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *Store) UpdateAddress(ctx context.Context, customerID, addressID string, a Address) (*Address, error) {
	if a.Country == "" {
		a.Country = "TR"
	}
	tag, err := s.db.Exec(ctx, `
UPDATE customer_addresses
SET title=$3, line1=$4, line2=$5, city=$6, district=$7, postal_code=$8, country=$9, is_default=$10
WHERE id=$1 AND customer_id=$2
`, addressID, customerID, a.Title, a.Line1, nullIfEmpty(a.Line2), a.City, a.District, nullIfEmpty(a.PostalCode), a.Country, a.IsDefault)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	a.ID = addressID
	a.CustomerID = customerID
	return &a, nil
}

func (s *Store) DeleteAddress(ctx context.Context, customerID, addressID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM customer_addresses WHERE id=$1 AND customer_id=$2`, addressID, customerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
