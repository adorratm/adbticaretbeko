package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/services/backend/auth/internal/googleauth"
	"github.com/adbticaret/adbticaretbeko/services/backend/auth/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/authjwt"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
)

type Handler struct {
	Store            *store.Store
	JWTSecret        string
	JWTRefreshSecret string
	AccessTTL        time.Duration
	RefreshTTL       time.Duration
	GoogleClientID   string
}

type registerRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

type loginRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	Audience  string `json:"audience"` // "customer" | "admin"
}

type tokenResponse struct {
	AccessToken  string   `json:"accessToken"`
	RefreshToken string   `json:"refreshToken"`
	ExpiresIn    int64    `json:"expiresIn"`
	UserID       string   `json:"userId"`
	Email        string   `json:"email"`
	Roles        []string `json:"roles"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || len(req.Password) < 8 || req.FirstName == "" || req.LastName == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "email/password/ad/soyad gerekli", rid)
		return
	}
	user, err := h.Store.CreateUser(r.Context(), req.Email, req.Password, req.FirstName, req.LastName, []string{"CUSTOMER"})
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "email_taken", "e-posta kullanımda", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "kayıt başarısız", rid)
		return
	}
	h.writeTokens(w, r, user)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	user, err := h.Store.Authenticate(r.Context(), strings.TrimSpace(strings.ToLower(req.Email)), req.Password)
	if errors.Is(err, store.ErrInvalidCredentials) {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "e-posta veya şifre hatalı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "giriş başarısız", rid)
		return
	}
	if strings.EqualFold(strings.TrimSpace(req.Audience), "admin") {
		if !hasAnyRole(user.Roles, "ADMIN", "SUPER_ADMIN") {
			role, ok, aerr := h.Store.IsAllowedAdmin(r.Context(), user.Email)
			if aerr != nil {
				httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "allowlist okunamadı", rid)
				return
			}
			if !ok {
				httpx.WriteError(w, http.StatusForbidden, "admin_not_allowed", "bu hesap admin paneline yetkili değil", rid)
				return
			}
			if role == "" {
				role = "ADMIN"
			}
			user.Roles = []string{role}
		}
	}
	h.writeTokens(w, r, user)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claimsFromRequest(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	user, err := h.Store.GetByID(r.Context(), claims.UserID)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "kullanıcı bulunamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"id":        user.ID,
		"email":     user.Email,
		"firstName": user.FirstName,
		"lastName":  user.LastName,
		"roles":     user.Roles,
	})
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "refreshToken gerekli", rid)
		return
	}
	userID, err := h.Store.ValidateRefreshToken(r.Context(), body.RefreshToken)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_refresh", "refresh token geçersiz", rid)
		return
	}
	_ = h.Store.RevokeRefreshToken(r.Context(), body.RefreshToken)
	user, err := h.Store.GetByID(r.Context(), userID)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "kullanıcı bulunamadı", rid)
		return
	}
	h.writeTokens(w, r, user)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.RefreshToken != "" {
		_ = h.Store.RevokeRefreshToken(r.Context(), body.RefreshToken)
	}
	if claims, ok := h.claimsFromRequest(r); ok {
		_ = h.Store.RevokeAllRefreshTokens(r.Context(), claims.UserID)
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "requestId": rid})
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Email) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "email gerekli", rid)
		return
	}
	email := strings.TrimSpace(strings.ToLower(body.Email))
	resp := map[string]any{
		"ok":      true,
		"message": "Eğer hesap varsa sıfırlama bağlantısı hazırlandı.",
	}
	user, err := h.Store.GetByEmail(r.Context(), email)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, resp)
		return
	}
	raw, err := randomToken()
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "token_error", "token üretilemedi", rid)
		return
	}
	if err := h.Store.CreatePasswordResetToken(r.Context(), user.ID, raw, time.Now().UTC().Add(1*time.Hour)); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "token kaydedilemedi", rid)
		return
	}
	// Dev/local: token response'a eklenir (Mailpit entegrasyonu sonraki adım).
	resp["devResetToken"] = raw
	resp["devHint"] = "Geliştirme ortamında e-posta yerine bu token kullanılır."
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" || len(body.NewPassword) < 8 {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "token ve en az 8 karakter şifre gerekli", rid)
		return
	}
	userID, err := h.Store.ConsumePasswordResetToken(r.Context(), body.Token)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_token", "sıfırlama bağlantısı geçersiz veya süresi dolmuş", rid)
		return
	}
	if err := h.Store.UpdatePassword(r.Context(), userID, body.NewPassword); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "şifre güncellenemedi", rid)
		return
	}
	_ = h.Store.RevokeAllRefreshTokens(r.Context(), userID)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Şifre güncellendi"})
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claimsFromRequest(r)
	if !ok || !hasAnyRole(claims.Roles, "ADMIN", "SUPER_ADMIN") {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin gerekli", rid)
		return
	}
	users, err := h.Store.ListUsers(r.Context(), 100)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "liste alınamadı", rid)
		return
	}
	items := make([]map[string]any, 0, len(users))
	for _, u := range users {
		items = append(items, map[string]any{
			"id": u.ID, "email": u.Email, "firstName": u.FirstName, "lastName": u.LastName, "roles": u.Roles,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claimsFromRequest(r)
	if !ok || !hasAnyRole(claims.Roles, "ADMIN", "SUPER_ADMIN") {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin gerekli", rid)
		return
	}
	id := r.PathValue("id")
	var body struct {
		FirstName string   `json:"firstName"`
		LastName  string   `json:"lastName"`
		Roles     []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	if body.FirstName == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "firstName gerekli", rid)
		return
	}
	u, err := h.Store.UpdateUser(r.Context(), id, body.FirstName, body.LastName, body.Roles)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "kullanıcı bulunamadı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "güncelleme hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"id": u.ID, "email": u.Email, "firstName": u.FirstName, "lastName": u.LastName, "roles": u.Roles,
	})
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claimsFromRequest(r)
	if !ok || !hasAnyRole(claims.Roles, "ADMIN", "SUPER_ADMIN") {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin gerekli", rid)
		return
	}
	id := r.PathValue("id")
	if id == claims.UserID {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "kendi hesabınızı silemezsiniz", rid)
		return
	}
	if err := h.Store.DeleteUser(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "kullanıcı bulunamadı", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (h *Handler) Google(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	var body struct {
		IDToken string `json:"idToken"`
		Audience string `json:"audience"` // "customer" | "admin"
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "idToken gerekli", rid)
		return
	}
	profile, err := googleauth.VerifyIDToken(h.GoogleClientID, body.IDToken)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid_google_token", err.Error(), rid)
		return
	}

	roles := []string{"CUSTOMER"}
	audience := strings.ToLower(strings.TrimSpace(body.Audience))
	if audience == "admin" {
		role, ok, err := h.Store.IsAllowedAdmin(r.Context(), profile.Email)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "allowlist okunamadı", rid)
			return
		}
		if !ok {
			httpx.WriteError(w, http.StatusForbidden, "admin_not_allowed", "bu e-posta admin listesinde değil", rid)
			return
		}
		if role == "" {
			role = "ADMIN"
		}
		roles = []string{role}
	}

	first := profile.GivenName
	last := profile.FamilyName
	if first == "" && profile.Name != "" {
		parts := strings.Fields(profile.Name)
		first = parts[0]
		if len(parts) > 1 {
			last = strings.Join(parts[1:], " ")
		}
	}
	if first == "" {
		first = "Google"
	}
	if last == "" {
		last = "Kullanıcı"
	}

	user, err := h.Store.UpsertGoogleUser(r.Context(), profile.Sub, profile.Email, first, last, roles)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "google kullanıcı kaydı başarısız", rid)
		return
	}
	h.writeTokens(w, r, user)
}

func (h *Handler) ListAllowedAdmins(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireSuperAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "SUPER_ADMIN gerekli", rid)
		return
	}
	items, err := h.Store.ListAllowedAdmins(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "liste alınamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) AddAllowedAdmin(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claimsFromRequest(r)
	if !ok || !hasRole(claims.Roles, "SUPER_ADMIN") {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "SUPER_ADMIN gerekli", rid)
		return
	}
	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "email gerekli", rid)
		return
	}
	item, err := h.Store.AddAllowedAdmin(r.Context(), body.Email, body.Role, claims.Email)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflict", "e-posta zaten listede", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "eklenemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (h *Handler) RemoveAllowedAdmin(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireSuperAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "SUPER_ADMIN gerekli", rid)
		return
	}
	id := r.PathValue("id")
	if err := h.Store.RemoveAllowedAdmin(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "kayıt yok", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "silinemedi", rid)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) requireSuperAdmin(r *http.Request) bool {
	claims, ok := h.claimsFromRequest(r)
	if !ok {
		return false
	}
	return hasRole(claims.Roles, "SUPER_ADMIN")
}

func hasRole(roles []string, want string) bool {
	for _, r := range roles {
		if r == want {
			return true
		}
	}
	return false
}

func hasAnyRole(roles []string, wants ...string) bool {
	for _, w := range wants {
		if hasRole(roles, w) {
			return true
		}
	}
	return false
}

func (h *Handler) writeTokens(w http.ResponseWriter, r *http.Request, user *store.User) {
	rid := httpx.RequestIDFromContext(r.Context())
	access, err := authjwt.IssueAccessToken(h.JWTSecret, user.ID, user.Email, user.Roles, h.AccessTTL)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "token_error", "access token üretilemedi", rid)
		return
	}
	refresh, err := randomToken()
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "token_error", "refresh token üretilemedi", rid)
		return
	}
	if err := h.Store.SaveRefreshToken(r.Context(), user.ID, refresh, time.Now().UTC().Add(h.RefreshTTL)); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "token_error", "refresh token kaydedilemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, tokenResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(h.AccessTTL.Seconds()),
		UserID:       user.ID,
		Email:        user.Email,
		Roles:        user.Roles,
	})
}

func (h *Handler) claimsFromRequest(r *http.Request) (*authjwt.Claims, bool) {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return nil, false
	}
	claims, err := authjwt.ParseAccessToken(h.JWTSecret, strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return nil, false
	}
	return claims, true
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
