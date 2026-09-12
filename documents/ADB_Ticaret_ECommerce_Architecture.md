# ADB Ticaret Beko --- E-Commerce Platform Architecture & AI Development Specification

> **Purpose:** This document is the single source of truth for an AI
> coding agent/developer who will build a production-grade e-commerce
> platform for ADB Ticaret Beko.
>
> **Primary stack:** Next.js + TypeScript for storefront/admin, Go for
> backend APIs and microservices, PostgreSQL, Redis, message broker,
> object storage, Docker.
>
> **Architecture:** Monorepo + independently deployable Go
> microservices + Next.js applications.
>
> **Important:** Do not implement the entire system as one Go
> application. Business domains must be isolated behind service
> boundaries, even if the first deployment runs several services on the
> same machine.
>
> **Repo deviation (intentional):** Package manager is **Yarn Berry**
> with `.yarnrc.yml` `nodeLinker: node-modules` and Volta pins (not
> pnpm). Production target is a **single Hetzner host** via Docker
> Compose; services remain separate processes/containers.

------------------------------------------------------------------------

## 1. Product Vision

The system should be capable of operating as a serious Turkish
e-commerce platform rather than a simple product catalog.

The target capabilities include:

-   Product catalog
-   Categories and brands
-   Product variants
-   Product attributes/specifications
-   Product images and media
-   Inventory
-   Warehouses
-   Pricing
-   Discount/campaign engine
-   Cart
-   Guest cart
-   Customer accounts
-   Addresses
-   Checkout
-   Orders
-   Payments
-   Installments
-   Refunds
-   Shipment/tracking
-   Coupons
-   Wishlist
-   Product reviews
-   Product questions
-   Search
-   SEO
-   Notifications
-   Email
-   SMS
-   Abandoned cart reminders
-   Customer segmentation
-   Admin panel
-   Reports
-   Audit logs
-   Marketplace integrations
-   Trendyol integration
-   Hepsiburada integration
-   Future marketplace integrations
-   Accounting/e-invoice integrations
-   Background jobs
-   Event-driven workflows
-   Observability
-   Rate limiting
-   Security
-   Role-based access control

The architecture should allow the system to grow toward a platform
comparable in architectural capability to a modern e-commerce backend.

------------------------------------------------------------------------

# 2. Non-Negotiable Architecture Rules

## 2.1 Frontend

Use:

-   Next.js
-   TypeScript
-   App Router
-   Server Components where appropriate
-   Client Components only when interactivity requires them
-   Tailwind CSS
-   React Hook Form
-   Zod
-   TanStack Query where client-side server-state management is required

Applications:

``` text
apps/
├── storefront/
└── admin/
```

The storefront and admin are separate Next.js applications.

Do not put Go business logic inside Next.js API routes.

Next.js is the presentation layer/BFF when needed.

------------------------------------------------------------------------

# 3. Backend Architecture

Backend is written in Go.

Recommended:

-   Go 1.27+
-   REST/JSON for public HTTP APIs
-   gRPC for internal service-to-service calls where useful
-   PostgreSQL
-   Redis
-   NATS JetStream or RabbitMQ for asynchronous events
-   OpenTelemetry
-   Prometheus-compatible metrics
-   structured JSON logging

The backend must be domain-oriented.

Services should not directly access another service's database.

------------------------------------------------------------------------

# 4. Monorepo Structure

Recommended repository:

