package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/adbticaret/adbticaretbeko/services/backend/cms/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/authjwt"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("cms")
	addr := config.Getenv("HTTP_ADDR", ":8100")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	jwtSecret := config.Getenv("JWT_SECRET", "dev-jwt-access-secret-change-me")

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if _, err := conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS cms`); err != nil {
			return err
		}
		_, err := conn.Exec(ctx, `SET search_path TO cms`)
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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/cms/home", func(w http.ResponseWriter, r *http.Request) {
		h, err := st.GetHome(r.Context())
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "cms okunamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, h)
	})
	mux.HandleFunc("PUT /v1/admin/cms/home", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !isAdmin(r, jwtSecret) {
			httpx.WriteError(w, 403, "forbidden", "admin gerekli", rid)
			return
		}
		var body store.HomeContent
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		if err := st.SaveHome(r.Context(), body); err != nil {
			httpx.WriteError(w, 500, "internal_error", "kaydedilemedi", rid)
			return
		}
		httpx.WriteJSON(w, 200, body)
	})

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}

func isAdmin(r *http.Request, secret string) bool {
	if config.Getenv("APP_ENV", "development") == "development" && r.Header.Get("X-Dev-Admin") == "1" {
		return true
	}
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	claims, err := authjwt.ParseAccessToken(secret, strings.TrimPrefix(auth, "Bearer "))
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
