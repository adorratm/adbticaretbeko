# Cart Service

## Bu servis ne yapar?

Misafir ve uye sepetleri. Aktif sepet Redis, dayanikli kayit PostgreSQL. Login sonrasi merge.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8087` (env: `HTTP_ADDR`)

- Schema: `cart`

## Eventler

`cart.updated, cart.abandoned`

## Lokal calistirma

```bash
cd services/backend/cart
go run ./cmd/cart
```

Health: `GET http://localhost:8087/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