``` text
adb-ticaret/
│
├── apps/
│   ├── storefront/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── hooks/
│   │   ├── providers/
│   │   ├── public/
│   │   ├── styles/
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── admin/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── hooks/
│       ├── providers/
│       ├── public/
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── services/
│   └── backend/
│       ├── gateway/
│       ├── auth/
│       ├── customer/
│       ├── catalog/
│       ├── inventory/
│       ├── pricing/
│       ├── promotion/
│       ├── cart/
│       ├── checkout/
│       ├── order/
│       ├── payment/
│       ├── shipment/
│       ├── notification/
│       ├── search/
│       ├── review/
│       ├── wishlist/
│       ├── marketplace/
│       ├── accounting/
│       ├── reporting/
│       └── worker/
│
├── packages/
│   ├── ui/
│   ├── eslint-config/
│   ├── typescript-config/
│   ├── api-client/
│   ├── api-types/
│   └── validation/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── postgres/
│   ├── redis/
│   ├── nats/
│   ├── minio/
│   └── observability/
│
├── deployments/
│   ├── docker-compose/
│   ├── kubernetes/
│   └── helm/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── events/
│   └── runbooks/
│
├── scripts/
│
├── .github/
│   └── workflows/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── Makefile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

# 5. Go Backend Structure

Each service should follow a consistent structure.

Example:

``` text
services/backend/catalog/
│
├── cmd/
│   └── catalog/
│       └── main.go
│
├── internal/
│   ├── config/
│   ├── domain/
│   │   ├── product.go
│   │   ├── category.go
│   │   └── brand.go
│   │
│   ├── application/
│   │   ├── commands/
│   │   └── queries/
│   │
│   ├── repository/
│   │   ├── postgres/
│   │   └── redis/
│   │
│   ├── handler/
│   │   ├── http/
│   │   └── grpc/
│   │
│   ├── service/
│   ├── event/
│   └── mapper/
│
├── migrations/
├── tests/
├── Dockerfile
├── go.mod
├── go.sum
└── README.md
```

Use Go's `internal` package for implementation details and `cmd` for
executable entry points.

Do not create a giant generic `utils` package.

Prefer small domain-specific packages.

------------------------------------------------------------------------

# 6. Service Responsibilities

## 6.1 API Gateway

Path:

``` text
services/backend/gateway/
```

Responsibilities:

-   Public API entry point
-   Authentication validation
-   Rate limiting
-   Request ID
-   CORS
-   API versioning
-   Routing
-   API aggregation where necessary
-   Security headers
-   Observability middleware

Example:

``` text
/api/v1/products
/api/v1/categories
/api/v1/cart
/api/v1/checkout
/api/v1/orders
/api/v1/customers
```

The gateway must not contain business logic.

------------------------------------------------------------------------

# 7. Auth Service

Responsibilities:

-   Customer authentication
-   Admin authentication
-   Access tokens
-   Refresh tokens
-   Password hashing
-   OTP
-   Email verification
-   Password reset
-   Session management
-   RBAC

Roles:

``` text
SUPER_ADMIN
ADMIN
CATALOG_MANAGER
ORDER_MANAGER
CUSTOMER_SUPPORT
ACCOUNTING
WAREHOUSE
CUSTOMER
```

JWT can be used for access tokens.

Refresh tokens should be stored securely and revocable.

Never store plaintext passwords.

------------------------------------------------------------------------

# 8. Customer Service

Responsibilities:

-   Customer profile
-   Addresses
-   Customer groups
-   Customer metadata
-   Consent records
-   Marketing preferences
-   Customer tags
-   Customer segmentation

Entities:

``` text
customers
customer_addresses
customer_groups
customer_tags
customer_consents
```

------------------------------------------------------------------------

# 9. Catalog Service

This is one of the most important services.

Responsibilities:

-   Products
-   Categories
-   Brands
-   Product variants
-   Attributes
-   Specifications
-   Product media
-   Product relations
-   SEO metadata
-   Product status

Example product:

``` json
{
  "id": "uuid",
  "sku": "BEKO-001",
  "name": "Example Product",
  "slug": "example-product",
  "brand_id": "uuid",
  "category_id": "uuid",
  "description": "...",
  "short_description": "...",
  "status": "ACTIVE"
}
```

Variants must be first-class entities.

Example:

``` text
Product
└── Variant
    ├── SKU
    ├── barcode
    ├── price
    ├── weight
    ├── dimensions
    └── attributes
```

Do not put variant-specific stock directly on the product table.

------------------------------------------------------------------------

# 10. Inventory Service

Responsibilities:

-   Stock
-   Warehouses
-   Stock reservations
-   Stock movements
-   Stock adjustments
-   Low-stock alerts
-   Inventory synchronization

Entities:

``` text
warehouses
inventory_items
stock_movements
stock_reservations
```

Critical rule:

A checkout must reserve stock before payment/order confirmation.

Example:

``` text
AVAILABLE = 10
RESERVED = 2
SALEABLE = 8
```

Never trust frontend stock values.

Stock must be validated transactionally in the backend.

------------------------------------------------------------------------

# 11. Pricing Service

Responsibilities:

-   Base prices
-   Customer-specific prices
-   Marketplace prices
-   Wholesale prices
-   Installment-related pricing
-   Scheduled prices

Pricing must not be hardcoded inside product service.

Example:

``` text
product
  ↓
variant
  ↓
price list
  ↓
customer group
  ↓
effective price
```

------------------------------------------------------------------------

# 12. Promotion Service

Responsibilities:

-   Coupons
-   Discount codes
-   Campaigns
-   Percentage discounts
-   Fixed discounts
-   Buy X Get Y
-   Category discounts
-   Product discounts
-   Cart-level discounts
-   Minimum basket rules
-   Date ranges
-   Usage limits
-   Customer-specific campaigns

Example:

``` text
BLACKFRIDAY
20%
minimum cart: 5.000 TL
maximum discount: 2.000 TL
```

Promotion calculation must happen server-side.

------------------------------------------------------------------------

# 13. Cart Service

This service is critical.

Responsibilities:

-   Guest carts
-   Customer carts
-   Cart items
-   Quantity changes
-   Coupon application
-   Cart expiration
-   Cart merge after login
-   Price snapshot
-   Stock validation
-   Abandoned cart detection

Recommended storage:

``` text
Redis → active cart
PostgreSQL → durable cart/order-related history
```

Cart ID:

``` text
guest:<uuid>
customer:<uuid>
```

------------------------------------------------------------------------

# 14. Abandoned Cart Reminder System

Required feature.

Flow:

``` text
Customer adds product
        ↓
Cart updated
        ↓
Cart event
        ↓
Delay / scheduled job
        ↓
