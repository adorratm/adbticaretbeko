package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var templates = map[string]string{
	"order.paid":               "Siparişiniz ödendi. Sipariş no: {{orderId}}",
	"order.shipped":            "Siparişiniz kargoya verildi. Sipariş no: {{orderId}}",
	"order.montage_scheduled":  "Montaj randevunuz oluşturuldu. Sipariş no: {{orderId}}",
	"order.service_on_the_way": "Yetkili servis yola çıktı. Sipariş no: {{orderId}}",
	"order.discovery_request":  "Montaj öncesi keşif talebi alındı. Sipariş no: {{orderId}}",
	"payment.succeeded":        "Ödemeniz başarılı. Sipariş no: {{orderId}}",
	"payment.failed":           "Ödeme başarısız. Sipariş no: {{orderId}}",
	"cart.abandoned":           "Sepetiniz sizi bekliyor. Alışverişi tamamlamak için mağazamıza uğrayın. Sepet: {{cartId}}",
	"payment.refunded":         "Ödemeniz iade edildi. Sipariş no: {{orderId}}",
	"campaign.push":            "{{title}} — {{body}}",
}

var templateTitles = map[string]string{
	"order.paid":               "Sipariş ödendi",
	"order.shipped":            "Kargoya verildi",
	"order.montage_scheduled":  "Montaj randevusu",
	"order.service_on_the_way": "Servis yolda",
	"order.discovery_request":  "Keşif talebi",
	"payment.succeeded":        "Ödeme başarılı",
	"payment.failed":           "Ödeme başarısız",
	"cart.abandoned":           "Terk edilen sepet",
	"payment.refunded":         "Ödeme iade edildi",
	"campaign.push":            "Kampanya bildirimi",
}

