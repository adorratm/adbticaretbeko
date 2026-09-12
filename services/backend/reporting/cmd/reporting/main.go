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
	log := logging.New("reporting")
	addr := config.Getenv("HTTP_ADDR", ":8098")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS reporting`)
		_, err := conn.Exec(ctx, `SET search_path TO reporting`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS branch_quotas (
  id UUID PRIMARY KEY,
  warehouse_code TEXT NOT NULL UNIQUE,
  warehouse_name TEXT NOT NULL,
  monthly_quota_kurus BIGINT NOT NULL,
  achieved_kurus BIGINT NOT NULL DEFAULT 0,
  bonus_kurus BIGINT NOT NULL DEFAULT 0,
  period TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incentive_campaigns (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  bonus_kurus BIGINT NOT NULL,
  active BOOLEAN DEFAULT TRUE
);
`)
	period := time.Now().UTC().Format("2006-01")
	var qcount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM branch_quotas WHERE period=$1`, period).Scan(&qcount)
	if qcount == 0 {
		seeds := []struct {
			code, name string
			quota, ach, bonus int64
		}{
			{"BESIKTAS", "Beşiktaş Mağaza", 500000000, 420000000, 1500000},
			{"KADIKOY", "Kadıköy Mağaza", 450000000, 380000000, 1200000},
			{"BURSA", "Bursa Nilüfer", 300000000, 210000000, 800000},
		}
		for _, s := range seeds {
			_, _ = pool.Exec(ctx, `
INSERT INTO branch_quotas (id, warehouse_code, warehouse_name, monthly_quota_kurus, achieved_kurus, bonus_kurus, period)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`, uuid.NewString(), s.code, s.name, s.quota, s.ach, s.bonus, period)
		}
	}
	var icount int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM incentive_campaigns`).Scan(&icount)
	if icount == 0 {
		_, _ = pool.Exec(ctx, `
INSERT INTO incentive_campaigns (id, code, title, description, bonus_kurus) VALUES
($1,'KLIMA-MONTAJ','Klima montaj ikramiyesi','Her klima montajında ekstra prim', 25000),
($2,'BEKO-QUOTA','Beko ekstra bayi primi','Aylık kota %80 üstü', 500000)
`, uuid.NewString(), uuid.NewString())
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/reports/quotas", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Query().Get("period")
		if p == "" {
			p = period
		}
		rows, err := pool.Query(r.Context(), `
SELECT warehouse_code, warehouse_name, monthly_quota_kurus, achieved_kurus, bonus_kurus, period
FROM branch_quotas WHERE period=$1 ORDER BY warehouse_name
`, p)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "kota okunamadı", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var code, name, per string
			var quota, ach, bonus int64
			_ = rows.Scan(&code, &name, &quota, &ach, &bonus, &per)
			pct := 0.0
			if quota > 0 {
				pct = float64(ach) / float64(quota) * 100
			}
			items = append(items, map[string]any{
				"warehouseCode": code, "warehouseName": name, "quota": quota, "achieved": ach,
				"bonus": bonus, "percent": pct, "period": per, "currency": "TRY",
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "period": p})
	})

	mux.HandleFunc("GET /v1/reports/incentives", func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
SELECT code, title, COALESCE(description,''), bonus_kurus, active FROM incentive_campaigns ORDER BY title
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "teşvik listesi hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var code, title, desc string
			var bonus int64
			var active bool
			_ = rows.Scan(&code, &title, &desc, &bonus, &active)
			items = append(items, map[string]any{
				"code": code, "title": title, "description": desc, "bonus": bonus, "active": active, "currency": "TRY",
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("PUT /v1/reports/quotas/{code}", func(w http.ResponseWriter, r *http.Request) {
		code := r.PathValue("code")
		var body struct {
			Achieved int64 `json:"achieved"`
			Bonus    int64 `json:"bonus"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, err := pool.Exec(r.Context(), `
UPDATE branch_quotas SET achieved_kurus=$2, bonus_kurus=$3, updated_at=NOW()
WHERE warehouse_code=$1 AND period=$4
`, code, body.Achieved, body.Bonus, period)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "kota güncellenemedi", httpx.RequestIDFromContext(r.Context()))
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}
