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
	log := logging.New("review")
	addr := config.Getenv("HTTP_ADDR", ":8094")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS review`)
		_, err := conn.Exec(ctx, `SET search_path TO review`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/reviews", func(w http.ResponseWriter, r *http.Request) {
		pid := r.URL.Query().Get("productId")
		q := `SELECT id, product_id, COALESCE(customer_id,''), COALESCE(customer_name,''), rating, COALESCE(title,''), body, created_at FROM reviews`
		args := []any{}
		if pid != "" {
			q += ` WHERE product_id=$1`
			args = append(args, pid)
		}
		q += ` ORDER BY created_at DESC LIMIT 100`
		rows, err := pool.Query(r.Context(), q, args...)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		sum := 0
		for rows.Next() {
			var id, productID, customerID, name, title, body string
			var rating int
			var created time.Time
			_ = rows.Scan(&id, &productID, &customerID, &name, &rating, &title, &body, &created)
			sum += rating
			items = append(items, map[string]any{
				"id": id, "productId": productID, "customerId": customerID, "customerName": name,
				"rating": rating, "title": title, "body": body, "createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		avg := 0.0
		if len(items) > 0 {
			avg = float64(sum) / float64(len(items))
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "average": avg, "count": len(items)})
	})
	mux.HandleFunc("POST /v1/reviews", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			ProductID    string `json:"productId"`
			CustomerID   string `json:"customerId"`
			CustomerName string `json:"customerName"`
			Rating       int    `json:"rating"`
			Title        string `json:"title"`
			Body         string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ProductID == "" || body.Body == "" || body.Rating < 1 || body.Rating > 5 {
			httpx.WriteError(w, 400, "validation_error", "productId/body/rating(1-5) gerekli", rid)
			return
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO reviews (id, product_id, customer_id, customer_name, rating, title, body)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`, id, body.ProductID, body.CustomerID, body.CustomerName, body.Rating, body.Title, body.Body)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{"id": id, "ok": true})
	})
	mux.HandleFunc("DELETE /v1/reviews/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		tag, err := pool.Exec(r.Context(), `DELETE FROM reviews WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.WriteError(w, 404, "not_found", "yorum bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
