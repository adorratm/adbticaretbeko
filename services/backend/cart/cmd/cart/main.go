package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type CartItem struct {
	VariantID string `json:"variantId"`
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	SKU       string `json:"sku"`
	Qty       int    `json:"qty"`
	UnitPrice int64  `json:"unitPrice"`
}

type Cart struct {
	ID         string     `json:"id"`
	Customer   string     `json:"customerId,omitempty"`
	CouponCode string     `json:"couponCode,omitempty"`
	Items      []CartItem `json:"items"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

func main() {
	log := logging.New("cart")
	addr := config.Getenv("HTTP_ADDR", ":8087")
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr(config.Getenv("REDIS_URL", "redis://localhost:6379/0"))})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Error("redis_failed", map[string]any{"error": err.Error()})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /v1/cart/{cartId}", func(w http.ResponseWriter, r *http.Request) {
		c, _ := load(r.Context(), rdb, r.PathValue("cartId"))
		httpx.WriteJSON(w, 200, c)
	})
	mux.HandleFunc("POST /v1/cart", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			CustomerID string `json:"customerId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		id := "guest:" + uuid.NewString()
		if body.CustomerID != "" {
			id = "customer:" + body.CustomerID
		}
		c := Cart{ID: id, Customer: body.CustomerID, Items: []CartItem{}, UpdatedAt: time.Now().UTC()}
		_ = save(r.Context(), rdb, &c)
		httpx.WriteJSON(w, 201, c)
	})
	mux.HandleFunc("POST /v1/cart/{cartId}/items", func(w http.ResponseWriter, r *http.Request) {
		c, _ := load(r.Context(), rdb, r.PathValue("cartId"))
		var item CartItem
		_ = json.NewDecoder(r.Body).Decode(&item)
		if item.Qty <= 0 {
			item.Qty = 1
		}
		found := false
		for i := range c.Items {
			if c.Items[i].VariantID == item.VariantID {
				c.Items[i].Qty += item.Qty
				found = true
				break
			}
		}
		if !found {
			c.Items = append(c.Items, item)
		}
		c.UpdatedAt = time.Now().UTC()
		_ = save(r.Context(), rdb, c)
		httpx.WriteJSON(w, 200, c)
	})
	mux.HandleFunc("DELETE /v1/cart/{cartId}/items/{variantId}", func(w http.ResponseWriter, r *http.Request) {
		c, _ := load(r.Context(), rdb, r.PathValue("cartId"))
		vid := r.PathValue("variantId")
		out := c.Items[:0]
		for _, it := range c.Items {
			if it.VariantID != vid {
				out = append(out, it)
			}
		}
		c.Items = out
		c.UpdatedAt = time.Now().UTC()
		_ = save(r.Context(), rdb, c)
		httpx.WriteJSON(w, 200, c)
	})
	mux.HandleFunc("PATCH /v1/cart/{cartId}/items/{variantId}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		c, _ := load(r.Context(), rdb, r.PathValue("cartId"))
		vid := r.PathValue("variantId")
		var body struct {
			Qty int `json:"qty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		if body.Qty <= 0 {
			out := c.Items[:0]
			for _, it := range c.Items {
				if it.VariantID != vid {
					out = append(out, it)
				}
			}
			c.Items = out
		} else {
			found := false
			for i := range c.Items {
				if c.Items[i].VariantID == vid {
					c.Items[i].Qty = body.Qty
					found = true
					break
				}
			}
			if !found {
				httpx.WriteError(w, 404, "not_found", "ürün sepette yok", rid)
				return
			}
		}
		c.UpdatedAt = time.Now().UTC()
		_ = save(r.Context(), rdb, c)
		httpx.WriteJSON(w, 200, c)
	})
	mux.HandleFunc("PUT /v1/cart/{cartId}/coupon", func(w http.ResponseWriter, r *http.Request) {
		c, _ := load(r.Context(), rdb, r.PathValue("cartId"))
		var body struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		c.CouponCode = strings.ToUpper(strings.TrimSpace(body.Code))
		c.UpdatedAt = time.Now().UTC()
		_ = save(r.Context(), rdb, c)
		httpx.WriteJSON(w, 200, c)
	})
	mux.HandleFunc("POST /v1/cart/merge", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			GuestCartID string `json:"guestCartId"`
			CustomerID  string `json:"customerId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		body.GuestCartID = strings.TrimSpace(body.GuestCartID)
		body.CustomerID = strings.TrimSpace(body.CustomerID)
		if body.GuestCartID == "" || body.CustomerID == "" {
			httpx.WriteError(w, 400, "validation_error", "guestCartId ve customerId gerekli", rid)
			return
		}
		if !strings.HasPrefix(body.GuestCartID, "guest:") {
			httpx.WriteError(w, 400, "validation_error", "yalnızca misafir sepeti birleştirilebilir", rid)
			return
		}
		guest, _ := load(r.Context(), rdb, body.GuestCartID)
		customerID := "customer:" + body.CustomerID
		customer, _ := load(r.Context(), rdb, customerID)
		customer.ID = customerID
		customer.Customer = body.CustomerID
		for _, g := range guest.Items {
			found := false
			for i := range customer.Items {
				if customer.Items[i].VariantID == g.VariantID {
					customer.Items[i].Qty += g.Qty
					if customer.Items[i].UnitPrice <= 0 && g.UnitPrice > 0 {
						customer.Items[i].UnitPrice = g.UnitPrice
					}
					if customer.Items[i].Name == "" {
						customer.Items[i].Name = g.Name
					}
					if customer.Items[i].SKU == "" {
						customer.Items[i].SKU = g.SKU
					}
					found = true
					break
				}
			}
			if !found {
				customer.Items = append(customer.Items, g)
			}
		}
		if customer.CouponCode == "" && guest.CouponCode != "" {
			customer.CouponCode = guest.CouponCode
		}
		customer.UpdatedAt = time.Now().UTC()
		_ = save(r.Context(), rdb, customer)
		_ = rdb.Del(r.Context(), "cart:"+body.GuestCartID).Err()
		httpx.WriteJSON(w, 200, customer)
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func load(ctx context.Context, rdb *redis.Client, id string) (*Cart, error) {
	b, err := rdb.Get(ctx, "cart:"+id).Bytes()
	if err != nil {
		return &Cart{ID: id, Items: []CartItem{}, UpdatedAt: time.Now().UTC()}, nil
	}
	var c Cart
	_ = json.Unmarshal(b, &c)
	if c.Items == nil {
		c.Items = []CartItem{}
	}
	return &c, nil
}

func save(ctx context.Context, rdb *redis.Client, c *Cart) error {
	b, _ := json.Marshal(c)
	return rdb.Set(ctx, "cart:"+c.ID, b, 7*24*time.Hour).Err()
}

func redisAddr(url string) string {
	// redis://localhost:6379/0 -> localhost:6379
	u := url
	if len(u) > 8 && u[:8] == "redis://" {
		u = u[8:]
	}
	for i := 0; i < len(u); i++ {
		if u[i] == '/' {
			return u[:i]
		}
	}
	return u
}
