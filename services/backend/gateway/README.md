# API Gateway

## Bu servis ne yapar?

Public API giriş noktası. Routing, CORS, request ID, IP token-bucket rate limit (`GATEWAY_RATE_LIMIT_RPS` / `BURST`). **İş kuralı içermez.**

## Ne yapmaz?

Ürün/sepet/sipariş mantığı yazılmaz. Downstream servislere reverse proxy yapar.

## Port

`8080` (`HTTP_ADDR`)

- Schema: yok

## Eventler

Yok (senkron HTTP)

## Lokal çalıştırma

```bash
cd services/backend/gateway
go run ./cmd/gateway
```

## Örnek

`GET http://localhost:8080/api/v1/products` → Catalog `:8083/v1/products`
