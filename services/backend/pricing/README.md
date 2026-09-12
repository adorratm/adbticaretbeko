# Pricing Service

## Bu servis ne yapar?

Liste fiyati, musteri grubu ve pazaryeri fiyatlari. Fiyat catalog icine gomulmez.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8085` (env: `HTTP_ADDR`)

- Schema: `pricing`

## Eventler

`price.updated`

## Lokal calistirma

```bash
cd services/backend/pricing
go run ./cmd/pricing
```

Health: `GET http://localhost:8085/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