Check cart
        ↓
Still active?
        ↓
Yes
        ↓
Send reminder
```

Reminder stages:

``` text
1 hour
24 hours
72 hours
```

Do not send reminders if:

-   cart is empty
-   order was created
-   customer opted out
-   reminder limit reached
-   product is unavailable

Example event:

``` json
{
  "event": "cart.abandoned",
  "cart_id": "uuid",
  "customer_id": "uuid",
  "occurred_at": "timestamp"
}
```

Notification service decides whether to send:

-   Email
-   SMS
-   WhatsApp
-   Push notification

------------------------------------------------------------------------

# 15. Checkout Service

Checkout is a workflow/orchestration service.

Responsibilities:

-   Validate cart
-   Validate prices
-   Validate promotions
-   Validate stock
-   Calculate shipping
-   Calculate taxes
-   Create payment intent
-   Reserve inventory
-   Create pending order

Example:

``` text
POST /checkout/preview

POST /checkout/validate

POST /checkout/create
```

Never trust:

``` text
frontend total
frontend price
frontend discount
frontend stock
```

All values must be recalculated server-side.

------------------------------------------------------------------------

# 16. Order Service

Order lifecycle:

``` text
PENDING
PAYMENT_PENDING
PAID
PROCESSING
PACKED
SHIPPED
DELIVERED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

Entities:

``` text
orders
order_items
order_addresses
order_status_history
order_notes
```

Order item must store a snapshot:

``` text
product_name
sku
variant_name
unit_price
discount
tax
quantity
```

Never depend on the current product record for historical order
information.

------------------------------------------------------------------------

# 17. Payment Service

Must be provider-agnostic.

Interface:

``` go
type PaymentProvider interface {
    CreatePayment(ctx context.Context, request CreatePaymentRequest) (*PaymentResult, error)
    RefundPayment(ctx context.Context, request RefundRequest) error
    GetPayment(ctx context.Context, paymentID string) (*Payment, error)
    VerifyWebhook(ctx context.Context, payload []byte, signature string) error
}
```

Possible providers:

-   iyzico
-   PayTR
-   Stripe
-   Other Turkish PSPs

Payment events:

``` text
payment.created
payment.pending
payment.succeeded
payment.failed
payment.refunded
payment.partially_refunded
```

Webhook processing must be idempotent.

Never process the same payment webhook twice.

------------------------------------------------------------------------

# 18. Shipment Service

Responsibilities:

-   Shipping providers
-   Shipping methods
-   Shipping labels
-   Tracking numbers
-   Shipment status
-   Delivery tracking

Provider interface:

``` go
type ShippingProvider interface {
    CreateShipment(...)
    CancelShipment(...)
    GetTracking(...)
}
```

Potential integrations:

-   Yurtiçi Kargo
-   Aras
-   MNG / successor provider APIs
-   Sürat
-   Hepsijet
-   Other providers

Do not hardcode one provider into the order service.

------------------------------------------------------------------------

# 19. Notification Service

Central notification service.

Channels:

``` text
Email
SMS
WhatsApp
Push
```

Templates:

``` text
order.created
order.paid
order.shipped
order.delivered
payment.failed
cart.abandoned
password.reset
customer.welcome
```

Use event-driven processing.

Example:

``` text
order.paid
   ↓
Notification Service
   ├── Email
   ├── SMS
   └── WhatsApp
```

------------------------------------------------------------------------

# 20. Search Service

Search should be separated from catalog.

Initial implementation:

``` text
PostgreSQL full-text search
```

Later:

``` text
Meilisearch / OpenSearch / Elasticsearch
```

Features:

-   Product search
-   SKU search
-   Barcode search
-   Category filtering
-   Brand filtering
-   Price filtering
-   Attribute filtering
-   Sorting
-   Suggestions

Search indexing event:

``` text
product.created
product.updated
product.deleted
```

------------------------------------------------------------------------

# 21. Wishlist Service

Responsibilities:

-   Add product
-   Remove product
-   List wishlist
-   Stock availability
-   Price-drop notification

Event:

``` text
wishlist.product_added
```

------------------------------------------------------------------------

# 22. Review Service

Responsibilities:

-   Product reviews
-   Rating
-   Verified purchase
-   Review moderation
-   Review photos
-   Admin approval

Rules:

Only customers with a completed order containing the product should be
able to create a verified purchase review.

------------------------------------------------------------------------

# 23. Marketplace Service

This service handles external marketplaces.

Architecture:

``` text
Marketplace Service
│
├── Trendyol Adapter
├── Hepsiburada Adapter
├── Future Adapter
└── Marketplace Sync Engine
```

Common interface:

``` go
type MarketplaceProvider interface {
    CreateProduct(...)
    UpdateProduct(...)
    UpdateStock(...)
    UpdatePrice(...)
    GetOrders(...)
    GetOrder(...)
    UpdateShipment(...)
}
```

Never put Trendyol-specific code into catalog/order services.

------------------------------------------------------------------------

# 24. Marketplace Synchronization

Need separate synchronization jobs:

