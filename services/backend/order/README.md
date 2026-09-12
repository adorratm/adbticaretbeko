# Order Service

## Bu servis ne yapar?

Siparis yasam dongusu ve kalem snapshot. Gecmis siparis bilgisi urun kaydina bagli degildir.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8089` (env: `HTTP_ADDR`)

- Schema: `order`

## Eventler

`order.created, order.paid, order.cancelled`

## Lokal calistirma

```bash
cd services/backend/order
go run ./cmd/order
```

Health: `GET http://localhost:8089/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
