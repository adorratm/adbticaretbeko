package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Coupon struct {
	ID             string     `json:"id"`
	Code           string     `json:"code"`
	Title          string     `json:"title"`
	Description    string     `json:"description,omitempty"`
	Type           string     `json:"type"` // percent | fixed
	Value          int64      `json:"value"`
	MinSubtotal    int64      `json:"minSubtotal"`
	MaxDiscount    int64      `json:"maxDiscount"`
	UsageLimit     int        `json:"usageLimit"`
	UsedCount      int        `json:"usedCount"`
	Active         bool       `json:"active"`
	StartsAt       *time.Time `json:"startsAt,omitempty"`
	EndsAt         *time.Time `json:"endsAt,omitempty"`
}

func main() {
	log := logging.New("promotion")
	addr := config.Getenv("HTTP_ADDR", ":8086")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS promotion`)
		_, err := conn.Exec(ctx, `SET search_path TO promotion`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  value_kurus BIGINT NOT NULL,
  min_subtotal BIGINT NOT NULL DEFAULT 0,
  max_discount BIGINT NOT NULL DEFAULT 0,
  usage_limit INT NOT NULL DEFAULT 0,
  used_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'İncele',
  cta_href TEXT NOT NULL DEFAULT '/kampanyalar',
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  show_modal BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)
	seedDemo(ctx, pool)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())

	mux.HandleFunc("GET /v1/promotions/coupons", func(w http.ResponseWriter, r *http.Request) {
		items, err := listCoupons(r.Context(), pool, r.URL.Query().Get("active") == "1")
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /v1/promotions/coupons", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body Coupon
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		body.Code = strings.ToUpper(strings.TrimSpace(body.Code))
		if body.Code == "" || body.Title == "" || (body.Type != "percent" && body.Type != "fixed") || body.Value <= 0 {
			httpx.WriteError(w, 400, "validation_error", "code/title/type/value gerekli", rid)
			return
		}
		body.ID = uuid.NewString()
		body.Active = true
		_, err := pool.Exec(r.Context(), `
INSERT INTO coupons (id, code, title, description, type, value_kurus, min_subtotal, max_discount, usage_limit, active, starts_at, ends_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
`, body.ID, body.Code, body.Title, nullEmpty(body.Description), body.Type, body.Value, body.MinSubtotal, body.MaxDiscount, body.UsageLimit, body.Active, body.StartsAt, body.EndsAt)
		if err != nil {
			httpx.WriteError(w, 409, "conflict", "kupon kaydedilemedi: "+err.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 201, body)
	})

	mux.HandleFunc("PATCH /v1/promotions/coupons/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body Coupon
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		body.Code = strings.ToUpper(strings.TrimSpace(body.Code))
		if body.Code == "" || body.Title == "" || (body.Type != "percent" && body.Type != "fixed") || body.Value <= 0 {
			httpx.WriteError(w, 400, "validation_error", "code/title/type/value gerekli", rid)
			return
		}
		tag, err := pool.Exec(r.Context(), `
UPDATE coupons SET code=$2, title=$3, description=$4, type=$5, value_kurus=$6,
  min_subtotal=$7, max_discount=$8, usage_limit=$9, active=$10
WHERE id=$1
`, id, body.Code, body.Title, nullEmpty(body.Description), body.Type, body.Value, body.MinSubtotal, body.MaxDiscount, body.UsageLimit, body.Active)
		if err != nil {
			httpx.WriteError(w, 409, "conflict", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "kupon bulunamadı", rid)
			return
		}
		body.ID = id
		httpx.WriteJSON(w, 200, body)
	})

	mux.HandleFunc("DELETE /v1/promotions/coupons/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		tag, err := pool.Exec(r.Context(), `DELETE FROM coupons WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "kupon bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("POST /v1/promotions/validate", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			Code     string `json:"code"`
			Subtotal int64  `json:"subtotal"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
			httpx.WriteError(w, 400, "validation_error", "code gerekli", rid)
			return
		}
		c, err := getByCode(r.Context(), pool, body.Code)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "kupon bulunamadı", rid)
			return
		}
		discount, reason, ok := evaluate(c, body.Subtotal)
		if !ok {
			httpx.WriteError(w, 400, "coupon_invalid", reason, rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"ok": true, "code": c.Code, "title": c.Title, "type": c.Type,
			"discount": discount, "subtotal": body.Subtotal, "total": body.Subtotal - discount,
		})
	})

	mux.HandleFunc("POST /v1/promotions/redeem", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		c, err := getByCode(r.Context(), pool, body.Code)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "kupon yok", rid)
			return
		}
		_, err = pool.Exec(r.Context(), `UPDATE coupons SET used_count = used_count + 1 WHERE id=$1`, c.ID)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "redeem hatası", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "code": c.Code})
	})

	type Campaign struct {
		ID         string   `json:"id"`
		Title      string   `json:"title"`
		Subtitle   string   `json:"subtitle"`
		Body       string   `json:"body"`
		ImageURL   string   `json:"imageUrl"`
		CtaLabel   string   `json:"ctaLabel"`
		CtaHref    string   `json:"ctaHref"`
		ProductIDs []string `json:"productIds"`
		ShowModal  bool     `json:"showModal"`
		Active     bool     `json:"active"`
	}

	mux.HandleFunc("GET /v1/promotions/campaigns", func(w http.ResponseWriter, r *http.Request) {
		onlyActive := r.URL.Query().Get("active") == "1"
		q := `SELECT id, title, COALESCE(subtitle,''), COALESCE(body,''), COALESCE(image_url,''), COALESCE(cta_label,''), COALESCE(cta_href,''), COALESCE(product_ids,'{}'), show_modal, active FROM campaigns`
		if onlyActive {
			q += ` WHERE active = TRUE`
		}
		q += ` ORDER BY created_at DESC`
		rows, err := pool.Query(r.Context(), q)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []Campaign{}
		for rows.Next() {
			var c Campaign
			if err := rows.Scan(&c.ID, &c.Title, &c.Subtitle, &c.Body, &c.ImageURL, &c.CtaLabel, &c.CtaHref, &c.ProductIDs, &c.ShowModal, &c.Active); err != nil {
				httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
				return
			}
			if c.ProductIDs == nil {
				c.ProductIDs = []string{}
			}
			items = append(items, c)
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /v1/promotions/campaigns", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body Campaign
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
			httpx.WriteError(w, 400, "validation_error", "title gerekli", rid)
			return
		}
		body.ID = uuid.NewString()
		body.Active = true
		if body.CtaLabel == "" {
			body.CtaLabel = "İncele"
		}
		if body.CtaHref == "" {
			body.CtaHref = "/kampanyalar"
		}
		if body.ProductIDs == nil {
			body.ProductIDs = []string{}
		}
		_, err := pool.Exec(r.Context(), `
INSERT INTO campaigns (id, title, subtitle, body, image_url, cta_label, cta_href, product_ids, show_modal, active)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, body.ID, body.Title, body.Subtitle, body.Body, body.ImageURL, body.CtaLabel, body.CtaHref, body.ProductIDs, body.ShowModal, body.Active)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 201, body)
	})

	mux.HandleFunc("PATCH /v1/promotions/campaigns/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body Campaign
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
			httpx.WriteError(w, 400, "validation_error", "title gerekli", rid)
			return
		}
		if body.ProductIDs == nil {
			body.ProductIDs = []string{}
		}
		tag, err := pool.Exec(r.Context(), `
UPDATE campaigns SET title=$2, subtitle=$3, body=$4, image_url=$5, cta_label=$6, cta_href=$7, product_ids=$8, show_modal=$9, active=$10
WHERE id=$1
`, id, body.Title, body.Subtitle, body.Body, body.ImageURL, body.CtaLabel, body.CtaHref, body.ProductIDs, body.ShowModal, body.Active)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "kampanya bulunamadı", rid)
			return
		}
		body.ID = id
		httpx.WriteJSON(w, 200, body)
	})

	mux.HandleFunc("DELETE /v1/promotions/campaigns/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		tag, err := pool.Exec(r.Context(), `DELETE FROM campaigns WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "kampanya bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func seedDemo(ctx context.Context, pool *pgxpool.Pool) {
	var n int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM coupons`).Scan(&n)
	if n == 0 {
		now := time.Now().UTC()
		end := now.AddDate(1, 0, 0)
		demos := []Coupon{
			{ID: uuid.NewString(), Code: "HOSGELDIN10", Title: "Hoş geldin %10", Type: "percent", Value: 10, MinSubtotal: 500000, MaxDiscount: 200000, UsageLimit: 0, Active: true, StartsAt: &now, EndsAt: &end},
			{ID: uuid.NewString(), Code: "BEKO500", Title: "500 TL indirim", Type: "fixed", Value: 50000, MinSubtotal: 1000000, MaxDiscount: 0, UsageLimit: 100, Active: true, StartsAt: &now, EndsAt: &end},
		}
		for _, d := range demos {
			_, _ = pool.Exec(ctx, `
INSERT INTO coupons (id, code, title, type, value_kurus, min_subtotal, max_discount, usage_limit, active, starts_at, ends_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING
`, d.ID, d.Code, d.Title, d.Type, d.Value, d.MinSubtotal, d.MaxDiscount, d.UsageLimit, d.Active, d.StartsAt, d.EndsAt)
		}
	}
	var cn int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM campaigns`).Scan(&cn)
	if cn == 0 {
		_, _ = pool.Exec(ctx, `
INSERT INTO campaigns (id, title, subtitle, body, image_url, cta_label, cta_href, product_ids, show_modal, active)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,TRUE)
`, uuid.NewString(), "15.000 TL’ye varan takas", "Beko Değişim Kampanyası",
			"Eski beyaz eşyanızı getirin, yeni Beko’da peşin indirim kazanın. Ön teklif online, onay mağazada.",
			"https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1200&q=80",
			"Takas teklifi al", "/takas", []string{})
	}
}

func listCoupons(ctx context.Context, pool *pgxpool.Pool, onlyActive bool) ([]Coupon, error) {
	q := `SELECT id, code, title, COALESCE(description,''), type, value_kurus, min_subtotal, max_discount, usage_limit, used_count, active, starts_at, ends_at FROM coupons`
	if onlyActive {
		q += ` WHERE active = TRUE`
	}
	q += ` ORDER BY created_at DESC`
	rows, err := pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Coupon{}
	for rows.Next() {
		var c Coupon
		if err := rows.Scan(&c.ID, &c.Code, &c.Title, &c.Description, &c.Type, &c.Value, &c.MinSubtotal, &c.MaxDiscount, &c.UsageLimit, &c.UsedCount, &c.Active, &c.StartsAt, &c.EndsAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func getByCode(ctx context.Context, pool *pgxpool.Pool, code string) (*Coupon, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	var c Coupon
	err := pool.QueryRow(ctx, `
SELECT id, code, title, COALESCE(description,''), type, value_kurus, min_subtotal, max_discount, usage_limit, used_count, active, starts_at, ends_at
FROM coupons WHERE code=$1
`, code).Scan(&c.ID, &c.Code, &c.Title, &c.Description, &c.Type, &c.Value, &c.MinSubtotal, &c.MaxDiscount, &c.UsageLimit, &c.UsedCount, &c.Active, &c.StartsAt, &c.EndsAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return &c, err
}

func evaluate(c *Coupon, subtotal int64) (int64, string, bool) {
	now := time.Now().UTC()
	if !c.Active {
		return 0, "kupon pasif", false
	}
	if c.StartsAt != nil && now.Before(*c.StartsAt) {
		return 0, "kupon henüz başlamadı", false
	}
	if c.EndsAt != nil && now.After(*c.EndsAt) {
		return 0, "kupon süresi doldu", false
	}
	if c.UsageLimit > 0 && c.UsedCount >= c.UsageLimit {
		return 0, "kupon kullanım limiti doldu", false
	}
	if subtotal < c.MinSubtotal {
		return 0, "minimum sepet tutarı sağlanmadı", false
	}
	var discount int64
	if c.Type == "percent" {
		discount = subtotal * c.Value / 100
		if c.MaxDiscount > 0 && discount > c.MaxDiscount {
			discount = c.MaxDiscount
		}
	} else {
		discount = c.Value
	}
	if discount > subtotal {
		discount = subtotal
	}
	if discount <= 0 {
		return 0, "indirim hesaplanamadı", false
	}
	return discount, "", true
}

func nullEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