``` text
Product sync
Price sync
Stock sync
Order import
Shipment sync
Cancellation sync
Return sync
```

Example:

``` text
Internal Stock
      ↓
Marketplace Service
      ↓
Trendyol
      ↓
Hepsiburada
```

Use an outbox/event-driven approach.

Do not make a marketplace API request inside the same PostgreSQL
transaction as the internal order operation.

------------------------------------------------------------------------

# 25. Accounting Service

Future-ready service.

Responsibilities:

-   Invoice
-   E-invoice
-   E-archive
-   Customer tax information
-   Invoice status
-   Accounting integration

Provider interface:

``` go
type InvoiceProvider interface {
    CreateInvoice(...)
    CancelInvoice(...)
    GetInvoice(...)
}
```

Potential integrations can be added later without changing Order
Service.

------------------------------------------------------------------------

# 26. Reporting Service

Reporting must not overload transactional databases.

Reports:

-   Daily sales
-   Monthly sales
-   Revenue
-   Average order value
-   Best-selling products
-   Low-stock products
-   Customer acquisition
-   Conversion
-   Abandoned carts
-   Coupon performance
-   Marketplace sales
-   Refunds
-   Payment failures

For complex analytics, create read models or a separate analytics
database later.

------------------------------------------------------------------------

# 27. Worker Service

Background jobs:

``` text
cart reminder
email
SMS
product indexing
marketplace sync
stock sync
price sync
order sync
invoice generation
report generation
cleanup
```

Workers must be idempotent.

A job can execute more than once without corrupting business data.

------------------------------------------------------------------------

# 28. Event-Driven Architecture

Use a message broker.

Recommended:

``` text
NATS JetStream
```

Alternative:

``` text
RabbitMQ
```

Event naming:

``` text
domain.entity.action
```

Examples:

``` text
product.created
product.updated
inventory.reserved
inventory.released
cart.updated
cart.abandoned
order.created
order.paid
order.cancelled
shipment.created
shipment.delivered
payment.succeeded
payment.failed
customer.created
review.created
```

Events should contain:

``` json
{
  "event_id": "uuid",
  "event_type": "order.paid",
  "occurred_at": "timestamp",
  "aggregate_id": "uuid",
  "version": 1,
  "payload": {}
}
```

------------------------------------------------------------------------

# 29. Outbox Pattern

Critical services must use an outbox table.

Example:

``` text
orders
outbox_events
```

Transaction:

``` text
BEGIN

create order

insert outbox event

COMMIT
```

A publisher reads `outbox_events` and publishes to the broker.

This prevents:

``` text
DB committed
BUT
event was never published
```

------------------------------------------------------------------------

# 30. Idempotency

All externally-triggered operations must support idempotency.

Especially:

-   Payment webhook
-   Order creation
-   Refund
-   Marketplace order import
-   Shipment creation
-   Invoice creation

Use:

``` text
idempotency_keys
```

Example:

``` http
Idempotency-Key: 8f9b...
```

------------------------------------------------------------------------

# 31. Database Strategy

Use PostgreSQL.

For a small/medium initial deployment, a single PostgreSQL cluster can
host separate databases/schemas.

Preferred logical ownership:

``` text
catalog
inventory
customer
cart
order
payment
shipment
marketplace
```

The long-term architecture should allow physically separating databases
per service.

Critical rule:

A service must not directly query another service's tables.

------------------------------------------------------------------------

# 32. Redis Usage

Redis should be used for:

-   Cart
-   Sessions
-   Rate limiting
-   Cache
-   Distributed locks
-   Temporary checkout data
-   Idempotency keys
-   Short-lived OTP
-   Product cache

Do not use Redis as the only source of truth for orders/payments.

------------------------------------------------------------------------

# 33. API Versioning

Public API:

``` text
/api/v1/...
```

Examples:

``` text
GET    /api/v1/products
GET    /api/v1/products/:slug
POST   /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:id
DELETE /api/v1/cart/items/:id
POST   /api/v1/checkout
GET    /api/v1/orders
GET    /api/v1/orders/:id
```

Admin:

``` text
/api/v1/admin/products
/api/v1/admin/orders
/api/v1/admin/customers
```

Admin endpoints must require admin permissions.

------------------------------------------------------------------------

# 34. Next.js Storefront

Suggested route structure:

``` text
apps/storefront/app/
├── (store)/
│   ├── page.tsx
│   ├── products/
│   ├── category/
│   ├── brands/
│   ├── search/
│   ├── cart/
│   ├── checkout/
│   ├── account/
│   └── orders/
│
├── auth/
│   ├── login/
│   ├── register/
│   └── forgot-password/
│
├── api/
│   └── bff/
│
├── sitemap.ts
├── robots.ts
└── layout.tsx
```

SEO must be first-class.

Product pages need:

-   canonical URL
-   metadata
-   OpenGraph
-   JSON-LD
-   Product schema
-   Breadcrumb schema
-   Organization schema

------------------------------------------------------------------------

# 35. Next.js Admin

Suggested:

``` text
apps/admin/app/
├── login/
├── dashboard/
├── products/
├── categories/
├── brands/
├── inventory/
├── orders/
├── customers/
├── promotions/
├── coupons/
├── reviews/
├── marketplaces/
├── shipments/
├── payments/
├── invoices/
├── reports/
├── settings/
└── audit-logs/
```

Admin should use RBAC.

Example:

``` text
Catalog Manager
    → products/categories only

Order Manager
    → orders/shipments

Accounting
    → payments/invoices

Super Admin
    → everything
```

------------------------------------------------------------------------

# 36. Shared TypeScript Packages

``` text
packages/
├── ui/
├── api-client/
├── api-types/
├── validation/
├── eslint-config/
└── typescript-config/
```

`api-client` should wrap backend HTTP APIs.

Example:

``` ts
products.getBySlug(slug)
cart.addItem(...)
checkout.create(...)
orders.getMine(...)
```

Do not scatter raw `fetch()` calls throughout the frontend.

------------------------------------------------------------------------

# 37. Authentication Flow

Customer:

``` text
Browser
 ↓
Next.js
 ↓
Gateway
 ↓
Auth Service
```

Use secure HTTP-only cookies where appropriate.

Never expose refresh tokens to JavaScript.

Admin authentication should have stronger controls:

-   Short access token lifetime
-   Refresh token rotation
-   Optional 2FA
-   Login audit
-   IP/device metadata where legally appropriate

------------------------------------------------------------------------

# 38. Product Page Flow

``` text
User opens:

/urun/beko-example
        ↓
Next.js Server Component
        ↓
API Gateway
        ↓
Catalog Service
        ↓
Redis cache
        ↓
PostgreSQL
```

Cache public product data aggressively.

Do not cache customer-specific prices as global product cache.

------------------------------------------------------------------------

# 39. Add-to-Cart Flow

``` text
POST /cart/items

Gateway
 ↓
Cart Service
 ↓
Catalog validation
 ↓
Pricing validation
 ↓
Inventory availability
 ↓
Redis cart
 ↓
cart.updated event
```

Frontend must never determine the final price.

------------------------------------------------------------------------

# 40. Checkout Flow

``` text
Customer
 ↓
Checkout
 ↓
Validate cart
 ↓
Validate stock
 ↓
Reserve stock
 ↓
Create pending order
 ↓
Create payment
 ↓
Payment provider
 ↓
Webhook
 ↓
Payment Service
 ↓
payment.succeeded
 ↓
Order Service
 ↓
Order = PAID
 ↓
Inventory Service
 ↓
Commit stock
 ↓
Notification
 ↓
Shipment
```

Payment webhook is the authoritative source for payment success.

Do not mark orders as paid merely because the frontend redirected
successfully.

------------------------------------------------------------------------

# 41. Abandoned Cart Flow

``` text
cart.updated
      ↓
Worker schedules reminder
      ↓
1 hour
      ↓
Check cart
      ↓
No order?
      ↓
Send email
      ↓
24 hours
      ↓
Check cart
      ↓
Send second reminder
```

Optional:

``` text
72 hours
 ↓
Coupon
 ↓
Final reminder
```

Coupon should only be issued if business rules allow it.

------------------------------------------------------------------------

# 42. Order Flow

``` text
order.created
 ↓
payment.pending
 ↓
payment.succeeded
 ↓
order.paid
 ↓
warehouse processing
 ↓
shipment.created
 ↓
shipment.shipped
 ↓
shipment.delivered
```

Each transition must be validated.

Do not allow:

``` text
DELIVERED → PENDING
```

unless an explicit administrative workflow supports it.

------------------------------------------------------------------------

# 43. Inventory Reservation

Example:

``` text
Stock = 5

Customer A checkout:
reserve 2

Available:
3

Customer B checkout:
reserve 3

Available:
0
```

If payment fails:

``` text
release reservation
```

If payment succeeds:

``` text
convert reservation → sold
```

Reservations must have expiration.

------------------------------------------------------------------------

# 44. Security Requirements

Mandatory:

-   Password hashing with Argon2id or bcrypt
-   JWT validation
-   HTTP-only cookies where applicable
-   CSRF protection for cookie-authenticated state-changing requests
-   CORS restrictions
-   Rate limiting
-   Request validation
-   SQL parameterization
-   No secrets in source code
-   Secret manager/env variables
-   Audit logs
-   Security headers
-   File upload validation
-   MIME/type validation
-   Maximum upload size
-   Image processing sandboxing
-   Webhook signature verification
-   Idempotency

Never log:

``` text
password
access token
refresh token
card number
CVV
payment secrets
```

------------------------------------------------------------------------

# 45. File Storage

Product images should not be stored in PostgreSQL.

Use S3-compatible storage:

``` text
MinIO locally
S3-compatible production storage
```

Structure:

``` text
products/{product_id}/original/
products/{product_id}/optimized/
products/{product_id}/thumbnail/
```

Store only metadata in PostgreSQL.

------------------------------------------------------------------------

# 46. Image Processing

Product image pipeline:

``` text
Upload
 ↓
Object Storage
 ↓
Image Worker
 ↓
Resize
 ↓
WebP/AVIF
 ↓
Thumbnail
 ↓
CDN
```

Original files should be preserved when necessary.

------------------------------------------------------------------------

# 47. Observability

Every request needs:

``` text
request_id
trace_id
user_id when available
service
route
status
latency
```

Use OpenTelemetry.

Metrics:

``` text
http_requests_total
http_request_duration
orders_created_total
payments_succeeded_total
payments_failed_total
cart_abandonment_total
inventory_reservation_failed_total
marketplace_sync_failed_total
```

------------------------------------------------------------------------

# 48. Logging

Use structured JSON.

Example:

``` json
{
  "level": "info",
  "service": "order-service",
  "event": "order.created",
  "order_id": "uuid",
  "customer_id": "uuid",
  "request_id": "uuid",
  "timestamp": "..."
}
```

Never use random `fmt.Println()` for production logs.

------------------------------------------------------------------------

# 49. Testing Strategy

Every service should have:

### Unit tests

Domain logic:

``` text
promotion calculation
price calculation
inventory reservation
order state transition
coupon validation
```

### Integration tests

Use PostgreSQL/Redis containers.

### API tests

Test HTTP endpoints.

### Contract tests

Gateway ↔ services.

### End-to-end tests

At minimum:

``` text
Register
Login
Browse product
Add to cart
Checkout
Payment
Order
Shipment
```

------------------------------------------------------------------------

# 50. Development Environment

`docker-compose.yml` should provide:

``` text
postgres
redis
nats
minio
mailpit
gateway
services
```

Optional:

``` text
prometheus
grafana
jaeger
```

Local URLs:

``` text
Storefront:
http://localhost:3000

Admin:
http://localhost:3001

Gateway:
http://localhost:8080

MinIO:
http://localhost:9001

Mailpit:
http://localhost:8025
```

------------------------------------------------------------------------

# 51. Environment Variables

Use:

``` text
.env
.env.local
.env.example
```

Never commit real secrets.

Example:

``` env
APP_ENV=development

DATABASE_URL=postgres://...
REDIS_URL=redis://...
NATS_URL=nats://...

JWT_SECRET=
JWT_REFRESH_SECRET=

S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

PAYMENT_PROVIDER=
PAYMENT_API_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
```

------------------------------------------------------------------------

# 52. Docker

Each Go service gets its own Dockerfile.

Example:

``` text
services/backend/catalog/Dockerfile
services/backend/order/Dockerfile
services/backend/payment/Dockerfile
```

Use multi-stage builds:

``` text
golang builder
      ↓
small runtime image
```

Do not ship the Go compiler in the production runtime image.

------------------------------------------------------------------------

# 53. CI/CD

GitHub Actions:

``` text
Pull Request
 ↓
Lint
 ↓
Typecheck
 ↓
Unit tests
 ↓
Integration tests
 ↓
Build
 ↓
Docker build
 ↓
Security scan
```

Main branch:

``` text
Build
 ↓
Push image
 ↓
Deploy
 ↓
Migration
 ↓
Health check
```

Never deploy if migrations fail.

------------------------------------------------------------------------

# 54. Database Migrations

Never rely on:

``` text
AutoMigrate
```

for production schema management.

Use versioned migrations:

``` text
000001_create_customers.sql
000002_create_products.sql
000003_create_orders.sql
```

Migration tool can be:

-   golang-migrate
-   Atlas

Every schema change must have a migration.

------------------------------------------------------------------------

# 55. API Documentation

Use OpenAPI.

Generate:

``` text
docs/api/openapi.yaml
```

API changes should update the specification.

------------------------------------------------------------------------

# 56. Go Coding Rules

The developer/AI must follow these rules:

1.  Use `context.Context` for I/O.
2.  Return errors instead of panicking.
3.  Wrap errors with useful context.
4.  Keep handlers thin.
5.  Business logic belongs in application/domain layers.
6.  Database access belongs in repositories.
7.  Do not import infrastructure into domain code.
8.  Avoid global mutable state.
9.  Prefer dependency injection through constructors.
10. Keep interfaces small.
11. Do not create interfaces just for every struct.
12. Use typed errors where useful.
13. Use transactions explicitly.
14. Use UTC internally.
15. Store money as integer minor units or a safe decimal representation.
16. Never use floating point for monetary calculations.
17. Use UUIDs for distributed entities where appropriate.
18. Validate all external input.
19. Make consumers idempotent.
20. Add tests for business-critical logic.

------------------------------------------------------------------------

# 57. Money Representation

Never:

``` go
float64
```

for money.

Prefer:

``` go
int64
```

representing kuruş.

Example:

``` text
1.299,99 TL

129999 kuruş
```

API can expose:

``` json
{
  "amount": 129999,
  "currency": "TRY"
}
```

or a clear decimal string contract.

------------------------------------------------------------------------

# 58. Time

Store timestamps in UTC.

Example:

``` text
2026-09-11T19:30:00Z
```