func main() {
	log := logging.New("notification")
	addr := config.Getenv("HTTP_ADDR", ":8092")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	smtpHost := config.Getenv("SMTP_HOST", "localhost")
	smtpPort := config.Getenv("SMTP_PORT", "1025")
	from := config.Getenv("SMTP_FROM", "noreply@adbticaret.local")
	realtimeURL := strings.TrimRight(config.Getenv("REALTIME_URL", "http://localhost:8102"), "/")
	realtimeSecret := config.Getenv("REALTIME_INTERNAL_SECRET", "adb-dev-realtime")

	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS notification`)
		_, err := conn.Exec(ctx, `SET search_path TO notification`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY,
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  recipient TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inbox (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inbox_user_idx ON inbox(user_id, created_at DESC);
`)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/notifications/templates", func(w http.ResponseWriter, r *http.Request) {
		items := []map[string]string{}
		for k, v := range templates {
			title := templateTitles[k]
			if title == "" {
				title = k
			}
			items = append(items, map[string]string{"id": k, "title": title, "name": title, "body": v})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /v1/notifications/inbox", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("userId"))
		var rows pgx.Rows
		var err error
		if userID != "" {
			rows, err = pool.Query(r.Context(), `
SELECT id, user_id, title, body, template, read, created_at FROM inbox
WHERE user_id=$1 OR user_id='__broadcast__' OR user_id='broadcast' OR user_id=''
ORDER BY created_at DESC LIMIT 50
`, userID)
		} else {
			rows, err = pool.Query(r.Context(), `
SELECT id, user_id, title, body, template, read, created_at FROM inbox
ORDER BY created_at DESC LIMIT 50
`)
		}
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, uid, title, body, tpl string
			var read bool
			var created time.Time
			if err := rows.Scan(&id, &uid, &title, &body, &tpl, &read, &created); err != nil {
				continue
			}
			items = append(items, map[string]any{
				"id": id, "userId": uid, "title": title, "body": body, "template": tpl,
				"read": read, "createdAt": created.UTC().Format(time.RFC3339),
				"broadcast": uid == "__broadcast__" || uid == "broadcast" || uid == "",
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /v1/notifications/inbox/{id}/read", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		_, _ = pool.Exec(r.Context(), `UPDATE inbox SET read=TRUE WHERE id=$1`, id)
		httpx.WriteJSON(w, 200, map[string]any{"ok": true})
	})

	mux.HandleFunc("POST /v1/notifications/send", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			Template  string         `json:"template"`
			Channel   string         `json:"channel"` // email | sms | push
			Recipient string         `json:"recipient"`
			UserID    string         `json:"userId"`
			Title     string         `json:"title"`
			Data      map[string]any `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Template == "" {
			httpx.WriteError(w, 400, "validation_error", "template gerekli", rid)
			return
		}
		if body.Channel == "" {
			body.Channel = "email"
		}
		tpl, ok := templates[body.Template]
		if !ok {
			tpl = body.Template
		}
		msg := tpl
		for k, v := range body.Data {
			msg = strings.ReplaceAll(msg, "{{"+k+"}}", fmt.Sprint(v))
		}
		title := body.Title
		if title == "" {
			title = templateTitles[body.Template]
		}
		if title == "" {
			title = body.Template
		}
		if t, ok := body.Data["title"].(string); ok && t != "" && body.Title == "" {
			title = t
		}

		status := "queued"
		if body.Channel == "email" {
			to := body.Recipient
			if to == "" {
				to = "customer@example.com"
			}
			err := sendMail(smtpHost+":"+smtpPort, from, to, title, msg)
			if err != nil {
				status = "failed:" + err.Error()
				log.Error("email_failed", map[string]any{"error": err.Error()})
			} else {
				status = "sent"
			}
		} else if body.Channel == "sms" {
			status = sendSMS(log, body.Recipient, msg)
		} else if body.Channel == "push" {
			status = "push_queued"
		} else {
			status = "unknown_channel"
		}

		id := uuid.NewString()
		_, _ = pool.Exec(r.Context(), `
INSERT INTO notification_logs (id, channel, template, recipient, body, status) VALUES ($1,$2,$3,$4,$5,$6)
`, id, body.Channel, body.Template, body.Recipient, msg, status)

		inboxID := uuid.NewString()
		userID := strings.TrimSpace(body.UserID)
		if userID == "" {
			userID = strings.TrimSpace(body.Recipient)
		}
		isBroadcast := userID == "" || strings.EqualFold(userID, "broadcast") || userID == "*"
		inboxUser := userID
		if isBroadcast {
			inboxUser = "__broadcast__"
		}
		_, _ = pool.Exec(r.Context(), `
INSERT INTO inbox (id, user_id, title, body, template, read) VALUES ($1,$2,$3,$4,$5,FALSE)
`, inboxID, inboxUser, title, msg, body.Template)

		payload := map[string]any{
			"event": "notification",
			"data": map[string]any{
				"id": inboxID, "title": title, "body": msg, "template": body.Template,
				"createdAt": time.Now().UTC().Format(time.RFC3339),
				"broadcast": isBroadcast,
			},
		}
		if isBroadcast {
			payload["userId"] = ""
			payload["broadcast"] = true
		} else {
			payload["userId"] = userID
		}
		go pushRealtime(realtimeURL, realtimeSecret, payload, log)

		httpx.WriteJSON(w, 200, map[string]any{"id": id, "inboxId": inboxID, "status": status, "body": msg, "title": title, "broadcast": isBroadcast})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func pushRealtime(base, secret string, payload map[string]any, log *logging.Logger) {
	if base == "" {
		return
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, base+"/broadcast", bytes.NewReader(b))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Secret", secret)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Info("realtime_push_skip", map[string]any{"error": err.Error()})
		return
	}
	resp.Body.Close()
}

func sendMail(addr, from, to, subject, body string) error {
	msg := []byte("To: " + to + "\r\n" +
		"From: " + from + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body + "\r\n")
	return smtp.SendMail(addr, nil, from, []string{to}, msg)
}

func sendSMS(log *logging.Logger, recipient, body string) string {
	provider := strings.ToLower(config.Getenv("SMS_PROVIDER", "stub"))
	to := recipient
	if to == "" {
		to = config.Getenv("SMS_DEFAULT_TO", "")
	}
	switch provider {
	case "netgsm":
		user := config.Getenv("NETGSM_USER", "")
		pass := config.Getenv("NETGSM_PASS", "")
		header := config.Getenv("NETGSM_HEADER", "ADBTICARET")
		if user == "" || pass == "" {
			log.Info("sms_netgsm_stub", map[string]any{"reason": "credentials_missing", "to": to, "body": body})
			return "sms_stub_logged"
		}
		log.Info("sms_netgsm_ready", map[string]any{"header": header, "to": to, "len": len(body)})
		return "sms_queued_stub"
	default:
		log.Info("sms_stub", map[string]any{"provider": provider, "to": to, "body": body})
		return "sms_stub_logged"
	}
}
