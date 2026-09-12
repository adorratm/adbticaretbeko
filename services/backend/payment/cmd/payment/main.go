package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider"
	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider/iyzico"
	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider/mockpsp"
	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider/paytr"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := logging.New("payment")
	addr := config.Getenv("HTTP_ADDR", ":8090")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	orderURL := config.Getenv("ORDER_URL", "http://localhost:8089")
	notifURL := config.Getenv("NOTIFICATION_URL", "http://localhost:8092")
	accountingURL := config.Getenv("ACCOUNTING_URL", "http://localhost:8097")
	pspName := strings.ToLower(config.Getenv("PAYMENT_PROVIDER", "mock"))
	webhookSecret := config.Getenv("PAYMENT_WEBHOOK_SECRET", "dev-webhook-secret")

	var psp provider.PaymentProvider
	switch pspName {
	case "iyzico":
		psp = &iyzico.Provider{
			APIKey:        config.Getenv("IYZICO_API_KEY", config.Getenv("PAYMENT_API_KEY", "")),
			SecretKey:     config.Getenv("IYZICO_SECRET_KEY", ""),
			WebhookSecret: webhookSecret,
		}
	case "paytr":
		psp = &paytr.Provider{
			MerchantID:    config.Getenv("PAYTR_MERCHANT_ID", ""),
			MerchantKey:   config.Getenv("PAYTR_MERCHANT_KEY", config.Getenv("PAYMENT_API_KEY", "")),
			MerchantSalt:  config.Getenv("PAYTR_MERCHANT_SALT", ""),
			WebhookSecret: webhookSecret,
		}
	default:
		pspName = "mock"
		psp = &mockpsp.Provider{WebhookSecret: webhookSecret}
	}
	log.Info("provider_selected", map[string]any{"provider": psp.Name()})

	ctx := context.Background()
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Error("db_config_failed", map[string]any{"error": err.Error()})
		return
	}
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS payment`)
		_, err := conn.Exec(ctx, `SET search_path TO payment`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()

	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL UNIQUE,
  amount_kurus BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL,
  checkout_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kurus BIGINT NOT NULL,
  reason TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	client := &http.Client{Timeout: 15 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/payments/provider", func(w http.ResponseWriter, r *http.Request) {
		configured := true
		mode := "live_ready"
		switch psp.Name() {
		case "iyzico":
			configured = config.Getenv("IYZICO_API_KEY", config.Getenv("PAYMENT_API_KEY", "")) != ""
			if !configured {
				mode = "stub_offline"
			}
		case "paytr":
			configured = config.Getenv("PAYTR_MERCHANT_ID", "") != "" && config.Getenv("PAYTR_MERCHANT_KEY", "") != ""
			if !configured {
				mode = "stub_offline"
			}
		default:
			mode = "mock"
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"provider": psp.Name(), "configured": configured, "mode": mode,
			"webhookSecretConfigured": webhookSecret != "",
			"callbackUrl":             config.Getenv("PAYMENT_CALLBACK_URL", "http://localhost:8080/api/v1/payments/webhook"),
		})
	})
	mux.HandleFunc("POST /v1/payments", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		idem := r.Header.Get("Idempotency-Key")
		if idem != "" {
			var cached []byte
			err := pool.QueryRow(r.Context(), `SELECT response_json FROM idempotency_keys WHERE key=$1`, idem).Scan(&cached)
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(200)
				_, _ = w.Write(cached)
				return
			}
		}
		var body struct {
			OrderID     string `json:"orderId"`
			AmountKurus int64  `json:"amount"`
			Currency    string `json:"currency"`
			CustomerID  string `json:"customerId"`
			ReturnURL   string `json:"returnUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == "" || body.AmountKurus <= 0 {
			httpx.WriteError(w, 400, "validation_error", "orderId ve amount gerekli", rid)
			return
		}
		if body.Currency == "" {
			body.Currency = "TRY"
		}
		if body.ReturnURL == "" {
			body.ReturnURL = config.Getenv("STOREFRONT_URL", "http://localhost:3000") + "/odeme/sonuc"
		}
		res, err := psp.CreatePayment(r.Context(), provider.CreatePaymentRequest{
			OrderID: body.OrderID, AmountKurus: body.AmountKurus, Currency: body.Currency,
			CustomerID: body.CustomerID, ReturnURL: body.ReturnURL,
			CallbackURL: config.Getenv("PAYMENT_CALLBACK_URL", "http://localhost:8080/api/v1/payments/webhook"),
		})
		if err != nil {
			httpx.WriteError(w, 502, "provider_error", err.Error(), rid)
			return
		}
		id := uuid.NewString()
		if psp.Name() == "mock" {
			sf := strings.TrimRight(config.Getenv("STOREFRONT_URL", "http://localhost:3000"), "/")
			res.CheckoutURL = fmt.Sprintf("%s/odeme/mock?paymentId=%s&orderId=%s&amount=%d", sf, id, body.OrderID, body.AmountKurus)
		}
		_, err = pool.Exec(r.Context(), `
INSERT INTO payments (id, order_id, provider, provider_payment_id, amount_kurus, currency, status, checkout_url)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
`, id, body.OrderID, psp.Name(), res.ProviderPaymentID, body.AmountKurus, body.Currency, res.Status, res.CheckoutURL)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ödeme kaydı hatası", rid)
			return
		}
		out := map[string]any{
			"id": id, "orderId": body.OrderID, "providerPaymentId": res.ProviderPaymentID,
			"status": res.Status, "checkoutUrl": res.CheckoutURL, "amount": body.AmountKurus, "currency": body.Currency,
		}
		raw, _ := json.Marshal(out)
		if idem != "" {
			_, _ = pool.Exec(r.Context(), `INSERT INTO idempotency_keys (key, response_json) VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING`, idem, string(raw))
		}
		httpx.WriteJSON(w, 201, out)
	})

	mux.HandleFunc("POST /v1/payments/webhook", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		payload, _ := io.ReadAll(r.Body)
		sig := r.Header.Get("X-Payment-Signature")
		body, err := psp.VerifyWebhook(r.Context(), payload, sig)
		if err != nil {
			httpx.WriteError(w, 401, "invalid_signature", err.Error(), rid)
			return
		}
		providerPaymentID, _ := body["providerPaymentId"].(string)
		status, _ := body["status"].(string)
		orderID, _ := body["orderId"].(string)
		eventKey := providerPaymentID + ":" + status
		if providerPaymentID == "" || status == "" {
			httpx.WriteError(w, 400, "validation_error", "providerPaymentId/status gerekli", rid)
			return
		}
		var exists string
		err = pool.QueryRow(r.Context(), `SELECT event_key FROM webhook_events WHERE event_key=$1`, eventKey).Scan(&exists)
		if err == nil {
			httpx.WriteJSON(w, 200, map[string]any{"ok": true, "duplicate": true})
			return
		}
		_, _ = pool.Exec(r.Context(), `
INSERT INTO webhook_events (id, event_key, payload) VALUES ($1,$2,$3::jsonb)
`, uuid.NewString(), eventKey, string(payload))
		_, _ = pool.Exec(r.Context(), `
UPDATE payments SET status=$2, updated_at=NOW() WHERE provider_payment_id=$1
`, providerPaymentID, status)

		if status == "succeeded" && orderID != "" {
			markPaid(client, orderURL, orderID)
			notify(client, notifURL, "payment.succeeded", map[string]any{"orderId": orderID})
			var amount int64
			_ = pool.QueryRow(r.Context(), `SELECT amount_kurus FROM payments WHERE provider_payment_id=$1`, providerPaymentID).Scan(&amount)
			issueInvoice(client, accountingURL, orderID, amount)
		}
		if status == "failed" && orderID != "" {
			notify(client, notifURL, "payment.failed", map[string]any{"orderId": orderID})
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true})
	})

	mux.HandleFunc("GET /v1/payments/by-order/{orderId}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		oid := r.PathValue("orderId")
		var id, status, checkout string
		var amount int64
		err := pool.QueryRow(r.Context(), `
SELECT id, status, COALESCE(checkout_url,''), amount_kurus FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1
`, oid).Scan(&id, &status, &checkout, &amount)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "ödeme yok", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"id": id, "orderId": oid, "status": status, "checkoutUrl": checkout, "amount": amount})
	})

	// Dev helper: simulate successful payment without real PSP
	mux.HandleFunc("POST /v1/payments/{id}/simulate-success", func(w http.ResponseWriter, r *http.Request) {
		if config.Getenv("APP_ENV", "development") != "development" {
			httpx.WriteError(w, 403, "forbidden", "sadece development", httpx.RequestIDFromContext(r.Context()))
			return
		}
		id := r.PathValue("id")
		var orderID, providerID string
		var amount int64
		err := pool.QueryRow(r.Context(), `SELECT order_id, provider_payment_id, amount_kurus FROM payments WHERE id=$1`, id).Scan(&orderID, &providerID, &amount)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "ödeme yok", httpx.RequestIDFromContext(r.Context()))
			return
		}
		payload, _ := json.Marshal(map[string]any{
			"providerPaymentId": providerID, "status": "succeeded", "orderId": orderID,
		})
		eventKey := providerID + ":succeeded"
		_, _ = pool.Exec(r.Context(), `INSERT INTO webhook_events (id, event_key, payload) VALUES ($1,$2,$3::jsonb) ON CONFLICT DO NOTHING`, uuid.NewString(), eventKey, string(payload))
		_, _ = pool.Exec(r.Context(), `UPDATE payments SET status='succeeded', updated_at=NOW() WHERE id=$1`, id)
		markPaid(client, orderURL, orderID)
		notify(client, notifURL, "payment.succeeded", map[string]any{"orderId": orderID})
		inv := issueInvoice(client, accountingURL, orderID, amount)
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "orderId": orderID, "invoice": inv})
	})

	mux.HandleFunc("POST /v1/payments/{id}/refund", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body struct {
			Amount int64  `json:"amount"`
			Reason string `json:"reason"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		var orderID, status, providerPaymentID string
		var amount int64
		err := pool.QueryRow(r.Context(), `
SELECT order_id, status, amount_kurus, provider_payment_id FROM payments WHERE id=$1
`, id).Scan(&orderID, &status, &amount, &providerPaymentID)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "ödeme yok", rid)
			return
		}
		if status != "succeeded" && status != "PAID" {
			httpx.WriteError(w, 400, "invalid_status", "yalnız başarılı ödemeler iade edilebilir", rid)
			return
		}
		if body.Amount <= 0 || body.Amount > amount {
			body.Amount = amount
		}
		if err := psp.RefundPayment(r.Context(), provider.RefundRequest{
			ProviderPaymentID: providerPaymentID,
			AmountKurus:       body.Amount,
			Reason:            body.Reason,
		}); err != nil {
			httpx.WriteError(w, 502, "provider_error", err.Error(), rid)
			return
		}
		refundID := uuid.NewString()
		_, _ = pool.Exec(r.Context(), `
INSERT INTO refunds (id, payment_id, amount_kurus, reason, provider_ref)
VALUES ($1,$2,$3,$4,$5)
`, refundID, id, body.Amount, body.Reason, providerPaymentID)
		_, _ = pool.Exec(r.Context(), `UPDATE payments SET status='refunded', updated_at=NOW() WHERE id=$1`, id)
		markStatus(client, orderURL, orderID, "CANCELLED")
		notify(client, notifURL, "payment.failed", map[string]any{"orderId": orderID, "reason": body.Reason})
		httpx.WriteJSON(w, 200, map[string]any{
			"ok": true, "paymentId": id, "orderId": orderID, "refundId": refundID,
			"refunded": body.Amount, "status": "refunded", "provider": psp.Name(),
		})
	})

	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	_ = httpx.ListenAndServe(addr, handler, log)
}

func markPaid(client *http.Client, orderURL, orderID string) {
	markStatus(client, orderURL, orderID, "PAID")
}

func markStatus(client *http.Client, orderURL, orderID, status string) {
	body, _ := json.Marshal(map[string]any{"status": status})
	req, err := http.NewRequest(http.MethodPatch, orderURL+"/v1/orders/"+orderID+"/status", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Service", "payment")
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
}

func notify(client *http.Client, notifURL, template string, data map[string]any) {
	payload, _ := json.Marshal(map[string]any{"template": template, "channel": "email", "data": data})
	resp, err := client.Post(notifURL+"/v1/notifications/send", "application/json", bytes.NewReader(payload))
	if err == nil {
		resp.Body.Close()
	}
}

func issueInvoice(client *http.Client, accountingURL, orderID string, amount int64) map[string]any {
	if accountingURL == "" || orderID == "" || amount <= 0 {
		return nil
	}
	payload, _ := json.Marshal(map[string]any{
		"orderId": orderID, "amount": amount, "customerName": "Musteri", "currency": "TRY",
	})
	resp, err := client.Post(accountingURL+"/v1/accounting/invoices", "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out
}
