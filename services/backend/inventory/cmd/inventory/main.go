package main

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("inventory")
	addr := config.Getenv("HTTP_ADDR", ":8084")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if _, err := conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS inventory`); err != nil {
			return err
		}
		_, err := conn.Exec(ctx, `SET search_path TO inventory`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  city TEXT, active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY, variant_id TEXT NOT NULL, warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  available INT NOT NULL DEFAULT 0, reserved INT NOT NULL DEFAULT 0,
  UNIQUE(variant_id, warehouse_id)
);
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY, variant_id TEXT NOT NULL, warehouse_id UUID NOT NULL,
  qty INT NOT NULL, checkout_id TEXT, expires_at TIMESTAMPTZ NOT NULL, released BOOLEAN DEFAULT FALSE
);
`)

	seedBranches(ctx, pool)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())

	mux.HandleFunc("GET /v1/warehouses", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, name, code, COALESCE(city,''), COALESCE(active,true) FROM warehouses ORDER BY name
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "şube listesi hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, name, code, city string
			var active bool
			_ = rows.Scan(&id, &name, &code, &city, &active)
			items = append(items, map[string]any{"id": id, "name": name, "code": code, "city": city, "active": active})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /v1/inventory/{variantId}", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("variantId")
		whCode := r.URL.Query().Get("warehouse")
		if whCode != "" {
			var available, reserved int
			var whName string
			err := pool.QueryRow(r.Context(), `
SELECT COALESCE(i.available,0), COALESCE(i.reserved,0), w.name
FROM warehouses w
LEFT JOIN inventory_items i ON i.warehouse_id=w.id AND i.variant_id=$1
WHERE w.code=$2
`, vid, whCode).Scan(&available, &reserved, &whName)
			if err != nil {
				httpx.WriteError(w, 404, "not_found", "şube/stok yok", httpx.RequestIDFromContext(r.Context()))
				return
			}
			httpx.WriteJSON(w, 200, map[string]any{
				"variantId": vid, "warehouseCode": whCode, "warehouseName": whName,
				"available": available, "reserved": reserved, "saleable": available - reserved,
			})
			return
		}
		var available, reserved int
		err := pool.QueryRow(r.Context(), `
SELECT COALESCE(SUM(available),0), COALESCE(SUM(reserved),0) FROM inventory_items WHERE variant_id=$1
`, vid).Scan(&available, &reserved)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "stok okunamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		brows, _ := pool.Query(r.Context(), `
SELECT w.code, w.name, COALESCE(i.available,0), COALESCE(i.reserved,0)
FROM warehouses w
LEFT JOIN inventory_items i ON i.warehouse_id=w.id AND i.variant_id=$1
WHERE COALESCE(w.active,true)=TRUE
ORDER BY w.name
`, vid)
		byWh := []map[string]any{}
		if brows != nil {
			for brows.Next() {
				var code, name string
				var av, rs int
				_ = brows.Scan(&code, &name, &av, &rs)
				byWh = append(byWh, map[string]any{
					"warehouseCode": code, "warehouseName": name,
					"available": av, "reserved": rs, "saleable": av - rs,
				})
			}
			brows.Close()
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"variantId": vid, "available": available, "reserved": reserved,
			"saleable": available - reserved, "byWarehouse": byWh,
		})
	})

	mux.HandleFunc("POST /v1/inventory/adjust", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			VariantID     string `json:"variantId"`
			Available     int    `json:"available"`
			WarehouseCode string `json:"warehouseCode"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.WarehouseCode == "" {
			body.WarehouseCode = "MAIN"
		}
		var wh string
		err := pool.QueryRow(r.Context(), `SELECT id FROM warehouses WHERE code=$1`, body.WarehouseCode).Scan(&wh)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "şube bulunamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		_, err = pool.Exec(r.Context(), `
INSERT INTO inventory_items (id, variant_id, warehouse_id, available, reserved)
VALUES ($1,$2,$3,$4,0)
ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET available = EXCLUDED.available
`, uuid.NewString(), body.VariantID, wh, body.Available)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "stok yazılamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "warehouseCode": body.WarehouseCode})
	})

	mux.HandleFunc("POST /v1/inventory/transfer", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			VariantID string `json:"variantId"`
			FromCode  string `json:"fromWarehouse"`
			ToCode    string `json:"toWarehouse"`
			Qty       int    `json:"qty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Qty <= 0 {
			httpx.WriteError(w, 400, "validation_error", "qty gerekli", rid)
			return
		}
		tx, err := pool.Begin(r.Context())
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "tx", rid)
			return
		}
		defer tx.Rollback(r.Context())
		var fromID, toID string
		if err := tx.QueryRow(r.Context(), `SELECT id FROM warehouses WHERE code=$1`, body.FromCode).Scan(&fromID); err != nil {
			httpx.WriteError(w, 404, "not_found", "kaynak şube yok", rid)
			return
		}
		if err := tx.QueryRow(r.Context(), `SELECT id FROM warehouses WHERE code=$1`, body.ToCode).Scan(&toID); err != nil {
			httpx.WriteError(w, 404, "not_found", "hedef şube yok", rid)
			return
		}
		var available int
		var itemID string
		err = tx.QueryRow(r.Context(), `
SELECT id, available-reserved FROM inventory_items WHERE variant_id=$1 AND warehouse_id=$2 FOR UPDATE
`, body.VariantID, fromID).Scan(&itemID, &available)
		if err != nil || available < body.Qty {
			httpx.WriteError(w, 409, "insufficient_stock", "kaynak stok yetersiz", rid)
			return
		}
		_, _ = tx.Exec(r.Context(), `UPDATE inventory_items SET available = available - $2 WHERE id=$1`, itemID, body.Qty)
		_, err = tx.Exec(r.Context(), `
INSERT INTO inventory_items (id, variant_id, warehouse_id, available, reserved)
VALUES ($1,$2,$3,$4,0)
ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET available = inventory_items.available + EXCLUDED.available
`, uuid.NewString(), body.VariantID, toID, body.Qty)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "transfer hatası", rid)
			return
		}
		_ = tx.Commit(r.Context())
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "transferred": body.Qty})
	})

	mux.HandleFunc("POST /v1/inventory/reserve", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			VariantID     string `json:"variantId"`
			Qty           int    `json:"qty"`
			CheckoutID    string `json:"checkoutId"`
			WarehouseCode string `json:"warehouseCode"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		tx, err := pool.Begin(r.Context())
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "tx", rid)
			return
		}
		defer tx.Rollback(r.Context())
		var available, reserved int
		var itemID, wh string
		if body.WarehouseCode != "" {
			err = tx.QueryRow(r.Context(), `
SELECT i.id, i.warehouse_id, i.available, i.reserved
FROM inventory_items i JOIN warehouses w ON w.id=i.warehouse_id
WHERE i.variant_id=$1 AND w.code=$2 FOR UPDATE OF i
`, body.VariantID, body.WarehouseCode).Scan(&itemID, &wh, &available, &reserved)
		} else {
			err = tx.QueryRow(r.Context(), `
SELECT id, warehouse_id, available, reserved FROM inventory_items WHERE variant_id=$1 FOR UPDATE LIMIT 1
`, body.VariantID).Scan(&itemID, &wh, &available, &reserved)
		}
		if err != nil || available-reserved < body.Qty {
			httpx.WriteError(w, 409, "insufficient_stock", "yetersiz stok", rid)
			return
		}
		_, err = tx.Exec(r.Context(), `UPDATE inventory_items SET reserved = reserved + $2 WHERE id=$1`, itemID, body.Qty)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "reserve", rid)
			return
		}
		resID := uuid.NewString()
		_, err = tx.Exec(r.Context(), `
INSERT INTO stock_reservations (id, variant_id, warehouse_id, qty, checkout_id, expires_at)
VALUES ($1,$2,$3,$4,$5, NOW() + INTERVAL '30 minutes')
`, resID, body.VariantID, wh, body.Qty, body.CheckoutID)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "reservation", rid)
			return
		}
		_ = tx.Commit(r.Context())
		httpx.WriteJSON(w, 200, map[string]any{"reservationId": resID})
	})

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	_ = httpx.ListenAndServe(addr, handler, log)
}

func seedBranches(ctx context.Context, pool *pgxpool.Pool) {
	branches := []struct{ code, name, city string }{
		{"MAIN", "Merkez Depo", "İstanbul"},
		{"BESIKTAS", "Beşiktaş Mağaza", "İstanbul"},
		{"KADIKOY", "Kadıköy Mağaza", "İstanbul"},
		{"BURSA", "Bursa Nilüfer", "Bursa"},
	}
	for _, b := range branches {
		_, _ = pool.Exec(ctx, `
INSERT INTO warehouses (id, name, code, city, active) VALUES ($1,$2,$3,$4,true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, city=EXCLUDED.city, active=true
`, uuid.NewString(), b.name, b.code, b.city)
	}
}