Convert to Turkish local time only at presentation boundaries.

------------------------------------------------------------------------

# 59. Admin Audit Log

Every sensitive admin operation must be auditable.

Example:

``` text
admin.user.updated
product.price.changed
order.cancelled
inventory.adjusted
coupon.created
customer.blocked
```

Audit record:

``` text
id
actor_id
action
entity_type
entity_id
before
after
ip
user_agent
created_at
```

------------------------------------------------------------------------

# 60. Customer Data / KVKK

The platform operates in Turkey.

Design for KVKK requirements.

Include:

-   consent records
-   privacy policy version
-   marketing consent
-   data deletion/anonymization workflow
-   account deletion
-   data export capability where required
-   retention policies

Do not permanently retain unnecessary personal data.

------------------------------------------------------------------------

# 61. SEO

Storefront must be SEO-first.

Product page:

``` text
/urun/{slug}
```

Category:

``` text
/kategori/{slug}
```

Brand:

``` text
/marka/{slug}
```

Search pages should have carefully controlled indexing rules.

Generate:

``` text
sitemap.xml
robots.txt
```

Use structured data.

------------------------------------------------------------------------

# 62. Caching Strategy

Cache:

``` text
Product detail
Category
Brand
Search suggestions
Public configuration
```

Do not blindly cache:

``` text
Cart
Checkout
Payment
Customer balance
Order status
Inventory-sensitive information
```

Use cache invalidation events:

``` text
product.updated
price.updated
inventory.updated
```

------------------------------------------------------------------------

# 63. Microservice Boundaries

The minimum production architecture should be:

``` text
                    ┌───────────────┐
                    │   Storefront  │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │ API Gateway   │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   Catalog             Customer              Cart
        │                   │                   │
   Inventory             Auth              Checkout
        │                                       │
   Pricing                                  Order
        │                                       │
 Promotion                                  Payment
                                                │
                                            Shipment
                                                │
                                          Notification
                                                │
                                          Marketplace
```

Event broker connects services asynchronously.

------------------------------------------------------------------------

# 64. Important Architecture Decision

Do not create 20 independently deployed services on day one if there is
only one developer.

Use a **modular microservice architecture**.

Phase 1 can deploy:

``` text
gateway
core-commerce
payment
notification
marketplace
worker
```

while keeping strong internal domain boundaries.

Later split:

``` text
core-commerce
→ catalog
→ inventory
→ pricing
→ cart
→ order
```

into separate deployments.

The code must be designed so this split does not require rewriting the
domain.

------------------------------------------------------------------------

# 65. Recommended Phase Plan

## Phase 1 --- Foundation

-   Monorepo
-   Next.js storefront
-   Next.js admin
-   Go gateway
-   Auth
-   Customer
-   Catalog
-   PostgreSQL
-   Redis
-   Docker
-   CI

## Phase 2 --- Commerce

-   Cart
-   Inventory
-   Pricing
-   Promotion
-   Checkout
-   Order

## Phase 3 --- Payment

-   Payment abstraction
-   Payment provider
-   Webhooks
-   Refund
-   Idempotency

## Phase 4 --- Fulfillment

-   Shipment
-   Tracking
-   Notification
-   Email
-   SMS

## Phase 5 --- Growth

-   Wishlist
-   Reviews
-   Search
-   Coupons
-   Abandoned cart
-   Customer segmentation

## Phase 6 --- Marketplace

-   Trendyol
-   Hepsiburada
-   Product sync
-   Stock sync
-   Price sync
-   Order import
-   Shipment sync

## Phase 7 --- Enterprise

-   Accounting
-   E-invoice
-   Advanced reporting
-   Analytics
-   Recommendation engine
-   Advanced promotion engine

------------------------------------------------------------------------

# 66. MVP Priority

If the goal is to get the business live quickly, implement in exactly
this order:

``` text
1. Auth
2. Customer
3. Catalog
4. Admin product management
5. Storefront product pages
6. Inventory
7. Cart
8. Checkout
9. Payment
10. Order
11. Shipment
12. Notification
13. Abandoned cart
14. Search
15. Coupon
16. Wishlist
17. Reviews
18. Marketplace integrations
19. Reporting
20. Accounting
```

Do not start with marketplace integrations.

The internal order lifecycle must work correctly first.

------------------------------------------------------------------------

# 67. AI Coding Agent Instructions

The AI developer must obey these rules.

## Rule 1 --- Read this document first

Before writing code, inspect:

``` text
README.md
ARCHITECTURE.md
docs/
```

Do not invent an alternative architecture without a documented reason.

## Rule 2 --- Do not rewrite existing services unnecessarily

Before modifying code:

1.  Locate the relevant service.
2.  Read existing interfaces.
3.  Read existing tests.
4.  Identify dependencies.
5.  Make the smallest safe change.

## Rule 3 --- No cross-service database access

Never do:

``` text
Order Service → SELECT catalog.products
```

Instead:

``` text
Order Service → Catalog API/event
```

## Rule 4 --- Events must be versioned

Do not silently change an existing event payload.

Create:

