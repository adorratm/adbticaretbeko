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
	log := logging.New("pricing")
	addr := config.Getenv("HTTP_ADDR", ":8085")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS pricing`)
		_, err := conn.Exec(ctx, `SET search_path TO pricing`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY,
  variant_id TEXT NOT NULL UNIQUE,
  amount_kurus BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/pricing/{variantId}", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("variantId")
		var amount int64
		var currency string
		err := pool.QueryRow(r.Context(), `SELECT amount_kurus, currency FROM prices WHERE variant_id=$1`, vid).Scan(&amount, &currency)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "fiyat yok", httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"variantId": vid, "amount": amount, "currency": currency})
	})
	mux.HandleFunc("PUT /v1/pricing/{variantId}", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("variantId")
		var body struct {
			Amount int64 `json:"amount"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, err := pool.Exec(r.Context(), `
INSERT INTO prices (id, variant_id, amount_kurus) VALUES ($1,$2,$3)
ON CONFLICT (variant_id) DO UPDATE SET amount_kurus=EXCLUDED.amount_kurus, updated_at=NOW()
`, uuid.NewString(), vid, body.Amount)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "fiyat yazılamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"variantId": vid, "amount": body.Amount, "currency": "TRY"})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
