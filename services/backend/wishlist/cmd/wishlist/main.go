package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("wishlist")
	addr := config.Getenv("HTTP_ADDR", ":8095")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS wishlist`)
		_, err := conn.Exec(ctx, `SET search_path TO wishlist`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  product_slug TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);
`)
	_, _ = pool.Exec(ctx, `ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS product_slug TEXT`)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/wishlist/{customerId}", func(w http.ResponseWriter, r *http.Request) {
		cid := r.PathValue("customerId")
		rows, err := pool.Query(r.Context(), `
SELECT id, customer_id, product_id, product_name, COALESCE(sku,''), COALESCE(product_slug,''), created_at
FROM wishlist_items WHERE customer_id=$1 ORDER BY created_at DESC
`, cid)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, customerID, productID, name, sku, slug string
			var created time.Time
			_ = rows.Scan(&id, &customerID, &productID, &name, &sku, &slug, &created)
			items = append(items, map[string]any{
				"id": id, "customerId": customerID, "productId": productID, "productName": name, "sku": sku,
				"productSlug": slug, "createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})
	mux.HandleFunc("POST /v1/wishlist/{customerId}", func(w http.ResponseWriter, r *http.Request) {
		cid := r.PathValue("customerId")
		var body struct {
			ProductID   string `json:"productId"`
			ProductName string `json:"productName"`
			SKU         string `json:"sku"`
			ProductSlug string `json:"productSlug"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.ProductID == "" || body.ProductName == "" {
			httpx.WriteError(w, 400, "validation_error", "productId/productName gerekli", httpx.RequestIDFromContext(r.Context()))
			return
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO wishlist_items (id, customer_id, product_id, product_name, sku, product_slug)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (customer_id, product_id) DO UPDATE SET
  product_name=EXCLUDED.product_name,
  sku=EXCLUDED.sku,
  product_slug=EXCLUDED.product_slug
`, id, cid, body.ProductID, body.ProductName, body.SKU, body.ProductSlug)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{"ok": true, "productId": body.ProductID, "productSlug": body.ProductSlug})
	})
	mux.HandleFunc("DELETE /v1/wishlist/{customerId}/{productId}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = pool.Exec(r.Context(), `DELETE FROM wishlist_items WHERE customer_id=$1 AND product_id=$2`, r.PathValue("customerId"), r.PathValue("productId"))
		httpx.WriteJSON(w, 200, map[string]any{"ok": true})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
