package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/authjwt"
	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var allowedTransitions = map[string][]string{
	"PAYMENT_PENDING": {"PAID", "CANCELLED"},
	"PAID":            {"PROCESSING", "CANCELLED"},
	"PROCESSING":      {"PACKED", "MONTAJ_BEKLIYOR", "CANCELLED"},
	"PACKED":          {"SHIPPED", "MONTAJ_BEKLIYOR"},
	"SHIPPED":         {"DELIVERED", "MONTAJ_BEKLIYOR"},
	"MONTAJ_BEKLIYOR": {"MONTAJ_RANDEVU", "KESIF_BEKLIYOR", "CANCELLED"},
	"KESIF_BEKLIYOR":  {"MONTAJ_RANDEVU", "CANCELLED"},
	"MONTAJ_RANDEVU":  {"MONTAJ_YOLDA", "MONTAJ_TAMAMLANDI"},
	"MONTAJ_YOLDA":    {"MONTAJ_TAMAMLANDI", "MONTAJ_RANDEVU"},
	"MONTAJ_TAMAMLANDI": {"DELIVERED"},
	"DELIVERED":       {},
	"CANCELLED":       {},
}

func canTransition(from, to string) bool {
	for _, s := range allowedTransitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

func requireAdmin(r *http.Request, jwtSecret, appEnv string) bool {
	if r.Header.Get("X-Dev-Admin") == "1" || r.Header.Get("X-Internal-Service") != "" {
		return true
	}
	if appEnv == "development" || appEnv == "dev" || appEnv == "" {
		return true
	}
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	claims, err := authjwt.ParseAccessToken(jwtSecret, strings.TrimPrefix(auth, "Bearer "))
	if err != nil {
		return false
	}
	for _, role := range claims.Roles {
		if role == "ADMIN" || role == "SUPER_ADMIN" || role == "ORDER_MANAGER" {
			return true
		}
	}
	return false
}

func requireAuthOrAdmin(r *http.Request, jwtSecret, appEnv string) bool {
	if requireAdmin(r, jwtSecret, appEnv) {
		return true
	}
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return false
	}
	_, err := authjwt.ParseAccessToken(jwtSecret, strings.TrimPrefix(auth, "Bearer "))
	return err == nil
}

