package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
)

func main() {
	log := logging.New("checkout")
	addr := config.Getenv("HTTP_ADDR", ":8088")
	cartURL := config.Getenv("CART_URL", "http://localhost:8087")
	inventoryURL := config.Getenv("INVENTORY_URL", "http://localhost:8084")
	orderURL := config.Getenv("ORDER_URL", "http://localhost:8089")
	paymentURL := config.Getenv("PAYMENT_URL", "http://localhost:8090")
	promoURL := config.Getenv("PROMOTION_URL", "http://localhost:8086")
	client := &http.Client{Timeout: 20 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("POST /v1/checkout/preview", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			CartID string `json:"cartId"`
			Code   string `json:"code"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		cart, err := getJSON(client, cartURL+"/v1/cart/"+body.CartID)
		if err != nil {
			httpx.WriteError(w, 400, "cart_error", "sepet okunamadı", rid)
			return
		}
		items, _ := cart["items"].([]any)
		var subtotal int64
		for _, raw := range items {
			it, _ := raw.(map[string]any)
			qty := int(asFloat(it["qty"]))
			price := int64(asFloat(it["unitPrice"]))
			subtotal += price * int64(qty)
		}
		coupon := body.Code
		if coupon == "" {
			if c, ok := cart["couponCode"].(string); ok {
				coupon = c
			}
		}
		discount := int64(0)
		couponTitle := ""
		if strings.TrimSpace(coupon) != "" {
			vres, err := postJSON(client, promoURL+"/v1/promotions/validate", map[string]any{
				"code": coupon, "subtotal": subtotal,
			})
			if err == nil {
				discount = int64(asFloat(vres["discount"]))
				if t, ok := vres["title"].(string); ok {
					couponTitle = t
				}
			}
		}
		total := subtotal - discount
		if total < 0 {
			total = 0
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"cartId": body.CartID, "subtotal": subtotal, "shipping": 0, "discount": discount,
			"total": total, "currency": "TRY", "couponCode": coupon, "couponTitle": couponTitle,
		})
	})
	mux.HandleFunc("POST /v1/checkout/create", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			CartID        string `json:"cartId"`
			CustomerID    string `json:"customerId"`
			CustomerName  string `json:"customerName"`
			CustomerPhone string `json:"customerPhone"`
			CustomerEmail string `json:"customerEmail"`
			District      string `json:"district"`
			AddressLine   string `json:"addressLine"`
			City          string `json:"city"`
			BillingName   string `json:"billingName"`
			TaxNo         string `json:"taxNo"`
			BillingAddress string `json:"billingAddress"`
			PaymentMethod string `json:"paymentMethod"`
			CouponCode    string `json:"couponCode"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		cart, err := getJSON(client, cartURL+"/v1/cart/"+body.CartID)
		if err != nil {
			httpx.WriteError(w, 400, "cart_error", "sepet okunamadı", rid)
			return
		}
		checkoutID := uuid.NewString()
		items, _ := cart["items"].([]any)
		if len(items) == 0 {
			httpx.WriteError(w, 400, "empty_cart", "sepet boş", rid)
			return
		}
		var subtotal int64
		for _, raw := range items {
			it, _ := raw.(map[string]any)
			subtotal += int64(asFloat(it["unitPrice"])) * int64(asFloat(it["qty"]))
		}
		coupon := body.CouponCode
		if coupon == "" {
			if c, ok := cart["couponCode"].(string); ok {
				coupon = c
			}
		}
		discount := int64(0)
		if strings.TrimSpace(coupon) != "" {
			vres, err := postJSON(client, promoURL+"/v1/promotions/validate", map[string]any{
				"code": coupon, "subtotal": subtotal,
			})
			if err != nil {
				httpx.WriteError(w, 400, "coupon_invalid", "kupon geçersiz", rid)
				return
			}
			discount = int64(asFloat(vres["discount"]))
		}
		for _, raw := range items {
			it, _ := raw.(map[string]any)
			vid, _ := it["variantId"].(string)
			qty := int(asFloat(it["qty"]))
			payload, _ := json.Marshal(map[string]any{"variantId": vid, "qty": qty, "checkoutId": checkoutID})
			resp, err := client.Post(inventoryURL+"/v1/inventory/reserve", "application/json", bytes.NewReader(payload))
			if err != nil || (resp != nil && resp.StatusCode >= 300) {
				if resp != nil {
					resp.Body.Close()
				}
				httpx.WriteError(w, 409, "reserve_failed", "stok rezervasyonu başarısız", rid)
				return
			}
			resp.Body.Close()
		}
		if body.PaymentMethod == "" {
			body.PaymentMethod = "CARD"
		}
		district := body.District
		if district == "" && body.City != "" {
			district = body.City
		}
		// Apply discount by reducing last item unit price snapshot via synthetic line adjustment in total:
		// Order service sums item prices; we pass adjusted items when discount > 0.
		adjusted := items
		if discount > 0 && len(items) > 0 {
			adjusted = make([]any, len(items))
			copy(adjusted, items)
			first, _ := adjusted[0].(map[string]any)
			clone := map[string]any{}
			for k, v := range first {
				clone[k] = v
			}
			unit := int64(asFloat(clone["unitPrice"]))
			qty := int64(asFloat(clone["qty"]))
			line := unit * qty
			if line > discount {
				// reduce unit price so line drops by discount
				newLine := line - discount
				if qty > 0 {
					clone["unitPrice"] = newLine / qty
				}
			} else {
				clone["unitPrice"] = 0
			}
			adjusted[0] = clone
		}
		orderPayload, _ := json.Marshal(map[string]any{
			"cartId": body.CartID, "customerId": body.CustomerID, "checkoutId": checkoutID, "items": adjusted,
			"customerName": body.CustomerName, "customerPhone": body.CustomerPhone, "customerEmail": body.CustomerEmail,
			"district": district, "addressLine": body.AddressLine, "city": body.City,
			"billingName": body.BillingName, "taxNo": body.TaxNo, "billingAddress": body.BillingAddress,
			"deliveryType": "YETKILI_SERVIS", "paymentMethod": body.PaymentMethod,
		})
		oresp, err := client.Post(orderURL+"/v1/orders", "application/json", bytes.NewReader(orderPayload))
		if err != nil {
			httpx.WriteError(w, 502, "order_error", "sipariş oluşturulamadı", rid)
			return
		}
		defer oresp.Body.Close()
		ob, _ := io.ReadAll(oresp.Body)
		if oresp.StatusCode >= 300 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(oresp.StatusCode)
			_, _ = w.Write(ob)
			return
		}
		var order map[string]any
		_ = json.Unmarshal(ob, &order)
		orderID, _ := order["id"].(string)
		total := int64(asFloat(order["total"]))
		if strings.TrimSpace(coupon) != "" && discount > 0 {
			_, _ = postJSON(client, promoURL+"/v1/promotions/redeem", map[string]any{"code": coupon})
		}
		payPayload, _ := json.Marshal(map[string]any{
			"orderId": orderID, "amount": total, "currency": "TRY", "customerId": body.CustomerID,
		})
		presp, err := client.Post(paymentURL+"/v1/payments", "application/json", bytes.NewReader(payPayload))
		payment := map[string]any{}
		if err == nil && presp != nil {
			defer presp.Body.Close()
			pb, _ := io.ReadAll(presp.Body)
			_ = json.Unmarshal(pb, &payment)
		}
		httpx.WriteJSON(w, 201, map[string]any{
			"id": orderID, "status": order["status"], "total": total, "currency": "TRY",
			"discount": discount, "couponCode": coupon, "payment": payment,
		})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func getJSON(client *http.Client, url string) (map[string]any, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out map[string]any
	err = json.NewDecoder(resp.Body).Decode(&out)
	return out, err
}

func postJSON(client *http.Client, url string, body map[string]any) (map[string]any, error) {
	raw, _ := json.Marshal(body)
	resp, err := client.Post(url, "application/json", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, io.EOF
	}
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	return out, nil
}

func asFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}
