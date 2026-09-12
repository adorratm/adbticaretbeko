package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Invoice struct {
	ID              string    `json:"id"`
	OrderID         string    `json:"orderId"`
	Number          string    `json:"number"`
	CustomerName    string    `json:"customerName"`
	TaxNo           string    `json:"taxNo,omitempty"`
	AmountKurus     int64     `json:"amount"`
	TaxRate         int       `json:"taxRate"`
	TaxAmountKurus  int64     `json:"taxAmount"`
	NetAmountKurus  int64     `json:"netAmount"`
	Currency        string    `json:"currency"`
	Status          string    `json:"status"` // DRAFT | ISSUED | CANCELLED
	EInvoiceStatus  string    `json:"eInvoiceStatus"`
	EInvoiceUUID    string    `json:"eInvoiceUuid,omitempty"`
	PDFURL          string    `json:"pdfUrl"`
	CreatedAt       time.Time `json:"createdAt"`
}

func main() {
	log := logging.New("accounting")
	addr := config.Getenv("HTTP_ADDR", ":8097")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable")
	einvoiceProvider := strings.ToLower(config.Getenv("EINVOICE_PROVIDER", "stub"))
	defaultTaxRate, _ := strconv.Atoi(config.Getenv("EINVOICE_TAX_RATE", "20"))
	if defaultTaxRate <= 0 {
		defaultTaxRate = 20
	}

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS accounting`)
		_, err := conn.Exec(ctx, `SET search_path TO accounting`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL,
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  tax_no TEXT NOT NULL DEFAULT '',
  amount_kurus BIGINT NOT NULL,
  tax_rate INT NOT NULL DEFAULT 20,
  tax_amount_kurus BIGINT NOT NULL DEFAULT 0,
  net_amount_kurus BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'ISSUED',
  einvoice_status TEXT NOT NULL DEFAULT 'STUB',
  einvoice_uuid TEXT NOT NULL DEFAULT '',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_order_idx ON invoices(order_id);
`)
	// Mevcut tablolara soft-migrate
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_no TEXT NOT NULL DEFAULT ''`)
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate INT NOT NULL DEFAULT 20`)
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount_kurus BIGINT NOT NULL DEFAULT 0`)
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_amount_kurus BIGINT NOT NULL DEFAULT 0`)
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoice_status TEXT NOT NULL DEFAULT 'STUB'`)
	_, _ = pool.Exec(ctx, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoice_uuid TEXT NOT NULL DEFAULT ''`)

	scanInvoice := func(scanner interface {
		Scan(dest ...any) error
	}, inv *Invoice) error {
		return scanner.Scan(
			&inv.ID, &inv.OrderID, &inv.Number, &inv.CustomerName, &inv.TaxNo,
			&inv.AmountKurus, &inv.TaxRate, &inv.TaxAmountKurus, &inv.NetAmountKurus,
			&inv.Currency, &inv.Status, &inv.EInvoiceStatus, &inv.EInvoiceUUID, &inv.PDFURL, &inv.CreatedAt,
		)
	}
	selectCols := `id, order_id, number, customer_name, COALESCE(tax_no,''), amount_kurus,
COALESCE(tax_rate,20), COALESCE(tax_amount_kurus,0), COALESCE(net_amount_kurus,0),
currency, status, COALESCE(einvoice_status,'STUB'), COALESCE(einvoice_uuid,''), COALESCE(pdf_url,''), created_at`

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())

	mux.HandleFunc("POST /v1/accounting/invoices", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			OrderID      string `json:"orderId"`
			CustomerName string `json:"customerName"`
			TaxNo        string `json:"taxNo"`
			Amount       int64  `json:"amount"`
			Currency     string `json:"currency"`
			TaxRate      int    `json:"taxRate"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == "" || body.Amount <= 0 {
			httpx.WriteError(w, 400, "validation_error", "orderId ve amount gerekli", rid)
			return
		}
		if body.Currency == "" {
			body.Currency = "TRY"
		}
		if body.CustomerName == "" {
			body.CustomerName = "Musteri"
		}
		if body.TaxRate <= 0 {
			body.TaxRate = defaultTaxRate
		}
		var existing Invoice
		err := scanInvoice(pool.QueryRow(r.Context(), `
SELECT `+selectCols+` FROM invoices WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1
`, body.OrderID), &existing)
		if err == nil {
			httpx.WriteJSON(w, 200, existing)
			return
		}

		// KDV dahil tutardan net/KDV ayır
		net := body.Amount * 100 / int64(100+body.TaxRate)
		tax := body.Amount - net
		eStatus := "STUB"
		eUUID := ""
		if einvoiceProvider != "stub" {
			eStatus = "QUEUED"
			eUUID = uuid.NewString()
			log.Info("einvoice_queued_stub", map[string]any{"provider": einvoiceProvider, "uuid": eUUID})
		} else {
			eUUID = "stub-" + uuid.NewString()[:8]
		}

		inv := Invoice{
			ID:             uuid.NewString(),
			OrderID:        body.OrderID,
			Number:         fmt.Sprintf("ADB-%s", strings.ToUpper(uuid.NewString()[:8])),
			CustomerName:   body.CustomerName,
			TaxNo:          body.TaxNo,
			AmountKurus:    body.Amount,
			TaxRate:        body.TaxRate,
			TaxAmountKurus: tax,
			NetAmountKurus: net,
			Currency:       body.Currency,
			Status:         "ISSUED",
			EInvoiceStatus: eStatus,
			EInvoiceUUID:   eUUID,
			CreatedAt:      time.Now().UTC(),
		}
		inv.PDFURL = fmt.Sprintf("%s/api/v1/accounting/invoices/%s/pdf", strings.TrimRight(config.Getenv("GATEWAY_PUBLIC_URL", "http://localhost:8080"), "/"), inv.ID)
		_, err = pool.Exec(r.Context(), `
INSERT INTO invoices (id, order_id, number, customer_name, tax_no, amount_kurus, tax_rate, tax_amount_kurus, net_amount_kurus, currency, status, einvoice_status, einvoice_uuid, pdf_url)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
`, inv.ID, inv.OrderID, inv.Number, inv.CustomerName, inv.TaxNo, inv.AmountKurus, inv.TaxRate, inv.TaxAmountKurus, inv.NetAmountKurus, inv.Currency, inv.Status, inv.EInvoiceStatus, inv.EInvoiceUUID, inv.PDFURL)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 201, inv)
	})

	mux.HandleFunc("GET /v1/accounting/invoices", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		rows, err := pool.Query(r.Context(), `SELECT `+selectCols+` FROM invoices ORDER BY created_at DESC LIMIT 100`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		defer rows.Close()
		items := []Invoice{}
		for rows.Next() {
			var inv Invoice
			if err := scanInvoice(rows, &inv); err != nil {
				httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
				return
			}
			items = append(items, inv)
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "eInvoiceProvider": einvoiceProvider})
	})

	mux.HandleFunc("GET /v1/accounting/invoices/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var inv Invoice
		err := scanInvoice(pool.QueryRow(r.Context(), `SELECT `+selectCols+` FROM invoices WHERE id=$1`, id), &inv)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "fatura bulunamadı", rid)
			return
		}
		httpx.WriteJSON(w, 200, inv)
	})

	mux.HandleFunc("GET /v1/accounting/invoices/{id}/pdf", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var inv Invoice
		err := scanInvoice(pool.QueryRow(r.Context(), `SELECT `+selectCols+` FROM invoices WHERE id=$1`, id), &inv)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "fatura bulunamadı", rid)
			return
		}
		net := float64(inv.NetAmountKurus) / 100
		tax := float64(inv.TaxAmountKurus) / 100
		total := float64(inv.AmountKurus) / 100
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s.html", inv.Number))
		_, _ = fmt.Fprintf(w, `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Fatura %s</title>
<style>
  :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--brand:#0056b3;--soft:#f1f5f9}
  *{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;color:var(--ink);background:#e8eef5;padding:24px}
  .sheet{max-width:760px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 18px 40px rgba(15,23,42,.12);overflow:hidden}
  .head{display:flex;justify-content:space-between;gap:16px;padding:28px 32px;background:linear-gradient(135deg,#003d82,#0056b3);color:#fff}
  .brand{font-size:22px;font-weight:800;letter-spacing:-.02em}
  .sub{opacity:.85;font-size:13px;margin-top:4px}
  .badge{align-self:flex-start;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700}
  .body{padding:28px 32px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}
  .box{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
  .label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
  table{width:100%%;border-collapse:collapse;font-size:14px;margin:8px 0 20px}
  th,td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .right{text-align:right} .totals{margin-left:auto;width:min(320px,100%%)}
  .totals tr td{border:none;padding:6px 0} .totals .grand td{font-size:18px;font-weight:800;color:var(--brand);padding-top:10px;border-top:2px solid var(--line)}
  .foot{padding:16px 32px 28px;font-size:12px;color:var(--muted);border-top:1px solid var(--line)}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="sheet">
  <div class="head">
    <div><div class="brand">ADB Ticaret</div><div class="sub">Beko Yetkili Satıcısı · e-Fatura önizleme (%s)</div></div>
    <div class="badge">FATURA<br/>%s</div>
  </div>
  <div class="body">
    <div class="grid">
      <div class="box"><div class="label">Müşteri</div><strong>%s</strong><div style="margin-top:6px;font-size:13px;color:var(--muted)">VKN/TCKN: %s</div></div>
      <div class="box"><div class="label">Sipariş / UUID</div><strong>%s</strong><div style="margin-top:6px;font-size:12px;word-break:break-all;color:var(--muted)">%s</div></div>
    </div>
    <table>
      <thead><tr><th>Açıklama</th><th class="right">Tutar</th></tr></thead>
      <tbody>
        <tr><td>Mal / hizmet bedeli (KDV hariç)</td><td class="right">%.2f TRY</td></tr>
        <tr><td>KDV %%%d</td><td class="right">%.2f TRY</td></tr>
      </tbody>
    </table>
    <table class="totals">
      <tr><td>Ara toplam</td><td class="right">%.2f TRY</td></tr>
      <tr><td>KDV</td><td class="right">%.2f TRY</td></tr>
      <tr class="grand"><td>Genel toplam</td><td class="right">%.2f TRY</td></tr>
    </table>
    <div style="font-size:13px;color:var(--muted)">Durum: <strong>%s</strong> · e-Fatura: <strong>%s</strong></div>
  </div>
  <div class="foot">Bu belge demo ortamında üretilmiş HTML fatura önizlemesidir. Gerçek e-Fatura/e-Arşiv entegrasyonu (%s) bağlandığında PDF provider çıktısı kullanılır.</div>
</div>
</body></html>`,
			inv.Number, einvoiceProvider, inv.Number, inv.CustomerName, inv.TaxNo, inv.OrderID, inv.EInvoiceUUID,
			net, inv.TaxRate, tax, net, tax, total, inv.Status, inv.EInvoiceStatus, einvoiceProvider)
	})

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}