func main() {
	log := logging.New("order")
	addr := config.Getenv("HTTP_ADDR", ":8089")
	dbURL := config.Getenv("DATABASE_URL", "postgres://adb:adb_dev_password@127.0.0.1:5433/adb_ticaret?sslmode=disable")
	shipmentURL := config.Getenv("SHIPMENT_URL", "http://localhost:8091")
	notifURL := config.Getenv("NOTIFICATION_URL", "http://localhost:8092")
	jwtSecret := config.Getenv("JWT_SECRET", "dev-jwt-access-secret-change-me")
	appEnv := config.Getenv("APP_ENV", "development")
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(dbURL)
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, _ = conn.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS "order"`)
		_, err := conn.Exec(ctx, `SET search_path TO "order"`)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Error("db_connect_failed", map[string]any{"error": err.Error()})
		return
	}
	defer pool.Close()
	_, _ = pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  customer_id TEXT,
  checkout_id TEXT,
  status TEXT NOT NULL,
  total_kurus BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  customer_name TEXT,
  customer_phone TEXT,
  district TEXT,
  delivery_type TEXT DEFAULT 'YETKILI_SERVIS',
  montage_status TEXT,
  montage_note TEXT,
  service_ref TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'YETKILI_SERVIS';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS montage_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS montage_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_no TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address TEXT;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  unit_price BIGINT NOT NULL,
  quantity INT NOT NULL,
  serial_no TEXT
);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS serial_no TEXT;

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_teams (
  id UUID PRIMARY KEY,
  warehouse_code TEXT NOT NULL,
  name TEXT NOT NULL,
  technician TEXT DEFAULT '',
  vehicle_plate TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_routes (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES service_teams(id) ON DELETE SET NULL,
  warehouse_code TEXT NOT NULL,
  title TEXT NOT NULL,
  district_hint TEXT DEFAULT '',
  planned_stops INT NOT NULL DEFAULT 0,
  done_stops INT NOT NULL DEFAULT 0,
  next_stop TEXT DEFAULT '',
  route_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`)

	client := &http.Client{Timeout: 15 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())

	mux.HandleFunc("POST /v1/orders", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		var body struct {
			CartID          string `json:"cartId"`
			CustomerID      string `json:"customerId"`
			CheckoutID      string `json:"checkoutId"`
			CustomerName    string `json:"customerName"`
			CustomerPhone   string `json:"customerPhone"`
			CustomerEmail   string `json:"customerEmail"`
			District        string `json:"district"`
			AddressLine     string `json:"addressLine"`
			City            string `json:"city"`
			BillingName     string `json:"billingName"`
			TaxNo           string `json:"taxNo"`
			BillingAddress  string `json:"billingAddress"`
			DeliveryType    string `json:"deliveryType"`
			PaymentMethod   string `json:"paymentMethod"`
			Items           []struct {
				VariantID string `json:"variantId"`
				ProductID string `json:"productId"`
				Name      string `json:"name"`
				SKU       string `json:"sku"`
				Qty       int    `json:"qty"`
				UnitPrice int64  `json:"unitPrice"`
			} `json:"items"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "invalid_json", "geçersiz gövde", rid)
			return
		}
		var total int64
		for _, it := range body.Items {
			total += it.UnitPrice * int64(it.Qty)
		}
		if body.DeliveryType == "" {
			body.DeliveryType = "YETKILI_SERVIS"
		}
		if body.BillingName == "" {
			body.BillingName = body.CustomerName
		}
		if body.BillingAddress == "" {
			parts := []string{}
			if body.AddressLine != "" {
				parts = append(parts, body.AddressLine)
			}
			loc := strings.TrimSpace(strings.Trim(body.District+" / "+body.City, " /"))
			if loc != "" {
				parts = append(parts, loc)
			}
			body.BillingAddress = strings.Join(parts, ", ")
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO orders (id, customer_id, checkout_id, status, total_kurus, customer_name, customer_phone, customer_email,
  district, address_line, city, billing_name, tax_no, billing_address, delivery_type, payment_method, montage_status)
VALUES ($1,$2,$3,'PAYMENT_PENDING',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
`, id, body.CustomerID, body.CheckoutID, total, body.CustomerName, body.CustomerPhone, body.CustomerEmail,
			body.District, body.AddressLine, body.City, body.BillingName, body.TaxNo, body.BillingAddress,
			body.DeliveryType, body.PaymentMethod, "BEKLEMEDE")
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "sipariş kaydı hatası", rid)
			return
		}
		for _, it := range body.Items {
			name := it.Name
			if name == "" {
				name = it.SKU
			}
			sku := it.SKU
			if sku == "" {
				sku = it.VariantID
			}
			_, _ = pool.Exec(r.Context(), `
INSERT INTO order_items (id, order_id, product_name, sku, variant_id, unit_price, quantity)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`, uuid.NewString(), id, name, sku, it.VariantID, it.UnitPrice, it.Qty)
		}
		_, _ = pool.Exec(r.Context(), `
INSERT INTO order_status_history (id, order_id, from_status, to_status, note) VALUES ($1,$2,NULL,'PAYMENT_PENDING','created')
`, uuid.NewString(), id)
		httpx.WriteJSON(w, 201, map[string]any{"id": id, "status": "PAYMENT_PENDING", "total": total, "currency": "TRY"})
	})

	mux.HandleFunc("GET /v1/orders", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		status := r.URL.Query().Get("status")
		customerID := r.URL.Query().Get("customerId")
		if customerID == "" {
			if !requireAdmin(r, jwtSecret, appEnv) {
				httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
				return
			}
		} else if !requireAuthOrAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 401, "unauthorized", "token gerekli", rid)
			return
		}
		q := `
SELECT o.id, o.status, o.total_kurus, o.currency, COALESCE(o.customer_id,''), COALESCE(o.customer_name,''), COALESCE(o.customer_phone,''),
  COALESCE(o.district,''), COALESCE(o.city,''), COALESCE(o.delivery_type,''), COALESCE(o.montage_status,''), COALESCE(o.service_ref,''),
  COALESCE(o.payment_method,''), o.created_at
FROM orders o`
		args := []any{}
		where := []string{}
		if status != "" && status != "ALL" {
			args = append(args, status)
			where = append(where, "o.status = $"+strconv.Itoa(len(args)))
		}
		if customerID != "" {
			args = append(args, customerID)
			where = append(where, "o.customer_id = $"+strconv.Itoa(len(args)))
		}
		if len(where) > 0 {
			q += " WHERE " + strings.Join(where, " AND ")
		}
		q += ` ORDER BY o.created_at DESC LIMIT 100`
		rows, err := pool.Query(r.Context(), q, args...)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "liste hatası", httpx.RequestIDFromContext(r.Context()))
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, st, cur, custID, name, phone, district, city, dtype, mstatus, sref, pmeth string
			var total int64
			var created time.Time
			_ = rows.Scan(&id, &st, &total, &cur, &custID, &name, &phone, &district, &city, &dtype, &mstatus, &sref, &pmeth, &created)
			productName := ""
			_ = pool.QueryRow(r.Context(), `SELECT product_name FROM order_items WHERE order_id=$1 LIMIT 1`, id).Scan(&productName)
			items = append(items, map[string]any{
				"id": id, "status": st, "total": total, "currency": cur, "customerId": custID,
				"customerName": name, "customerPhone": phone, "district": district, "city": city,
				"deliveryType": dtype, "montageStatus": mstatus, "serviceRef": sref,
				"paymentMethod": pmeth, "productName": productName, "createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		counts := map[string]int{}
		crow, _ := pool.Query(r.Context(), `SELECT status, COUNT(*) FROM orders GROUP BY status`)
		if crow != nil {
			for crow.Next() {
				var s string
				var c int
				_ = crow.Scan(&s, &c)
				counts[s] = c
			}
			crow.Close()
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "counts": counts})
	})

	mux.HandleFunc("GET /v1/orders/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var status, cur, custID, name, phone, email, district, addr, city, billName, taxNo, billAddr, dtype, mstatus, sref, pmeth, note, checkoutID string
		var total int64
		var created time.Time
		err := pool.QueryRow(r.Context(), `
SELECT status, total_kurus, currency, COALESCE(customer_id,''), COALESCE(checkout_id,''),
  COALESCE(customer_name,''), COALESCE(customer_phone,''), COALESCE(customer_email,''),
  COALESCE(district,''), COALESCE(address_line,''), COALESCE(city,''),
  COALESCE(billing_name,''), COALESCE(tax_no,''), COALESCE(billing_address,''),
  COALESCE(delivery_type,''), COALESCE(montage_status,''), COALESCE(service_ref,''),
  COALESCE(payment_method,''), COALESCE(montage_note,''), created_at
FROM orders WHERE id=$1
`, id).Scan(&status, &total, &cur, &custID, &checkoutID, &name, &phone, &email, &district, &addr, &city,
			&billName, &taxNo, &billAddr, &dtype, &mstatus, &sref, &pmeth, &note, &created)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "sipariş yok", rid)
			return
		}
		irows, _ := pool.Query(r.Context(), `
SELECT id, product_name, sku, variant_id, unit_price, quantity, COALESCE(serial_no,'') FROM order_items WHERE order_id=$1
`, id)
		var orderItems []map[string]any
		if irows != nil {
			for irows.Next() {
				var iid, pname, sku, vid, serial string
				var price int64
				var qty int
				_ = irows.Scan(&iid, &pname, &sku, &vid, &price, &qty, &serial)
				orderItems = append(orderItems, map[string]any{
					"id": iid, "name": pname, "sku": sku, "variantId": vid, "unitPrice": price, "qty": qty, "serialNo": serial,
				})
			}
			irows.Close()
		}
		hrows, _ := pool.Query(r.Context(), `
SELECT COALESCE(from_status,''), to_status, COALESCE(note,''), created_at
FROM order_status_history WHERE order_id=$1 ORDER BY created_at ASC
`, id)
		var history []map[string]any
		if hrows != nil {
			for hrows.Next() {
				var from, to, hnote string
				var at time.Time
				_ = hrows.Scan(&from, &to, &hnote, &at)
				history = append(history, map[string]any{
					"from": from, "to": to, "note": hnote, "at": at.UTC().Format(time.RFC3339),
				})
			}
			hrows.Close()
		}
		httpx.WriteJSON(w, 200, map[string]any{
			"id": id, "status": status, "total": total, "currency": cur,
			"customerId": custID, "checkoutId": checkoutID,
			"customerName": name, "customerPhone": phone, "customerEmail": email,
			"district": district, "addressLine": addr, "city": city,
			"shippingAddress": map[string]any{
				"name": name, "phone": phone, "email": email,
				"line1": addr, "district": district, "city": city,
			},
			"billing": map[string]any{
				"name": billName, "taxNo": taxNo, "address": billAddr,
			},
			"deliveryType": dtype, "montageStatus": mstatus, "serviceRef": sref,
			"paymentMethod": pmeth, "montageNote": note, "items": orderItems,
			"history": history,
			"createdAt": created.UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("PATCH /v1/orders/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin veya internal servis gerekli", rid)
			return
		}
		id := r.PathValue("id")
		var body struct {
			Status        string `json:"status"`
			MontageStatus string `json:"montageStatus"`
			MontageNote   string `json:"montageNote"`
			ServiceRef    string `json:"serviceRef"`
			Note          string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
			httpx.WriteError(w, 400, "validation_error", "status gerekli", rid)
			return
		}
		var current string
		err := pool.QueryRow(r.Context(), `SELECT status FROM orders WHERE id=$1`, id).Scan(&current)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "sipariş yok", rid)
			return
		}
		if current != body.Status && !canTransition(current, body.Status) {
			httpx.WriteError(w, 409, "invalid_transition", current+" → "+body.Status+" geçersiz", rid)
			return
		}
		_, err = pool.Exec(r.Context(), `
UPDATE orders SET status=$2,
  montage_status=COALESCE(NULLIF($3,''), montage_status),
  montage_note=COALESCE(NULLIF($4,''), montage_note),
  service_ref=COALESCE(NULLIF($5,''), service_ref),
  updated_at=NOW()
WHERE id=$1
`, id, body.Status, body.MontageStatus, body.MontageNote, body.ServiceRef)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "güncelleme hatası", rid)
			return
		}
		_, _ = pool.Exec(r.Context(), `
INSERT INTO order_status_history (id, order_id, from_status, to_status, note) VALUES ($1,$2,$3,$4,$5)
`, uuid.NewString(), id, current, body.Status, body.Note)

		if body.Status == "SHIPPED" || body.Status == "MONTAJ_YOLDA" {
			createShipment(client, shipmentURL, id)
		}
		if body.Status == "MONTAJ_RANDEVU" {
			sendNotif(client, notifURL, "order.montage_scheduled", map[string]any{"orderId": id})
		}
		if body.Status == "MONTAJ_YOLDA" {
			sendNotif(client, notifURL, "order.service_on_the_way", map[string]any{"orderId": id})
		}
		if body.Status == "PAID" {
			sendNotif(client, notifURL, "order.paid", map[string]any{"orderId": id})
		}

		httpx.WriteJSON(w, 200, map[string]any{"id": id, "status": body.Status})
	})

	mux.HandleFunc("GET /v1/service-teams", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		wh := r.URL.Query().Get("warehouse")
		q := `
SELECT id, warehouse_code, name, COALESCE(technician,''), COALESCE(vehicle_plate,''), COALESCE(active,true), created_at
FROM service_teams`
		args := []any{}
		if wh != "" {
			args = append(args, wh)
			q += ` WHERE warehouse_code=$1`
		}
		q += ` ORDER BY created_at DESC`
		rows, err := pool.Query(r.Context(), q, args...)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip listesi hatası", rid)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, code, name, tech, plate string
			var active bool
			var created time.Time
			_ = rows.Scan(&id, &code, &name, &tech, &plate, &active, &created)
			items = append(items, map[string]any{
				"id": id, "warehouseCode": code, "name": name, "technician": tech,
				"vehiclePlate": plate, "active": active, "createdAt": created.UTC().Format(time.RFC3339),
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /v1/service-teams", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		var body struct {
			WarehouseCode string `json:"warehouseCode"`
			Name          string `json:"name"`
			Technician    string `json:"technician"`
			VehiclePlate  string `json:"vehiclePlate"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
			httpx.WriteError(w, 400, "validation_error", "name gerekli", rid)
			return
		}
		if body.WarehouseCode == "" {
			body.WarehouseCode = "BESIKTAS"
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO service_teams (id, warehouse_code, name, technician, vehicle_plate, active)
VALUES ($1,$2,$3,$4,$5,true)
`, id, body.WarehouseCode, strings.TrimSpace(body.Name), body.Technician, body.VehiclePlate)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip oluşturulamadı", rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{
			"id": id, "warehouseCode": body.WarehouseCode, "name": body.Name,
			"technician": body.Technician, "vehiclePlate": body.VehiclePlate, "active": true,
		})
	})

	mux.HandleFunc("PATCH /v1/service-teams/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		id := r.PathValue("id")
		var body struct {
			Name         *string `json:"name"`
			Technician   *string `json:"technician"`
			VehiclePlate *string `json:"vehiclePlate"`
			Active       *bool   `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "validation_error", "geçersiz gövde", rid)
			return
		}
		_, err := pool.Exec(r.Context(), `
UPDATE service_teams SET
  name=COALESCE(NULLIF($2,''), name),
  technician=COALESCE($3, technician),
  vehicle_plate=COALESCE($4, vehicle_plate),
  active=COALESCE($5, active)
WHERE id=$1
`, id,
			func() string {
				if body.Name != nil {
					return *body.Name
				}
				return ""
			}(),
			body.Technician, body.VehiclePlate, body.Active)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip güncellenemedi", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("DELETE /v1/service-teams/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		id := r.PathValue("id")
		_, err := pool.Exec(r.Context(), `DELETE FROM service_teams WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip silinemedi", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("GET /v1/service-routes", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		wh := r.URL.Query().Get("warehouse")
		q := `
SELECT r.id, r.team_id, r.warehouse_code, r.title, COALESCE(r.district_hint,''),
  r.planned_stops, r.done_stops, COALESCE(r.next_stop,''), r.route_date::text, r.status,
  COALESCE(t.name,''), COALESCE(t.technician,''), COALESCE(t.vehicle_plate,'')
FROM service_routes r
LEFT JOIN service_teams t ON t.id=r.team_id`
		args := []any{}
		if wh != "" {
			args = append(args, wh)
			q += ` WHERE r.warehouse_code=$1`
		}
		q += ` ORDER BY r.created_at DESC LIMIT 50`
		rows, err := pool.Query(r.Context(), q, args...)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "rota listesi hatası", rid)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, code, title, hint, next, date, status, teamName, tech, plate string
			var teamID *string
			var planned, done int
			_ = rows.Scan(&id, &teamID, &code, &title, &hint, &planned, &done, &next, &date, &status, &teamName, &tech, &plate)
			tone := "success"
			if planned > 0 && done < planned {
				if float64(done)/float64(planned) < 0.5 {
					tone = "warn"
				}
			}
			if status == "DONE" {
				tone = "success"
			}
			tid := ""
			if teamID != nil {
				tid = *teamID
			}
			items = append(items, map[string]any{
				"id": id, "teamId": tid, "warehouseCode": code, "title": title,
				"districtHint": hint, "plannedStops": planned, "doneStops": done,
				"nextStop": next, "routeDate": date, "status": status,
				"teamName": teamName, "technician": tech, "vehiclePlate": plate, "tone": tone,
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /v1/service-routes", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		var body struct {
			TeamID         string `json:"teamId"`
			WarehouseCode  string `json:"warehouseCode"`
			Title          string `json:"title"`
			DistrictHint   string `json:"districtHint"`
			PlannedStops   int    `json:"plannedStops"`
			DoneStops      int    `json:"doneStops"`
			NextStop       string `json:"nextStop"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
			httpx.WriteError(w, 400, "validation_error", "title gerekli", rid)
			return
		}
		if body.WarehouseCode == "" {
			body.WarehouseCode = "BESIKTAS"
		}
		if body.PlannedStops < 0 {
			body.PlannedStops = 0
		}
		id := uuid.NewString()
		var teamArg any
		if body.TeamID != "" {
			teamArg = body.TeamID
		}
		_, err := pool.Exec(r.Context(), `
INSERT INTO service_routes (id, team_id, warehouse_code, title, district_hint, planned_stops, done_stops, next_stop, route_date, status)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,'ACTIVE')
`, id, teamArg, body.WarehouseCode, strings.TrimSpace(body.Title), body.DistrictHint, body.PlannedStops, body.DoneStops, body.NextStop)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "rota oluşturulamadı", rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{"id": id, "title": body.Title, "warehouseCode": body.WarehouseCode})
	})

	mux.HandleFunc("PATCH /v1/service-routes/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		id := r.PathValue("id")
		var body struct {
			Title        *string `json:"title"`
			DistrictHint *string `json:"districtHint"`
			PlannedStops *int    `json:"plannedStops"`
			DoneStops    *int    `json:"doneStops"`
			NextStop     *string `json:"nextStop"`
			Status       *string `json:"status"`
			TeamID       *string `json:"teamId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "validation_error", "geçersiz gövde", rid)
			return
		}
		_, err := pool.Exec(r.Context(), `
UPDATE service_routes SET
  title=COALESCE(NULLIF($2,''), title),
  district_hint=COALESCE($3, district_hint),
  planned_stops=COALESCE($4, planned_stops),
  done_stops=COALESCE($5, done_stops),
  next_stop=COALESCE($6, next_stop),
  status=COALESCE(NULLIF($7,''), status),
  team_id=COALESCE(NULLIF($8,''), team_id)
WHERE id=$1
`, id,
			func() string {
				if body.Title != nil {
					return *body.Title
				}
				return ""
			}(),
			body.DistrictHint, body.PlannedStops, body.DoneStops, body.NextStop,
			func() string {
				if body.Status != nil {
					return *body.Status
				}
				return ""
			}(),
			func() string {
				if body.TeamID != nil {
					return *body.TeamID
				}
				return ""
			}())
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "rota güncellenemedi", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("DELETE /v1/service-routes/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		id := r.PathValue("id")
		_, err := pool.Exec(r.Context(), `DELETE FROM service_routes WHERE id=$1`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "rota silinemedi", rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func createShipment(client *http.Client, shipmentURL, orderID string) {
	payload, _ := json.Marshal(map[string]any{"orderId": orderID, "provider": "mock"})
	resp, err := client.Post(shipmentURL+"/v1/shipments", "application/json", bytes.NewReader(payload))
	if err == nil {
		resp.Body.Close()
	}
}

func sendNotif(client *http.Client, notifURL, template string, data map[string]any) {
	payload, _ := json.Marshal(map[string]any{"template": template, "channel": "sms", "data": data})
	resp, err := client.Post(notifURL+"/v1/notifications/send", "application/json", bytes.NewReader(payload))
	if err == nil {
		resp.Body.Close()
	}
}