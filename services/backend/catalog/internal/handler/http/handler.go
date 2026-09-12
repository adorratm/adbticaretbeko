package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/adbticaret/adbticaretbeko/services/backend/catalog/internal/media"
	"github.com/adbticaret/adbticaretbeko/services/backend/catalog/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/authjwt"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
)

type Handler struct {
	Store     *store.Store
	Media     *media.Client
	JWTSecret string
	AppEnv    string
}

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	q := r.URL.Query().Get("q")
	category := r.URL.Query().Get("category")
	items, err := h.Store.SearchProducts(r.Context(), q, category)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "ürün listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "q": q, "category": category})
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	slug := r.PathValue("slug")
	p, err := h.Store.GetBySlug(r.Context(), slug)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "ürün okuma hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	var p store.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	if p.SKU == "" || p.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "sku ve name gerekli", rid)
		return
	}
	created, err := h.Store.CreateProduct(r.Context(), p)
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflict", "sku veya slug çakışması", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "ürün oluşturulamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, created)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	var p store.Product
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	updated, err := h.Store.UpdateProduct(r.Context(), id, p)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
		return
	}
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflict", "sku veya slug çakışması", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "ürün güncellenemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	if err := h.Store.DeleteProduct(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "ürün silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (h *Handler) ListProductImages(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	id := r.PathValue("id")
	items, err := h.Store.ListImages(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "görsel listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) AddProductImage(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/form-data") {
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "multipart parse hatası", rid)
			return
		}
		file, hdr, err := r.FormFile("file")
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "file gerekli", rid)
			return
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "dosya okunamadı", rid)
			return
		}
		if h.Media == nil || !h.Media.Enabled() {
			httpx.WriteError(w, http.StatusServiceUnavailable, "storage_unavailable", "MinIO/S3 yapılandırılmadı — URL ile ekleyin", rid)
			return
		}
		ctype := hdr.Header.Get("Content-Type")
		if ctype == "" {
			ctype = "application/octet-stream"
		}
		url, err := h.Media.UploadBytes(r.Context(), id, hdr.Filename, data, ctype)
		if err != nil {
			httpx.WriteError(w, http.StatusBadGateway, "storage_error", err.Error(), rid)
			return
		}
		alt := r.FormValue("alt")
		sortOrder, _ := strconv.Atoi(r.FormValue("sortOrder"))
		img, err := h.Store.AddImage(r.Context(), id, url, alt, sortOrder)
		if errors.Is(err, store.ErrNotFound) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
			return
		}
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "görsel kaydı hatası", rid)
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, img)
		return
	}
	var body struct {
		URL       string `json:"url"`
		Alt       string `json:"alt"`
		SortOrder int    `json:"sortOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "url gerekli", rid)
		return
	}
	img, err := h.Store.AddImage(r.Context(), id, body.URL, body.Alt, body.SortOrder)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "görsel kaydı hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, img)
}

func (h *Handler) DeleteProductImage(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	imageID := r.PathValue("imageId")
	if err := h.Store.DeleteImage(r.Context(), imageID); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "görsel bulunamadı", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "görsel silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) ListBrands(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	items, err := h.Store.ListBrands(r.Context())
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "marka listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "name gerekli", rid)
		return
	}
	b, err := h.Store.CreateBrand(r.Context(), body.Name)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "marka oluşturulamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, b)
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	activeOnly := r.URL.Query().Get("all") != "1"
	items, err := h.Store.ListCategories(r.Context(), activeOnly)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "kategori listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	var body store.Category
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "name gerekli", rid)
		return
	}
	if body.Slug == "" {
		body.Slug = ""
	}
	body.Active = true
	if body.SortOrder == 0 {
		body.SortOrder = 100
	}
	c, err := h.Store.UpsertCategoryMeta(r.Context(), body)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "kategori oluşturulamadı", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, c)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	var body store.Category
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "name gerekli", rid)
		return
	}
	c, err := h.Store.UpdateCategory(r.Context(), id, body)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "kategori bulunamadı", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "kategori güncellenemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	if err := h.Store.DeleteCategory(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "kategori bulunamadı", rid)
		return
	} else if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflict", "kategoriye bağlı ürün var", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "kategori silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (h *Handler) ListProductVariants(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	id := r.PathValue("id")
	items, err := h.Store.ListVariants(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "varyant listesi hatası", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) UpsertProductVariant(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	var body store.ProductVariant
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "geçersiz gövde", rid)
		return
	}
	v, err := h.Store.UpsertVariant(r.Context(), id, body)
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "ürün bulunamadı", rid)
		return
	}
	if errors.Is(err, store.ErrConflict) {
		httpx.WriteError(w, http.StatusConflict, "conflict", "SKU zaten var", rid)
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", err.Error(), rid)
		return
	}
	status := http.StatusCreated
	if body.ID != "" {
		status = http.StatusOK
	}
	httpx.WriteJSON(w, status, v)
}

func (h *Handler) DeleteProductVariant(w http.ResponseWriter, r *http.Request) {
	rid := httpx.RequestIDFromContext(r.Context())
	if !h.requireAdmin(r) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "admin yetkisi gerekli", rid)
		return
	}
	id := r.PathValue("id")
	vid := r.PathValue("variantId")
	if err := h.Store.DeleteVariant(r.Context(), id, vid); errors.Is(err, store.ErrNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "varyant bulunamadı", rid)
		return
	} else if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "varyant silinemedi", rid)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) requireAdmin(r *http.Request) bool {
	// Development convenience for Phase 1 local seeding.
	if r.Header.Get("X-Dev-Admin") == "1" {
		return true
	}
	if h.AppEnv == "development" || h.AppEnv == "dev" || h.AppEnv == "" {
		return true
	}

	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	claims, err := authjwt.ParseAccessToken(h.JWTSecret, strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return false
	}
	for _, role := range claims.Roles {
		if role == "ADMIN" || role == "SUPER_ADMIN" || role == "CATALOG_MANAGER" {
			return true
		}
	}
	return false
}
