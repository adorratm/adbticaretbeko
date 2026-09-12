# Customer Service

## Bu servis ne yapar?

Müşteri profili, adresler, KVKK onay kayıtları, etiket/segment alanları için domain.

## Ne yapmaz?

Login/şifre yönetmez (Auth). Sipariş veya sepet tutmaz.

## Port

`8082` (`HTTP_ADDR`)

- Schema: `customer`

## Eventler

`customer.created`, `customer.updated`

## Lokal çalıştırma

```bash
cd services/backend/customer
go run ./cmd/customer
```

## Gateway örnekleri

- `GET /api/v1/customers/me`
- `PATCH /api/v1/customers/me`
- `GET /api/v1/customers/me/addresses`
- `POST /api/v1/customers/me/addresses`
