package main

import (
	"context"
	"net/http"

	httpapi "github.com/adbticaret/adbticaretbeko/services/backend/customer/internal/handler/http"
	"github.com/adbticaret/adbticaretbeko/services/backend/customer/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("customer")
	addr := config.Getenv("HTTP_ADDR", ":8082")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if _, err := conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS customer`); err != nil {
			return err
		}
		_, err := conn.Exec(ctx, `SET search_path TO customer`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()

	st := store.New(pool)
	if err := st.Migrate(ctx); err != nil {
		log.Error("migrate_failed", map[string]any{"error": err.Error()})
		return
	}

	h := &httpapi.Handler{
		Store:     st,
		JWTSecret: config.Getenv("JWT_SECRET", "dev-jwt-access-secret-change-me"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())
	mux.HandleFunc("POST /v1/customers/ensure", h.Ensure)
	mux.HandleFunc("GET /v1/customers/me", h.Me)
	mux.HandleFunc("PATCH /v1/customers/me", h.UpdateMe)
	mux.HandleFunc("GET /v1/customers/me/addresses", h.ListAddresses)
	mux.HandleFunc("POST /v1/customers/me/addresses", h.CreateAddress)
	mux.HandleFunc("PATCH /v1/customers/me/addresses/{addressId}", h.UpdateAddress)
	mux.HandleFunc("PUT /v1/customers/me/addresses/{addressId}", h.UpdateAddress)
	mux.HandleFunc("DELETE /v1/customers/me/addresses/{addressId}", h.DeleteAddress)

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}
