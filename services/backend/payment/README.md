# Payment Service

PSP-agnostik ödeme katmanı. Sprint B'de `mock` provider + webhook idempotency.

## Endpointler

- `POST /v1/payments` — ödeme intent (Idempotency-Key destekli)
- `POST /v1/payments/webhook` — imzalı webhook (`X-Payment-Signature`)
- `GET /v1/payments/by-order/{orderId}`
- `POST /v1/payments/{id}/simulate-success` — sadece development

## Env

```
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=
PAYMENT_API_KEY=
```

Port: `8090` · Schema: `payment`
