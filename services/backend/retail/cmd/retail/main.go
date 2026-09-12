package main

import (
	"context"
	"encoding/json"
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

func main() {
	log := logging.New("retail")
	addr := config.Getenv("HTTP_ADDR", ":8101")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	maxTradeIn := config.GetenvInt("TRADE_IN_MAX_KURUS", 1500000) // 15.000 TL

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS retail`)
		_, err := conn.Exec(ctx, `SET search_path TO retail`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS trade_in_offers (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  old_brand TEXT NOT NULL,
  old_model TEXT NOT NULL,
  old_condition TEXT NOT NULL,
  desired_product_sku TEXT,
  offered_kurus BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trousseau_packages (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_kurus BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trousseau_package_items (
  id UUID PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES trousseau_packages(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS storage_reservations (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  package_id UUID REFERENCES trousseau_packages(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	var pkgCount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM trousseau_packages`).Scan(&pkgCount)
	if pkgCount == 0 {
		pid := uuid.NewString()
		_, _ = pool.Exec(ctx, `
INSERT INTO trousseau_packages (id, code, name, description, price_kurus) VALUES
($1,'CEYIZ-BASIC','Çeyiz Başlangıç','Buzdolabı + çamaşır + bulaşık', 8999900)
`, pid)
		_, _ = pool.Exec(ctx, `
INSERT INTO trousseau_package_items (id, package_id, product_sku, product_name, qty) VALUES
($1,$2,'BEKO-BF-001','Beko Buzdolabı',1),
($3,$2,'BEKO-CM-001','Beko Çamaşır Makinesi',1),
($4,$2,'BEKO-BM-001','Beko Bulaşık Makinesi',1)
`, uuid.NewString(), pid, uuid.NewString(), uuid.NewString())
		pid2 := uuid.NewString()
		_, _ = pool.Exec(ctx, `
INSERT INTO trousseau_packages (id, code, name, description, price_kurus) VALUES
($1,'CEYIZ-PREMIUM','Çeyiz Premium','Beyaz eşya + fırın + ocak', 14999900)
`, pid2)
		_, _ = pool.Exec(ctx, `
INSERT INTO trousseau_package_items (id, package_id, product_sku, product_name, qty) VALUES
($1,$2,'BEKO-BF-001','Beko Buzdolabı',1),
($3,$2,'BEKO-CM-001','Beko Çamaşır Makinesi',1),
($4,$2,'BEKO-BM-001','Beko Bulaşık Makinesi',1),
($5,$2,'BEKO-FR-001','Beko Fırın',1),
($6,$2,'BEKO-OC-001','Beko Ocak',1)
`, uuid.NewString(), pid2, uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString())
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())

	// --- Trade-in (Takas) ---
	mux.HandleFunc("POST /v1/trade-ins", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			CustomerName      string `json:"customerName"`
			Phone             string `json:"phone"`
			OldBrand          string `json:"oldBrand"`
			OldModel          string `json:"oldModel"`
			OldCondition      string `json:"oldCondition"` // good|fair|poor
			DesiredProductSKU string `json:"desiredProductSku"`
			Note              string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.CustomerName == "" || body.Phone == "" || body.OldBrand == "" {
			httpx.WriteError(w, 400, "validation_error", "müşteri/telefon/eski marka gerekli", rid)
			return
		}
		if body.OldCondition == "" {
			body.OldCondition = "fair"
		}
		offer := estimateTradeIn(body.OldCondition, maxTradeIn)
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO trade_in_offers (id, customer_name, phone, old_brand, old_model, old_condition, desired_product_sku, offered_kurus, note)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`, id, body.CustomerName, body.Phone, body.OldBrand, body.OldModel, body.OldCondition, nullEmpty(body.DesiredProductSKU), offer, nullEmpty(body.Note))
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "takas kaydı hatası", rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{
			"id": id, "status": "PENDING", "offeredAmount": offer, "currency": "TRY",
			"maxCampaignAmount": maxTradeIn, "message": "Ön teklif hesaplandı; mağaza onayı gerekir.",
		})
	})

	mux.HandleFunc("GET /v1/trade-ins", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, customer_name, phone, old_brand, old_model, old_condition, COALESCE(desired_product_sku,''),
  offered_kurus, status, COALESCE(note,''), created_at
FROM trade_in_offers ORDER BY created_at DESC LIMIT 100
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "liste hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, name, phone, brand, model, cond, sku, status, note string
			var offered int64
			var created time.Time
			_ = rows.Scan(&id, &name, &phone, &brand, &model, &cond, &sku, &offered, &status, &note, &created)
			items = append(items, map[string]any{
				"id": id, "customerName": name, "phone": phone, "oldBrand": brand, "oldModel": model,
				"oldCondition": cond, "desiredProductSku": sku, "offeredAmount": offered, "status": status,
				"note": note, "createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("PATCH /v1/trade-ins/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body struct {
			Status        string `json:"status"` // APPROVED|REJECTED|COMPLETED
			OfferedKurus  *int64 `json:"offeredAmount"`
			Note          string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
			httpx.WriteError(w, 400, "validation_error", "status gerekli", rid)
			return
		}
		status := strings.ToUpper(body.Status)
		if body.OfferedKurus != nil {
			_, err = pool.Exec(r.Context(), `
UPDATE trade_in_offers SET status=$2, offered_kurus=$3, note=COALESCE(NULLIF($4,''), note), updated_at=NOW() WHERE id=$1
`, id, status, *body.OfferedKurus, body.Note)
		} else {
			_, err = pool.Exec(r.Context(), `
UPDATE trade_in_offers SET status=$2, note=COALESCE(NULLIF($3,''), note), updated_at=NOW() WHERE id=$1
`, id, status, body.Note)
		}
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "güncelleme hatası", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"id": id, "status": status})
	})

	// --- Çeyiz packages ---
	mux.HandleFunc("GET /v1/bundles", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, code, name, COALESCE(description,''), price_kurus FROM trousseau_packages WHERE active=TRUE ORDER BY price_kurus
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "paket listesi hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, code, name, desc string
			var price int64
			_ = rows.Scan(&id, &code, &name, &desc, &price)
			irows, _ := pool.Query(r.Context(), `
SELECT product_sku, product_name, qty FROM trousseau_package_items WHERE package_id=$1
`, id)
			var products []map[string]any
			if irows != nil {
				for irows.Next() {
					var sku, pname string
					var qty int
					_ = irows.Scan(&sku, &pname, &qty)
					products = append(products, map[string]any{"sku": sku, "name": pname, "qty": qty})
				}
				irows.Close()
			}
			items = append(items, map[string]any{
				"id": id, "code": code, "name": name, "description": desc, "price": price, "currency": "TRY", "items": products,
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	// --- Storage reservation ---
	mux.HandleFunc("POST /v1/storage-reservations", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			CustomerName string `json:"customerName"`
			Phone        string `json:"phone"`
			PackageID    string `json:"packageId"`
			StartDate    string `json:"startDate"` // YYYY-MM-DD
			EndDate      string `json:"endDate"`
			Note         string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.CustomerName == "" || body.Phone == "" || body.StartDate == "" || body.EndDate == "" {
			httpx.WriteError(w, 400, "validation_error", "müşteri/telefon/tarih gerekli", rid)
			return
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO storage_reservations (id, customer_name, phone, package_id, start_date, end_date, note)
VALUES ($1,$2,$3,NULLIF($4,'')::uuid,$5,$6,$7)
`, id, body.CustomerName, body.Phone, body.PackageID, body.StartDate, body.EndDate, nullEmpty(body.Note))
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "depolama rezervasyonu hatası", rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{"id": id, "status": "RESERVED", "message": "Ücretsiz depolama rezervasyonu alındı"})
	})

	mux.HandleFunc("GET /v1/storage-reservations", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, customer_name, phone, COALESCE(package_id::text,''), start_date::text, end_date::text, status, COALESCE(note,''), created_at
FROM storage_reservations ORDER BY created_at DESC LIMIT 100
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "liste hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, name, phone, pkg, start, end, status, note string
			var created time.Time
			_ = rows.Scan(&id, &name, &phone, &pkg, &start, &end, &status, &note, &created)
			items = append(items, map[string]any{
				"id": id, "customerName": name, "phone": phone, "packageId": pkg,
				"startDate": start, "endDate": end, "status": status, "note": note,
				"createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("PATCH /v1/storage-reservations/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body struct {
			Status string `json:"status"`
			Note   string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		if body.Status == "" {
			httpx.WriteError(w, 400, "validation_error", "status gerekli", rid)
			return
		}
		status := strings.ToUpper(body.Status)
		tag, err := pool.Exec(r.Context(), `
UPDATE storage_reservations SET status=$2, note=COALESCE(NULLIF($3,''), note) WHERE id=$1
`, id, status, body.Note)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "rezervasyon bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"id": id, "status": status})
	})

	mux.HandleFunc("DELETE /v1/storage-reservations/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		tag, err := pool.Exec(r.Context(), `DELETE FROM storage_reservations WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "rezervasyon bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("DELETE /v1/trade-ins/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		tag, err := pool.Exec(r.Context(), `DELETE FROM trade_in_offers WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "teklif bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func estimateTradeIn(condition string, max int) int64 {
	switch strings.ToLower(condition) {
	case "good", "iyi":
		return int64(max)
	case "fair", "orta":
		return int64(float64(max) * 0.7)
	default:
		return int64(float64(max) * 0.4)
	}
}

func nullEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
