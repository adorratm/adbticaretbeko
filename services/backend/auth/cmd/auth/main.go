package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	httpapi "github.com/adbticaret/adbticaretbeko/services/backend/auth/internal/handler/http"
	"github.com/adbticaret/adbticaretbeko/services/backend/auth/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("auth")
	addr := config.Getenv("HTTP_ADDR", ":8081")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5432/adb_ticaret?sslmode=disable")

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS auth`)
		if err != nil {
			return err
		}
		_, err = conn.Exec(ctx, `SET search_path TO auth`)
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

	seed := config.Getenv("INITIAL_ALLOWED_ADMIN_EMAILS", "")
	if seed != "" {
		var emails []string
		for _, p := range strings.Split(seed, ",") {
			emails = append(emails, strings.TrimSpace(p))
		}
		if err := st.SeedAllowedAdmins(ctx, emails); err != nil {
			log.Error("seed_admins_failed", map[string]any{"error": err.Error()})
		}
	}

	h := &httpapi.Handler{
		Store:            st,
		JWTSecret:        config.Getenv("JWT_SECRET", "dev-jwt-access-secret-change-me"),
		JWTRefreshSecret: config.Getenv("JWT_REFRESH_SECRET", "dev-jwt-refresh-secret-change-me"),
		AccessTTL:        config.GetenvDuration("JWT_ACCESS_TTL", 15*time.Minute),
		RefreshTTL:       config.GetenvDuration("JWT_REFRESH_TTL", 168*time.Hour),
		GoogleClientID:   config.Getenv("GOOGLE_CLIENT_ID", config.Getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())
	mux.HandleFunc("POST /v1/auth/register", h.Register)
	mux.HandleFunc("POST /v1/auth/login", h.Login)
	mux.HandleFunc("POST /v1/auth/refresh", h.Refresh)
	mux.HandleFunc("POST /v1/auth/logout", h.Logout)
	mux.HandleFunc("POST /v1/auth/forgot-password", h.ForgotPassword)
	mux.HandleFunc("POST /v1/auth/reset-password", h.ResetPassword)
	mux.HandleFunc("POST /v1/auth/google", h.Google)
	mux.HandleFunc("GET /v1/auth/me", h.Me)
	mux.HandleFunc("GET /v1/admin/users", h.ListUsers)
	mux.HandleFunc("PATCH /v1/admin/users/{id}", h.UpdateUser)
	mux.HandleFunc("DELETE /v1/admin/users/{id}", h.DeleteUser)
	mux.HandleFunc("GET /v1/admin/allowed-admins", h.ListAllowedAdmins)
	mux.HandleFunc("POST /v1/admin/allowed-admins", h.AddAllowedAdmin)
	mux.HandleFunc("DELETE /v1/admin/allowed-admins/{id}", h.RemoveAllowedAdmin)

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}