``` text
version: 2
```

or a new event type.

## Rule 5 --- Business logic must be tested

Any change affecting:

-   price
-   stock
-   payment
-   order state
-   promotion
-   coupon

requires tests.

## Rule 6 --- Never trust frontend calculations

Backend recalculates:

``` text
price
discount
tax
shipping
total
stock
```

## Rule 7 --- No secret values in code

Use environment variables/secrets.

## Rule 8 --- No production shortcuts

Do not use:

``` text
synchronize=true
float64 money
plaintext passwords
unverified webhooks
non-idempotent consumers
frontend-controlled order totals
```

------------------------------------------------------------------------

# 68. Example Repository Root

Final root should look like:

``` text
adb-ticaret/
├── apps/
│   ├── storefront/
│   └── admin/
│
├── services/
│   └── backend/
│       ├── gateway/
│       ├── auth/
│       ├── customer/
│       ├── catalog/
│       ├── inventory/
│       ├── pricing/
│       ├── promotion/
│       ├── cart/
│       ├── checkout/
│       ├── order/
│       ├── payment/
│       ├── shipment/
│       ├── notification/
│       ├── search/
│       ├── review/
│       ├── wishlist/
│       ├── marketplace/
│       ├── accounting/
│       ├── reporting/
│       └── worker/
│
├── packages/
│   ├── ui/
│   ├── api-client/
│   ├── api-types/
│   ├── validation/
│   ├── eslint-config/
│   └── typescript-config/
│
├── infrastructure/
├── deployments/
├── docs/
├── scripts/
├── .github/
├── docker-compose.yml
├── Makefile
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

------------------------------------------------------------------------

# 69. Final Definition of Done

The project is not considered production-ready until:

-   [ ] Storefront works
-   [ ] Admin works
-   [ ] Authentication works
-   [ ] RBAC works
-   [ ] Product CRUD works
-   [ ] Product variants work
-   [ ] Inventory works
-   [ ] Cart works
-   [ ] Guest cart works
-   [ ] Cart merge works
-   [ ] Checkout validates server-side
-   [ ] Payment works
-   [ ] Payment webhook is verified
-   [ ] Webhook processing is idempotent
-   [ ] Orders work
-   [ ] Refund works
-   [ ] Shipment works
-   [ ] Notification works
-   [ ] Abandoned cart reminder works
-   [ ] Coupon system works
-   [ ] Search works
-   [ ] Wishlist works
-   [ ] Reviews work
-   [ ] Marketplace architecture exists
-   [ ] Trendyol adapter can be added without changing order/catalog
    domains
-   [ ] Hepsiburada adapter can be added without changing order/catalog
    domains
-   [ ] Audit logs work
-   [ ] Database migrations are versioned
-   [ ] Unit tests exist
-   [ ] Integration tests exist
-   [ ] E2E checkout test exists
-   [ ] OpenAPI documentation exists
-   [ ] Logs are structured
-   [ ] Metrics exist
-   [ ] Tracing exists
-   [ ] Docker deployment works
-   [ ] CI passes
-   [ ] Secrets are not committed
-   [ ] KVKK-related data controls are designed
-   [ ] Production backups are configured
-   [ ] Health checks exist
-   [ ] Graceful shutdown exists
-   [ ] Rate limiting exists
-   [ ] Error responses are standardized

------------------------------------------------------------------------

# 70. Recommended Technology Summary

  Layer             Technology
  ----------------- --------------------------------------------------
  Storefront        Next.js + TypeScript
  Admin             Next.js + TypeScript
  Monorepo          Yarn Berry + Turborepo (nodeLinker: node-modules)
  Backend           Go
  HTTP              REST/JSON
  Internal RPC      gRPC where useful
  Database          PostgreSQL
  Cache             Redis
  Broker            NATS JetStream
  Object Storage    S3-compatible / MinIO
  Search            PostgreSQL FTS initially
  Search later      Meilisearch/OpenSearch
  Validation        Zod frontend / Go validation backend
  Auth              JWT + HTTP-only cookies
  Jobs              Go workers + NATS
  API Docs          OpenAPI
  Logging           Structured JSON
  Observability     OpenTelemetry
  Metrics           Prometheus-compatible
  Containers        Docker
  CI/CD             GitHub Actions
  Reverse Proxy     Nginx
  Testing           Go testing + integration containers + Playwright
  CSS               Tailwind
  Package Manager   Yarn Berry (+ Volta)
  Deploy target     Single Hetzner host (Docker Compose)

------------------------------------------------------------------------

# 71. Most Important Principle

The objective is **not** to create a complicated folder structure.

The objective is:

``` text
Clear domain boundaries
        +
Independent business modules
        +
Reliable events
        +
Idempotent operations
        +
Strong database ownership
        +
Scalable frontend
        +
Observable infrastructure
```

The architecture should start small enough for one developer but be
capable of evolving into a large e-commerce platform without a complete
rewrite.

When uncertain, prefer:

``` text
simple
explicit
testable
observable
idempotent
```

over:

``` text
clever
abstract
over-engineered
```
