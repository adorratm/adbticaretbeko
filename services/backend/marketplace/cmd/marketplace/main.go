package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter"
	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter/bekoerp"
	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter/hepsiburada"
	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter/trendyol"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type trackedProvider interface {
	adapter.MarketplaceProvider
	LastSync() string
	Configured() bool
}

func main() {
	log := logging.New("marketplace")
	addr := config.Getenv("HTTP_ADDR", ":8096")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")

	beko := bekoerp.New(
		config.Getenv("BEKO_ERP_BASE_URL", "https://erp.beko.example"),
		config.Getenv("BEKO_ERP_API_KEY", ""),
		config.Getenv("BEKO_DEALER_CODE", "BEKO-TR-340982"),
	)
	ty := trendyol.New(
		config.Getenv("TRENDYOL_SUPPLIER_ID", ""),
		config.Getenv("TRENDYOL_API_KEY", ""),
		config.Getenv("TRENDYOL_API_SECRET", ""),
	)
	hb := hepsiburada.New(
		config.Getenv("HB_MERCHANT_ID", ""),
		config.Getenv("HB_API_KEY", ""),
	)

	providers := map[string]trackedProvider{
		beko.Name(): beko,
		ty.Name():   ty,
		hb.Name():   hb,
	}
	defaultProvider := config.Getenv("MARKETPLACE_DEFAULT_PROVIDER", beko.Name())

	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS marketplace`)
		_, err := conn.Exec(ctx, `SET search_path TO marketplace`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS product_mappings (
  id UUID PRIMARY KEY,
  sku TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  UNIQUE(provider, sku)
);
`)

	resolve := func(name string) trackedProvider {
		name = strings.TrimSpace(strings.ToLower(name))
		if name == "" {
			name = defaultProvider
		}
		if name == "beko" {
			name = "beko-erp"
		}
		if p, ok := providers[name]; ok {
			return p
		}
		return providers[defaultProvider]
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/marketplace/status", func(w http.ResponseWriter, r *http.Request) {
		selected := resolve(r.URL.Query().Get("provider"))
		status, _ := selected.Health(r.Context())
		list := []map[string]any{}
		for _, name := range []string{beko.Name(), ty.Name(), hb.Name()} {
			p := providers[name]
			st, _ := p.Health(r.Context())
			list = append(list, map[string]any{
				"provider": name, "status": st, "configured": p.Configured(), "lastSyncOp": p.LastSync(),
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"provider": selected.Name(), "status": status,
			"dealerCode": config.Getenv("BEKO_DEALER_CODE", "BEKO-TR-340982"),
			"lastSyncOp": selected.LastSync(), "configured": selected.Configured(),
			"providers": list, "defaultProvider": defaultProvider,
		})
	})

	mux.HandleFunc("POST /v1/marketplace/sync", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			Type     string `json:"type"` // products|stock|price|orders
			Provider string `json:"provider"`
			SKU      string `json:"sku"`
			Name     string `json:"name"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Type == "" {
			body.Type = "stock"
		}
		if body.SKU == "" {
			body.SKU = "BEKO-DEMO"
		}
		if body.Name == "" {
			body.Name = "Demo Ürün"
		}
		prov := resolve(body.Provider)
		jobID := uuid.NewString()
		_, _ = pool.Exec(r.Context(), `
INSERT INTO sync_jobs (id, provider, job_type, status, detail) VALUES ($1,$2,$3,'RUNNING',$4::jsonb)
`, jobID, prov.Name(), body.Type, `{}`)

		var syncErr error
		var pulled int
		extID := fmt.Sprintf("%s:%s", prov.Name(), body.SKU)
		switch body.Type {
		case "products":
			syncErr = prov.PushProduct(r.Context(), adapter.ProductPayload{
				SKU: body.SKU, Name: body.Name, ExternalID: extID,
			})
			if syncErr == nil {
				_, _ = pool.Exec(r.Context(), `
INSERT INTO product_mappings (id, sku, provider, external_id)
VALUES ($1,$2,$3,$4)
ON CONFLICT (provider, sku) DO UPDATE SET external_id = EXCLUDED.external_id
`, uuid.NewString(), body.SKU, prov.Name(), extID)
			}
		case "price":
			syncErr = prov.UpdatePrice(r.Context(), body.SKU, 10000)
		case "orders":
			var orders []adapter.OrderPayload
			orders, syncErr = prov.PullOrders(r.Context())
			pulled = len(orders)
		default:
			syncErr = prov.UpdateStock(r.Context(), body.SKU, 10)
		}
		status := "DONE"
		detail := map[string]any{"ok": true, "sku": body.SKU, "externalId": extID}
		if body.Type == "orders" {
			detail["pulled"] = pulled
		}
		if syncErr != nil {
			status = "FAILED"
			detail = map[string]any{"error": syncErr.Error()}
		}
		raw, _ := json.Marshal(detail)
		_, _ = pool.Exec(r.Context(), `
UPDATE sync_jobs SET status=$2, detail=$3::jsonb, finished_at=NOW() WHERE id=$1
`, jobID, status, string(raw))
		if syncErr != nil {
			httpx.WriteError(w, 502, "sync_failed", syncErr.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"jobId": jobID, "type": body.Type, "status": status, "provider": prov.Name(), "externalId": extID,
		})
	})

	mux.HandleFunc("GET /v1/marketplace/sync-jobs", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, provider, job_type, status, created_at, finished_at FROM sync_jobs ORDER BY created_at DESC LIMIT 50
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "job listesi hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, providerName, jt, status string
			var created time.Time
			var finished *time.Time
			_ = rows.Scan(&id, &providerName, &jt, &status, &created, &finished)
			row := map[string]any{
				"id": id, "provider": providerName, "type": jt, "status": status,
				"createdAt": created.UTC().Format(time.RFC3339),
			}
			if finished != nil {
				row["finishedAt"] = finished.UTC().Format(time.RFC3339)
			}
			items = append(items, row)
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /v1/marketplace/mappings", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT id, sku, provider, external_id FROM product_mappings ORDER BY provider, sku LIMIT 200
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "mapping listesi hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, sku, providerName, ext string
			_ = rows.Scan(&id, &sku, &providerName, &ext)
			items = append(items, map[string]any{"id": id, "sku": sku, "provider": providerName, "externalId": ext})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
