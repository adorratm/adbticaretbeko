package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/adbticaret/adbticaretbeko/services/backend/customer/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/authjwt"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
)

type Handler struct {
	Store     *store.Store
	JWTSecret string
}

func (h *Handler) Ensure(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	var body struct {
		Email     string `json:"email"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Email == "" {
		body.Email = claims.Email
	}
	if body.FirstName == "" {
		body.FirstName = "Müşteri"
	}
	if body.LastName == "" {
		body.LastName = "-"
	}
	c, err := h.Store.UpsertFromAuth(r.Context(), claims.UserID, body.Email, body.FirstName, body.LastName)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "profil oluşturulamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	c, err := h.Store.GetByUserID(r.Context(), claims.UserID)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "müşteri profili yok", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "okuma hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	var body struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Phone     string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	c, err := h.Store.UpdateProfile(r.Context(), claims.UserID, body.FirstName, body.LastName, body.Phone)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "güncelleme hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (h *Handler) ListAddresses(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	c, err := h.Store.GetByUserID(r.Context(), claims.UserID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "müşteri yok", rid)
		return
	}
	items, err := h.Store.ListAddresses(r.Context(), c.ID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "adres listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateAddress(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	c, err := h.Store.GetByUserID(r.Context(), claims.UserID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "müşteri yok", rid)
		return
	}
	var a store.Address
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	if a.Title == "" || a.Line1 == "" || a.City == "" || a.District == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "title/line1/city/district gerekli", rid)
		return
	}
	created, err := h.Store.CreateAddress(r.Context(), c.ID, a)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "adres kaydı hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, created)
}

func (h *Handler) UpdateAddress(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	c, err := h.Store.GetByUserID(r.Context(), claims.UserID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "müşteri yok", rid)
		return
	}
	addressID := r.PathValue("addressId")
	if addressID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "addressId gerekli", rid)
		return
	}
	var a store.Address
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	if a.Title == "" || a.Line1 == "" || a.City == "" || a.District == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "title/line1/city/district gerekli", rid)
		return
	}
	updated, err := h.Store.UpdateAddress(r.Context(), c.ID, addressID, a)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "adres bulunamadı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "adres güncellenemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

func (h *Handler) DeleteAddress(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	claims, ok := h.claims(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "token gerekli", rid)
		return
	}
	c, err := h.Store.GetByUserID(r.Context(), claims.UserID)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "müşteri yok", rid)
		return
	}
	addressID := r.PathValue("addressId")
	if addressID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "addressId gerekli", rid)
		return
	}
	if err := h.Store.DeleteAddress(r.Context(), c.ID, addressID); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "adres bulunamadı", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "adres silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) claims(r *http.Request) (*authjwt.Claims, bool) {
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
