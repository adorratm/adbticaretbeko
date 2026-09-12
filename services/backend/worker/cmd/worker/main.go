package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/redis/go-redis/v9"
)

func main() {
	log := logging.New("worker")
	addr := config.Getenv("HTTP_ADDR", ":8099")
	redisURL := config.Getenv("REDIS_URL", "redis://localhost:6379/0")
	notifURL := config.Getenv("NOTIFICATION_URL", "http://localhost:8092")
	idleHours := config.GetenvInt("ABANDONED_CART_HOURS", 24)

	rdb := redis.NewClient(&redis.Options{Addr: redisAddr(redisURL)})
	client := &http.Client{Timeout: 10 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/worker/abandoned-carts", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		hours := idleHours
		if v := r.URL.Query().Get("idleHours"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				hours = n
			}
		}
		keys, err := rdb.Keys(ctx, "cart:*").Result()
		if err != nil {
			httpx.WriteError(w, 500, "redis_error", err.Error(), httpx.RequestIDFromContext(ctx))
			return
		}
		cutoff := time.Now().UTC().Add(-time.Duration(hours) * time.Hour)
		items := []map[string]any{}
		for _, key := range keys {
			raw, err := rdb.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}
			var cart struct {
				ID         string    `json:"id"`
				Customer   string    `json:"customerId"`
				UpdatedAt  time.Time `json:"updatedAt"`
				Items      []any     `json:"items"`
			}
			if err := json.Unmarshal(raw, &cart); err != nil {
				continue
			}
			if len(cart.Items) == 0 || cart.UpdatedAt.After(cutoff) {
				continue
			}
			idle := int(time.Since(cart.UpdatedAt).Hours())
			items = append(items, map[string]any{
				"cartId": cart.ID, "customerId": cart.Customer, "itemCount": len(cart.Items),
				"updatedAt": cart.UpdatedAt.UTC().Format(time.RFC3339), "idleHours": idle,
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "count": len(items), "idleHours": hours})
	})
	mux.HandleFunc("POST /v1/worker/abandoned-carts/run", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		ctx := r.Context()
		keys, err := rdb.Keys(ctx, "cart:*").Result()
		if err != nil {
			httpx.WriteError(w, 500, "redis_error", err.Error(), rid)
			return
		}
		cutoff := time.Now().UTC().Add(-time.Duration(idleHours) * time.Hour)
		reminded := 0
		checked := 0
		for _, key := range keys {
			checked++
			raw, err := rdb.Get(ctx, key).Bytes()
			if err != nil {
				continue
			}
			var cart struct {
				ID        string    `json:"id"`
				UpdatedAt time.Time `json:"updatedAt"`
				Items     []any     `json:"items"`
			}
			if err := json.Unmarshal(raw, &cart); err != nil {
				continue
			}
			if len(cart.Items) == 0 || cart.UpdatedAt.After(cutoff) {
				continue
			}
			payload, _ := json.Marshal(map[string]any{
				"template":  "cart.abandoned",
				"channel":   "email",
				"recipient": "customer@example.com",
				"data": map[string]any{
					"cartId": cart.ID,
					"items":  len(cart.Items),
				},
			})
			resp, err := client.Post(notifURL+"/v1/notifications/send", "application/json", bytes.NewReader(payload))
			if err == nil {
				resp.Body.Close()
				reminded++
			}
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"ok": true, "checked": checked, "reminded": reminded, "idleHours": idleHours,
		})
	})

	go func() {
		t := time.NewTicker(30 * time.Minute)
		defer t.Stop()
		for range t.C {
			req, _ := http.NewRequest(http.MethodPost, "http://127.0.0.1"+addr+"/v1/worker/abandoned-carts/run", nil)
			resp, err := client.Do(req)
			if err == nil {
				resp.Body.Close()
			}
			log.Info("abandoned_cart_tick", map[string]any{"at": time.Now().UTC().Format(time.RFC3339)})
		}
	}()

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func redisAddr(url string) string {
	u := url
	if strings.HasPrefix(u, "redis://") {
		u = u[8:]
	}
	if i := strings.Index(u, "/"); i >= 0 {
		return u[:i]
	}
	return u
}
