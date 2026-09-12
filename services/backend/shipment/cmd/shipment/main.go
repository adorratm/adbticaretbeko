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
	log := logging.New("shipment")
	addr := config.Getenv("HTTP_ADDR", ":8091")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS shipment`)
		_, err := conn.Exec(ctx, `SET search_path TO shipment`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  status TEXT NOT NULL,
  label_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("POST /v1/shipments", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			OrderID  string `json:"orderId"`
			Provider string `json:"provider"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.OrderID == "" {
			httpx.WriteError(w, 400, "validation_error", "orderId gerekli", rid)
			return
		}
		if body.Provider == "" {
			body.Provider = config.Getenv("SHIPPING_PROVIDER", "mock")
		}
		id := uuid.NewString()
		tracking := "TRK-" + id[:8]
		_, err := pool.Exec(r.Context(), `
INSERT INTO shipments (id, order_id, provider, tracking_number, status, label_url)
VALUES ($1,$2,$3,$4,'CREATED',$5)
`, id, body.OrderID, body.Provider, tracking, "https://example.local/labels/"+tracking+".pdf")
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "sevkiyat kaydı hatası", rid)
			return
		}
		_, _ = pool.Exec(r.Context(), `INSERT INTO shipment_events (id, shipment_id, status, note) VALUES ($1,$2,'CREATED','Sevkiyat oluşturuldu')`, uuid.NewString(), id)
		httpx.WriteJSON(w, 201, map[string]any{
			"id": id, "orderId": body.OrderID, "provider": body.Provider,
			"trackingNumber": tracking, "status": "CREATED",
		})
	})
	mux.HandleFunc("GET /v1/shipments/by-order/{orderId}", func(w http.ResponseWriter, r *http.Request) {
		oid := r.PathValue("orderId")
		var id, tracking, status, provider string
		err := pool.QueryRow(r.Context(), `
SELECT id, provider, tracking_number, status FROM shipments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1
`, oid).Scan(&id, &provider, &tracking, &status)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "sevkiyat yok", httpx.RequestIDFromContext(r.Context()))
			return
		}
		events := []map[string]any{}
		rows, _ := pool.Query(r.Context(), `SELECT status, COALESCE(note,''), created_at FROM shipment_events WHERE shipment_id=$1 ORDER BY created_at`, id)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var st, note string
				var created time.Time
				_ = rows.Scan(&st, &note, &created)
				events = append(events, map[string]any{"status": st, "note": note, "at": created.UTC().Format(time.RFC3339)})
			}
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"id": id, "orderId": oid, "provider": provider, "trackingNumber": tracking, "status": status, "events": events,
		})
	})
	mux.HandleFunc("GET /v1/shipments/track/{trackingNumber}", func(w http.ResponseWriter, r *http.Request) {
		tn := r.PathValue("trackingNumber")
		var id, oid, tracking, status, provider string
		err := pool.QueryRow(r.Context(), `
SELECT id, order_id, provider, tracking_number, status FROM shipments WHERE tracking_number=$1 LIMIT 1
`, tn).Scan(&id, &oid, &provider, &tracking, &status)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "takip numarası bulunamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		events := []map[string]any{}
		rows, _ := pool.Query(r.Context(), `SELECT status, COALESCE(note,''), created_at FROM shipment_events WHERE shipment_id=$1 ORDER BY created_at`, id)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var st, note string
				var created time.Time
				_ = rows.Scan(&st, &note, &created)
				events = append(events, map[string]any{"status": st, "note": note, "at": created.UTC().Format(time.RFC3339)})
			}
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"id": id, "orderId": oid, "provider": provider, "trackingNumber": tracking, "status": status, "events": events,
		})
	})
	mux.HandleFunc("PATCH /v1/shipments/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Status string `json:"status"`
			Note   string `json:"note"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, err := pool.Exec(r.Context(), `UPDATE shipments SET status=$2, updated_at=NOW() WHERE id=$1`, id, body.Status)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "güncelleme hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		note := body.Note
		if note == "" {
			note = body.Status
		}
		_, _ = pool.Exec(r.Context(), `INSERT INTO shipment_events (id, shipment_id, status, note) VALUES ($1,$2,$3,$4)`, uuid.NewString(), id, body.Status, note)
		httpx.WriteJSON(w, 200, map[string]any{"id": id, "status": body.Status})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
