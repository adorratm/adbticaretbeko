package main

import (
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
)

type route struct {
	prefix string
	target string
	strip  string
}

type rateBucket struct {
	mu     sync.Mutex
	tokens float64
	last   time.Time
}

type rateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*rateBucket
	rate     float64 // tokens per second
	burst    float64
	disabled bool
}

func newRateLimiter(rps, burst float64) *rateLimiter {
	if rps <= 0 {
		return &rateLimiter{disabled: true}
	}
	if burst < 1 {
		burst = rps
	}
	return &rateLimiter{
		buckets: make(map[string]*rateBucket),
		rate:    rps,
		burst:   burst,
	}
}

func (rl *rateLimiter) allow(key string) bool {
	if rl == nil || rl.disabled {
		return true
	}
	now := time.Now()
	rl.mu.Lock()
	b, ok := rl.buckets[key]
	if !ok {
		b = &rateBucket{tokens: rl.burst, last: now}
		rl.buckets[key] = b
	}
	rl.mu.Unlock()

	b.mu.Lock()
	defer b.mu.Unlock()
	elapsed := now.Sub(b.last).Seconds()
	b.last = now
	b.tokens += elapsed * rl.rate
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func main() {
	log := logging.New("gateway")
	addr := config.Getenv("HTTP_ADDR", ":8080")
	rps, _ := strconv.ParseFloat(config.Getenv("GATEWAY_RATE_LIMIT_RPS", "40"), 64)
	burst, _ := strconv.ParseFloat(config.Getenv("GATEWAY_RATE_LIMIT_BURST", "80"), 64)
	limiter := newRateLimiter(rps, burst)

	routes := []route{
		{prefix: "/api/v1/auth", target: config.Getenv("AUTH_URL", "http://localhost:8081"), strip: "/api"},
		{prefix: "/api/v1/admin/allowed-admins", target: config.Getenv("AUTH_URL", "http://localhost:8081"), strip: "/api"},
		{prefix: "/api/v1/admin/users", target: config.Getenv("AUTH_URL", "http://localhost:8081"), strip: "/api"},
		{prefix: "/api/v1/customers", target: config.Getenv("CUSTOMER_URL", "http://localhost:8082"), strip: "/api"},
		{prefix: "/api/v1/products", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/brands", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/categories", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/admin/products", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/admin/brands", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/admin/categories", target: config.Getenv("CATALOG_URL", "http://localhost:8083"), strip: "/api"},
		{prefix: "/api/v1/cms", target: config.Getenv("CMS_URL", "http://localhost:8100"), strip: "/api"},
		{prefix: "/api/v1/admin/cms", target: config.Getenv("CMS_URL", "http://localhost:8100"), strip: "/api"},
		{prefix: "/api/v1/trade-ins", target: config.Getenv("RETAIL_URL", "http://localhost:8101"), strip: "/api"},
		{prefix: "/api/v1/bundles", target: config.Getenv("RETAIL_URL", "http://localhost:8101"), strip: "/api"},
		{prefix: "/api/v1/storage-reservations", target: config.Getenv("RETAIL_URL", "http://localhost:8101"), strip: "/api"},
		{prefix: "/api/v1/warehouses", target: config.Getenv("INVENTORY_URL", "http://localhost:8084"), strip: "/api"},
		{prefix: "/api/v1/inventory", target: config.Getenv("INVENTORY_URL", "http://localhost:8084"), strip: "/api"},
		{prefix: "/api/v1/pricing", target: config.Getenv("PRICING_URL", "http://localhost:8085"), strip: "/api"},
		{prefix: "/api/v1/promotions", target: config.Getenv("PROMOTION_URL", "http://localhost:8086"), strip: "/api"},
		{prefix: "/api/v1/cart", target: config.Getenv("CART_URL", "http://localhost:8087"), strip: "/api"},
		{prefix: "/api/v1/checkout", target: config.Getenv("CHECKOUT_URL", "http://localhost:8088"), strip: "/api"},
		{prefix: "/api/v1/orders", target: config.Getenv("ORDER_URL", "http://localhost:8089"), strip: "/api"},
		{prefix: "/api/v1/service-teams", target: config.Getenv("ORDER_URL", "http://localhost:8089"), strip: "/api"},
		{prefix: "/api/v1/service-routes", target: config.Getenv("ORDER_URL", "http://localhost:8089"), strip: "/api"},
		{prefix: "/api/v1/payments", target: config.Getenv("PAYMENT_URL", "http://localhost:8090"), strip: "/api"},
		{prefix: "/api/v1/shipments", target: config.Getenv("SHIPMENT_URL", "http://localhost:8091"), strip: "/api"},
		{prefix: "/api/v1/notifications", target: config.Getenv("NOTIFICATION_URL", "http://localhost:8092"), strip: "/api"},
		{prefix: "/api/v1/search", target: config.Getenv("SEARCH_URL", "http://localhost:8093"), strip: "/api"},
		{prefix: "/api/v1/reviews", target: config.Getenv("REVIEW_URL", "http://localhost:8094"), strip: "/api"},
		{prefix: "/api/v1/wishlist", target: config.Getenv("WISHLIST_URL", "http://localhost:8095"), strip: "/api"},
		{prefix: "/api/v1/marketplace", target: config.Getenv("MARKETPLACE_URL", "http://localhost:8096"), strip: "/api"},
		{prefix: "/api/v1/accounting", target: config.Getenv("ACCOUNTING_URL", "http://localhost:8097"), strip: "/api"},
		{prefix: "/api/v1/reports", target: config.Getenv("REPORTING_URL", "http://localhost:8098"), strip: "/api"},
		{prefix: "/api/v1/worker", target: config.Getenv("WORKER_URL", "http://localhost:8099"), strip: "/api"},
	}

	client := &http.Client{Timeout: 30 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestID(r)
		w.Header().Set("X-Request-ID", rid)

		ip := clientIP(r)
		if !limiter.allow(ip) {
			httpx.WriteError(w, http.StatusTooManyRequests, "rate_limited", "çok fazla istek", rid)
			return
		}

		var matched *route
		for i := range routes {
			if strings.HasPrefix(r.URL.Path, routes[i].prefix) {
				matched = &routes[i]
				break
			}
		}
		if matched == nil {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "route bulunamadı", rid)
			return
		}

		targetPath := r.URL.Path
		if matched.strip != "" {
			targetPath = strings.TrimPrefix(targetPath, matched.strip)
		}
		u, err := url.Parse(matched.target)
		if err != nil {
			httpx.WriteError(w, http.StatusBadGateway, "bad_gateway", "hedef URL geçersiz", rid)
			return
		}
		u.Path = singleJoin(u.Path, targetPath)
		u.RawQuery = r.URL.RawQuery

		proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, u.String(), r.Body)
		if err != nil {
			httpx.WriteError(w, http.StatusBadGateway, "bad_gateway", "proxy isteği oluşturulamadı", rid)
			return
		}
		copyHeaders(proxyReq.Header, r.Header)
		proxyReq.Header.Set("X-Request-ID", rid)

		resp, err := client.Do(proxyReq)
		if err != nil {
			log.Error("proxy_error", map[string]any{"error": err.Error(), "target": u.String()})
			httpx.WriteError(w, http.StatusBadGateway, "bad_gateway", "downstream erişilemedi", rid)
			return
		}
		defer resp.Body.Close()

		for k, vv := range resp.Header {
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.Header().Set("X-Request-ID", rid)
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	})

	log.Info("rate_limit", map[string]any{"rps": rps, "burst": burst})
	handler := httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux)))
	if err := httpx.ListenAndServe(addr, handler, log); err != nil && err != http.ErrServerClosed {
		log.Error("server_failed", map[string]any{"error": err.Error()})
	}
}

func copyHeaders(dst, src http.Header) {
	for k, vv := range src {
		if strings.EqualFold(k, "Host") {
			continue
		}
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

func singleJoin(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}
