package main

import (
	"context"
	"net/http"

	httpapi "github.com/adbticaret/adbticaretbeko/services/backend/catalog/internal/handler/http"
	"github.com/adbticaret/adbticaretbeko/services/backend/catalog/internal/media"
	"github.com/adbticaret/adbticaretbeko/services/backend/catalog/internal/store"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("catalog")
	addr := config.Getenv("HTTP_ADDR", ":8083")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if _, err := conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS catalog`); err != nil {
			return err
		}
		_, err := conn.Exec(ctx, `SET search_path TO catalog`)
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
	if err := st.SeedDemo(ctx); err != nil {
		log.Error("seed_failed", map[string]any{"error": err.Error()})
	}

	mediaClient, _ := media.NewFromEnv()
	if mediaClient != nil && mediaClient.Enabled() {
		log.Info("media_ready", map[string]any{"bucket": config.Getenv("S3_BUCKET", "adb-products")})
	} else {
		log.Info("media_offline", map[string]any{"hint": "MinIO yoksa görsel URL ile eklenebilir"})
	}

	h := &httpapi.Handler{
		Store:     st,
		Media:     mediaClient,
		JWTSecret: config.Getenv("JWT_SECRET", "dev-jwt-access-secret-change-me"),
		AppEnv:    config.Getenv("APP_ENV", "development"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())
	mux.HandleFunc("GET /v1/products", h.ListProducts)
	mux.HandleFunc("GET /v1/products/{slug}", h.GetProduct)
	mux.HandleFunc("POST /v1/admin/products", h.CreateProduct)
	mux.HandleFunc("PATCH /v1/admin/products/{id}", h.UpdateProduct)
	mux.HandleFunc("PUT /v1/admin/products/{id}", h.UpdateProduct)
	mux.HandleFunc("DELETE /v1/admin/products/{id}", h.DeleteProduct)
	mux.HandleFunc("GET /v1/admin/products/{id}/images", h.ListProductImages)
	mux.HandleFunc("POST /v1/admin/products/{id}/images", h.AddProductImage)
	mux.HandleFunc("DELETE /v1/admin/products/{id}/images/{imageId}", h.DeleteProductImage)
	mux.HandleFunc("GET /v1/admin/products/{id}/variants", h.ListProductVariants)
	mux.HandleFunc("POST /v1/admin/products/{id}/variants", h.UpsertProductVariant)
	mux.HandleFunc("PUT /v1/admin/products/{id}/variants", h.UpsertProductVariant)
	mux.HandleFunc("DELETE /v1/admin/products/{id}/variants/{variantId}", h.DeleteProductVariant)
	mux.HandleFunc("GET /v1/brands", h.ListBrands)
	mux.HandleFunc("POST /v1/admin/brands", h.CreateBrand)
	mux.HandleFunc("GET /v1/categories", h.ListCategories)
	mux.HandleFunc("POST /v1/admin/categories", h.CreateCategory)
	mux.HandleFunc("PATCH /v1/admin/categories/{id}", h.UpdateCategory)
	mux.HandleFunc("PUT /v1/admin/categories/{id}", h.UpdateCategory)
	mux.HandleFunc("DELETE /v1/admin/categories/{id}", h.DeleteCategory)

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}
