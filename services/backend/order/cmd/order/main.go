package main

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
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

ALTER TABLE service_teams ADD COLUMN IF NOT EXISTS access_pin TEXT DEFAULT '1234';

CREATE TABLE IF NOT EXISTS service_jobs (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  team_id UUID REFERENCES service_teams(id) ON DELETE SET NULL,
  route_id UUID REFERENCES service_routes(id) ON DELETE SET NULL,
  warehouse_code TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ASSIGNED',
  scheduled_at TIMESTAMPTZ,
  address_snapshot TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  district TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  assigned_technician TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_job_location_points (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
  team_id UUID REFERENCES service_teams(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'gps'
);
CREATE INDEX IF NOT EXISTS idx_job_location_points_job_at
  ON service_job_location_points (job_id, recorded_at);

CREATE TABLE IF NOT EXISTS service_job_route_points (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES service_jobs(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'STOP'
);
CREATE INDEX IF NOT EXISTS idx_job_route_points_job_seq
  ON service_job_route_points (job_id, seq);
`)

	realtimeURL := strings.TrimRight(config.Getenv("REALTIME_URL", "http://localhost:8102"), "/")
	realtimeSecret := config.Getenv("REALTIME_INTERNAL_SECRET", "adb-dev-realtime")

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

	mux.HandleFunc("GET /v1/service-teams/directory", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		rows, err := pool.Query(r.Context(), `
SELECT id, warehouse_code, name, COALESCE(technician,''), COALESCE(vehicle_plate,'')
FROM service_teams WHERE COALESCE(active,true)=TRUE ORDER BY name ASC
`)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip listesi hatası", rid)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, code, name, tech, plate string
			_ = rows.Scan(&id, &code, &name, &tech, &plate)
			items = append(items, map[string]any{
				"id": id, "warehouseCode": code, "name": name, "technician": tech, "vehiclePlate": plate,
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /v1/service-teams", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		wh := r.URL.Query().Get("warehouse")
		q := `
SELECT id, warehouse_code, name, COALESCE(technician,''), COALESCE(vehicle_plate,''), COALESCE(active,true),
  COALESCE(access_pin,'1234'), created_at
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
			var id, code, name, tech, plate, pin string
			var active bool
			var created time.Time
			_ = rows.Scan(&id, &code, &name, &tech, &plate, &active, &pin, &created)
			items = append(items, map[string]any{
				"id": id, "warehouseCode": code, "name": name, "technician": tech,
				"vehiclePlate": plate, "active": active, "accessPin": pin,
				"createdAt": created.UTC().Format(time.RFC3339),
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
			AccessPin     string `json:"accessPin"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
			httpx.WriteError(w, 400, "validation_error", "name gerekli", rid)
			return
		}
		if body.WarehouseCode == "" {
			body.WarehouseCode = "BESIKTAS"
		}
		if body.AccessPin == "" {
			body.AccessPin = "1234"
		}
		id := uuid.NewString()
		_, err := pool.Exec(r.Context(), `
INSERT INTO service_teams (id, warehouse_code, name, technician, vehicle_plate, active, access_pin)
VALUES ($1,$2,$3,$4,$5,true,$6)
`, id, body.WarehouseCode, strings.TrimSpace(body.Name), body.Technician, body.VehiclePlate, body.AccessPin)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "ekip oluşturulamadı", rid)
			return
		}
		httpx.WriteJSON(w, 201, map[string]any{
			"id": id, "warehouseCode": body.WarehouseCode, "name": body.Name,
			"technician": body.Technician, "vehiclePlate": body.VehiclePlate, "active": true, "accessPin": body.AccessPin,
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

	mux.HandleFunc("GET /v1/service-jobs", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		wh := r.URL.Query().Get("warehouse")
		status := r.URL.Query().Get("status")
		teamID := r.URL.Query().Get("teamId")
		q := `
SELECT j.id, j.order_id, COALESCE(j.team_id::text,''), COALESCE(j.route_id::text,''), j.warehouse_code, j.status,
  COALESCE(j.address_snapshot,''), COALESCE(j.customer_name,''), COALESCE(j.customer_phone,''), COALESCE(j.district,''),
  j.lat, j.lng, j.last_lat, j.last_lng, j.last_location_at, COALESCE(j.notes,''), COALESCE(j.assigned_technician,''),
  j.created_at, COALESCE(t.name,''), COALESCE(t.vehicle_plate,'')
FROM service_jobs j
LEFT JOIN service_teams t ON t.id=j.team_id`
		args := []any{}
		where := []string{}
		if wh != "" {
			args = append(args, wh)
			where = append(where, "j.warehouse_code=$"+strconv.Itoa(len(args)))
		}
		if status != "" && status != "ALL" {
			args = append(args, status)
			where = append(where, "j.status=$"+strconv.Itoa(len(args)))
		}
		if teamID != "" {
			args = append(args, teamID)
			where = append(where, "j.team_id=$"+strconv.Itoa(len(args)))
		}
		if len(where) > 0 {
			q += " WHERE " + strings.Join(where, " AND ")
		}
		q += ` ORDER BY j.created_at DESC LIMIT 100`
		rows, err := pool.Query(r.Context(), q, args...)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "iş listesi hatası", rid)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			items = append(items, scanJob(rows))
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items})
	})

	mux.HandleFunc("GET /v1/service-jobs/mine", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		teamID := r.URL.Query().Get("teamId")
		pin := r.URL.Query().Get("pin")
		if teamID == "" || pin == "" {
			httpx.WriteError(w, 400, "validation_error", "teamId ve pin gerekli", rid)
			return
		}
		var dbPin string
		err := pool.QueryRow(r.Context(), `SELECT COALESCE(access_pin,'1234') FROM service_teams WHERE id=$1 AND COALESCE(active,true)=TRUE`, teamID).Scan(&dbPin)
		if err != nil || dbPin != pin {
			httpx.WriteError(w, 401, "unauthorized", "ekip veya pin hatalı", rid)
			return
		}
		rows, err := pool.Query(r.Context(), `
SELECT j.id, j.order_id, COALESCE(j.team_id::text,''), COALESCE(j.route_id::text,''), j.warehouse_code, j.status,
  COALESCE(j.address_snapshot,''), COALESCE(j.customer_name,''), COALESCE(j.customer_phone,''), COALESCE(j.district,''),
  j.lat, j.lng, j.last_lat, j.last_lng, j.last_location_at, COALESCE(j.notes,''), COALESCE(j.assigned_technician,''),
  j.created_at, COALESCE(t.name,''), COALESCE(t.vehicle_plate,'')
FROM service_jobs j
LEFT JOIN service_teams t ON t.id=j.team_id
WHERE j.team_id=$1 AND j.status <> 'CANCELLED'
ORDER BY CASE j.status WHEN 'EN_ROUTE' THEN 0 WHEN 'ACCEPTED' THEN 1 WHEN 'ASSIGNED' THEN 2 WHEN 'ON_SITE' THEN 3 ELSE 4 END, j.created_at DESC
LIMIT 50
`, teamID)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "iş listesi hatası", rid)
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			items = append(items, scanJob(rows))
		}
		httpx.WriteJSON(w, 200, map[string]any{"items": items, "teamId": teamID})
	})

	mux.HandleFunc("POST /v1/service-jobs", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		var body struct {
			OrderID       string  `json:"orderId"`
			TeamID        string  `json:"teamId"`
			RouteID       string  `json:"routeId"`
			WarehouseCode string  `json:"warehouseCode"`
			Notes         string  `json:"notes"`
			Lat           float64 `json:"lat"`
			Lng           float64 `json:"lng"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == "" || body.TeamID == "" {
			httpx.WriteError(w, 400, "validation_error", "orderId ve teamId gerekli", rid)
			return
		}
		var custName, custPhone, district, addr, city, tech, plate, teamWh string
		err := pool.QueryRow(r.Context(), `
SELECT COALESCE(customer_name,''), COALESCE(customer_phone,''), COALESCE(district,''),
  COALESCE(address_line,''), COALESCE(city,'') FROM orders WHERE id=$1
`, body.OrderID).Scan(&custName, &custPhone, &district, &addr, &city)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "sipariş yok", rid)
			return
		}
		err = pool.QueryRow(r.Context(), `
SELECT COALESCE(technician,''), COALESCE(vehicle_plate,''), warehouse_code FROM service_teams WHERE id=$1
`, body.TeamID).Scan(&tech, &plate, &teamWh)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "ekip yok", rid)
			return
		}
		if body.WarehouseCode == "" {
			body.WarehouseCode = teamWh
		}
		snapshot := strings.TrimSpace(strings.Join([]string{addr, district, city}, ", "))
		id := uuid.NewString()
		var routeArg any
		if body.RouteID != "" {
			routeArg = body.RouteID
		}
		var latArg, lngArg any
		if body.Lat != 0 || body.Lng != 0 {
			latArg, lngArg = body.Lat, body.Lng
		}
		_, err = pool.Exec(r.Context(), `
INSERT INTO service_jobs (
  id, order_id, team_id, route_id, warehouse_code, status, address_snapshot,
  customer_name, customer_phone, district, lat, lng, notes, assigned_technician
) VALUES ($1,$2,$3,$4,$5,'ASSIGNED',$6,$7,$8,$9,$10,$11,$12,$13)
`, id, body.OrderID, body.TeamID, routeArg, body.WarehouseCode, snapshot, custName, custPhone, district, latArg, lngArg, body.Notes, tech)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "iş emri oluşturulamadı: "+err.Error(), rid)
			return
		}
		sref := tech
		if plate != "" {
			sref = tech + " / " + plate
		}
		_, _ = pool.Exec(r.Context(), `
UPDATE orders SET service_ref=$2, montage_status=COALESCE(NULLIF(montage_status,''), 'Randevu planlandı'),
  status=CASE WHEN status IN ('PAID','PROCESSING','PACKED','SHIPPED','DELIVERED','MONTAJ_BEKLIYOR') THEN 'MONTAJ_RANDEVU' ELSE status END,
  updated_at=NOW()
WHERE id=$1
`, body.OrderID, sref)
		pushJobEvent(client, realtimeURL, realtimeSecret, "job.status", map[string]any{
			"jobId": id, "teamId": body.TeamID, "orderId": body.OrderID, "status": "ASSIGNED",
		})
		if body.Lat != 0 || body.Lng != 0 {
			_ = upsertPlannedRoute(r.Context(), pool, id, body.WarehouseCode, body.Lat, body.Lng, district)
		}
		httpx.WriteJSON(w, 201, map[string]any{"id": id, "orderId": body.OrderID, "teamId": body.TeamID, "status": "ASSIGNED"})
	})

	mux.HandleFunc("PATCH /v1/service-jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body struct {
			Status string  `json:"status"`
			Notes  string  `json:"notes"`
			TeamID string  `json:"teamId"`
			Pin    string  `json:"pin"`
			Lat    float64 `json:"lat"`
			Lng    float64 `json:"lng"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			httpx.WriteError(w, 400, "validation_error", "geçersiz gövde", rid)
			return
		}
		var teamID, orderID, curStatus string
		err := pool.QueryRow(r.Context(), `SELECT COALESCE(team_id::text,''), order_id::text, status FROM service_jobs WHERE id=$1`, id).Scan(&teamID, &orderID, &curStatus)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "iş emri yok", rid)
			return
		}
		isAdmin := requireAdmin(r, jwtSecret, appEnv)
		if !isAdmin {
			if body.TeamID == "" || body.Pin == "" || body.TeamID != teamID {
				httpx.WriteError(w, 403, "forbidden", "ekip pin gerekli", rid)
				return
			}
			var dbPin string
			_ = pool.QueryRow(r.Context(), `SELECT COALESCE(access_pin,'1234') FROM service_teams WHERE id=$1`, teamID).Scan(&dbPin)
			if dbPin != body.Pin {
				httpx.WriteError(w, 401, "unauthorized", "pin hatalı", rid)
				return
			}
		}
		if body.Status == "" {
			body.Status = curStatus
		}
		_, err = pool.Exec(r.Context(), `
UPDATE service_jobs SET
  status=$2,
  notes=COALESCE(NULLIF($3,''), notes),
  last_lat=COALESCE(NULLIF($4,0), last_lat),
  last_lng=COALESCE(NULLIF($5,0), last_lng),
  last_location_at=CASE WHEN $4<>0 OR $5<>0 THEN NOW() ELSE last_location_at END,
  updated_at=NOW()
WHERE id=$1
`, id, body.Status, body.Notes, body.Lat, body.Lng)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", "güncellenemedi", rid)
			return
		}
		if body.Lat != 0 || body.Lng != 0 {
			src := "gps"
			if isAdmin {
				src = "sim"
			}
			insertLocationPoint(r.Context(), pool, id, teamID, body.Lat, body.Lng, src)
		}
		montage := ""
		orderStatus := ""
		switch body.Status {
		case "ACCEPTED":
			montage = "Ekip kabul etti"
		case "EN_ROUTE":
			montage, orderStatus = "Yolda", "MONTAJ_YOLDA"
		case "ON_SITE":
			montage = "Sahada"
		case "DONE":
			montage, orderStatus = "Tamamlandı", "MONTAJ_TAMAMLANDI"
		}
		if montage != "" {
			if orderStatus != "" {
				_, _ = pool.Exec(r.Context(), `UPDATE orders SET montage_status=$2, status=$3, updated_at=NOW() WHERE id=$1`, orderID, montage, orderStatus)
			} else {
				_, _ = pool.Exec(r.Context(), `UPDATE orders SET montage_status=$2, updated_at=NOW() WHERE id=$1`, orderID, montage)
			}
		}
		pushJobEvent(client, realtimeURL, realtimeSecret, "job.status", map[string]any{
			"jobId": id, "teamId": teamID, "orderId": orderID, "status": body.Status,
			"lat": body.Lat, "lng": body.Lng,
		})
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id, "status": body.Status})
	})

	mux.HandleFunc("POST /v1/service-jobs/{id}/location", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		var body struct {
			TeamID string  `json:"teamId"`
			Pin    string  `json:"pin"`
			Lat    float64 `json:"lat"`
			Lng    float64 `json:"lng"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || (body.Lat == 0 && body.Lng == 0) {
			httpx.WriteError(w, 400, "validation_error", "lat/lng gerekli", rid)
			return
		}
		var teamID string
		err := pool.QueryRow(r.Context(), `SELECT COALESCE(team_id::text,'') FROM service_jobs WHERE id=$1`, id).Scan(&teamID)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "iş emri yok", rid)
			return
		}
		isAdmin := requireAdmin(r, jwtSecret, appEnv)
		if !isAdmin {
			if body.TeamID == "" || body.Pin == "" || body.TeamID != teamID {
				httpx.WriteError(w, 403, "forbidden", "ekip pin gerekli", rid)
				return
			}
			var dbPin string
			_ = pool.QueryRow(r.Context(), `SELECT COALESCE(access_pin,'1234') FROM service_teams WHERE id=$1`, teamID).Scan(&dbPin)
			if dbPin != body.Pin {
				httpx.WriteError(w, 401, "unauthorized", "pin hatalı", rid)
				return
			}
		}
		_, _ = pool.Exec(r.Context(), `
UPDATE service_jobs SET last_lat=$2, last_lng=$3, last_location_at=NOW(), updated_at=NOW() WHERE id=$1
`, id, body.Lat, body.Lng)
		source := "gps"
		if isAdmin {
			source = "sim"
		}
		insertLocationPoint(r.Context(), pool, id, teamID, body.Lat, body.Lng, source)
		pushJobEvent(client, realtimeURL, realtimeSecret, "job.location", map[string]any{
			"jobId": id, "teamId": teamID, "lat": body.Lat, "lng": body.Lng, "at": time.Now().UTC().Format(time.RFC3339),
		})
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "id": id})
	})

	mux.HandleFunc("GET /v1/service-jobs/{id}/trail", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		var exists string
		if err := pool.QueryRow(r.Context(), `SELECT id::text FROM service_jobs WHERE id=$1`, id).Scan(&exists); err != nil {
			httpx.WriteError(w, 404, "not_found", "iş emri yok", rid)
			return
		}
		trailRows, err := pool.Query(r.Context(), `
SELECT lat, lng, recorded_at, COALESCE(source,'gps')
FROM service_job_location_points WHERE job_id=$1 ORDER BY recorded_at ASC, id ASC LIMIT 2000
`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		defer trailRows.Close()
		trail := []map[string]any{}
		for trailRows.Next() {
			var lat, lng float64
			var at time.Time
			var source string
			if err := trailRows.Scan(&lat, &lng, &at, &source); err != nil {
				continue
			}
			trail = append(trail, map[string]any{
				"lat": lat, "lng": lng, "at": at.UTC().Format(time.RFC3339), "source": source,
			})
		}
		planRows, err := pool.Query(r.Context(), `
SELECT seq, lat, lng, COALESCE(label,''), COALESCE(kind,'STOP')
FROM service_job_route_points WHERE job_id=$1 ORDER BY seq ASC
`, id)
		if err != nil {
			httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
			return
		}
		defer planRows.Close()
		planned := []map[string]any{}
		for planRows.Next() {
			var seq int
			var lat, lng float64
			var label, kind string
			if err := planRows.Scan(&seq, &lat, &lng, &label, &kind); err != nil {
				continue
			}
			planned = append(planned, map[string]any{
				"seq": seq, "lat": lat, "lng": lng, "label": label, "kind": kind,
			})
		}
		httpx.WriteJSON(w, 200, map[string]any{"jobId": id, "trail": trail, "planned": planned})
	})

	mux.HandleFunc("POST /v1/service-jobs/{id}/route", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		id := r.PathValue("id")
		if !requireAdmin(r, jwtSecret, appEnv) {
			httpx.WriteError(w, 403, "forbidden", "admin yetkisi gerekli", rid)
			return
		}
		var body struct {
			Waypoints []struct {
				Lat   float64 `json:"lat"`
				Lng   float64 `json:"lng"`
				Label string  `json:"label"`
				Kind  string  `json:"kind"`
			} `json:"waypoints"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		var wh string
		var destLat, destLng *float64
		var district string
		err := pool.QueryRow(r.Context(), `
SELECT warehouse_code, lat, lng, COALESCE(district,'') FROM service_jobs WHERE id=$1
`, id).Scan(&wh, &destLat, &destLng, &district)
		if err != nil {
			httpx.WriteError(w, 404, "not_found", "iş emri yok", rid)
			return
		}

		if len(body.Waypoints) >= 2 {
			_, _ = pool.Exec(r.Context(), `DELETE FROM service_job_route_points WHERE job_id=$1`, id)
			for i, wp := range body.Waypoints {
				kind := strings.TrimSpace(wp.Kind)
				if kind == "" {
					if i == 0 {
						kind = "START"
					} else if i == len(body.Waypoints)-1 {
						kind = "END"
					} else {
						kind = "STOP"
					}
				}
				_, _ = pool.Exec(r.Context(), `
INSERT INTO service_job_route_points (id, job_id, seq, lat, lng, label, kind)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`, uuid.NewString(), id, i, wp.Lat, wp.Lng, wp.Label, kind)
			}
		} else {
			endLat, endLng := 0.0, 0.0
			if destLat != nil && destLng != nil {
				endLat, endLng = *destLat, *destLng
			}
			if endLat == 0 && endLng == 0 {
				httpx.WriteError(w, 400, "validation_error", "iş emrinde hedef konum yok", rid)
				return
			}
			if err := upsertPlannedRoute(r.Context(), pool, id, wh, endLat, endLng, district); err != nil {
				httpx.WriteError(w, 500, "internal_error", err.Error(), rid)
				return
			}
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "jobId": id})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func warehouseCoords(code string) (float64, float64) {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "BESIKTAS":
		return 41.0422, 29.0067
	case "KADIKOY":
		return 40.9901, 29.0292
	case "USKUDAR":
		return 41.0255, 29.0150
	default:
		return 41.015, 28.98
	}
}

func haversineM(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371000.0
	p1, p2 := lat1*math.Pi/180, lat2*math.Pi/180
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(p1)*math.Cos(p2)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Min(1, math.Sqrt(a)))
}

func insertLocationPoint(ctx context.Context, pool *pgxpool.Pool, jobID, teamID string, lat, lng float64, source string) {
	var prevLat, prevLng *float64
	var prevAt *time.Time
	_ = pool.QueryRow(ctx, `
SELECT lat, lng, recorded_at FROM service_job_location_points
WHERE job_id=$1 ORDER BY recorded_at DESC, id DESC LIMIT 1
`, jobID).Scan(&prevLat, &prevLng, &prevAt)
	if prevLat != nil && prevLng != nil && prevAt != nil {
		if time.Since(*prevAt) < 8*time.Second && haversineM(*prevLat, *prevLng, lat, lng) < 25 {
			return
		}
	}
	var teamArg any
	if teamID != "" {
		teamArg = teamID
	}
	_, _ = pool.Exec(ctx, `
INSERT INTO service_job_location_points (id, job_id, team_id, lat, lng, recorded_at, source)
VALUES ($1,$2,$3,$4,$5,NOW(),$6)
`, uuid.NewString(), jobID, teamArg, lat, lng, source)
}

func upsertPlannedRoute(ctx context.Context, pool *pgxpool.Pool, jobID, warehouseCode string, endLat, endLng float64, district string) error {
	startLat, startLng := warehouseCoords(warehouseCode)
	_, _ = pool.Exec(ctx, `DELETE FROM service_job_route_points WHERE job_id=$1`, jobID)

	type pt struct {
		lat, lng float64
		label    string
		kind     string
	}
	points := []pt{
		{startLat, startLng, "Şube / depo", "START"},
	}
	// Ara noktalar (doğrusal interpolasyon — ücretsiz planlı rota)
	steps := 4
	for i := 1; i <= steps; i++ {
		t := float64(i) / float64(steps+1)
		// hafif eğri için sinüs ofseti
		off := math.Sin(t*math.Pi) * 0.004
		points = append(points, pt{
			startLat + (endLat-startLat)*t + off*0.4,
			startLng + (endLng-startLng)*t + off,
			"Ara nokta",
			"STOP",
		})
	}
	endLabel := "Müşteri"
	if strings.TrimSpace(district) != "" {
		endLabel = "Müşteri · " + district
	}
	points = append(points, pt{endLat, endLng, endLabel, "END"})

	for i, p := range points {
		if _, err := pool.Exec(ctx, `
INSERT INTO service_job_route_points (id, job_id, seq, lat, lng, label, kind)
VALUES ($1,$2,$3,$4,$5,$6,$7)
`, uuid.NewString(), jobID, i, p.lat, p.lng, p.label, p.kind); err != nil {
			return err
		}
	}
	return nil
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

func scanJob(rows pgx.Row) map[string]any {
	var id, orderID, teamID, routeID, wh, status, addr, name, phone, district, notes, tech, teamName, plate string
	var lat, lng, lastLat, lastLng *float64
	var lastAt *time.Time
	var created time.Time
	_ = rows.Scan(&id, &orderID, &teamID, &routeID, &wh, &status, &addr, &name, &phone, &district,
		&lat, &lng, &lastLat, &lastLng, &lastAt, &notes, &tech, &created, &teamName, &plate)
	out := map[string]any{
		"id": id, "orderId": orderID, "teamId": teamID, "routeId": routeID, "warehouseCode": wh,
		"status": status, "addressSnapshot": addr, "customerName": name, "customerPhone": phone,
		"district": district, "notes": notes, "assignedTechnician": tech,
		"teamName": teamName, "vehiclePlate": plate, "createdAt": created.UTC().Format(time.RFC3339),
	}
	if lat != nil {
		out["lat"] = *lat
	}
	if lng != nil {
		out["lng"] = *lng
	}
	if lastLat != nil {
		out["lastLat"] = *lastLat
	}
	if lastLng != nil {
		out["lastLng"] = *lastLng
	}
	if lastAt != nil {
		out["lastLocationAt"] = lastAt.UTC().Format(time.RFC3339)
	}
	return out
}

func pushJobEvent(client *http.Client, realtimeURL, secret, event string, data map[string]any) {
	if realtimeURL == "" {
		return
	}
	payload, _ := json.Marshal(map[string]any{"event": event, "data": data})
	req, err := http.NewRequest(http.MethodPost, realtimeURL+"/job-event", bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Secret", secret)
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
}