# Inventory Service

## Bu servis ne yapar?

Stok, depo, rezervasyon ve stok hareketlerini yonetir. Checkout once rezervasyon yapar; odeme basarisizsa rezervasyon serbest birakilir.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8084` (env: `HTTP_ADDR`)

- Schema: `inventory`

## Eventler

`inventory.reserved, inventory.released, inventory.adjusted`

## Lokal calistirma

```bash
cd services/backend/inventory
go run ./cmd/inventory
```

Health: `GET http://localhost:8084/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
