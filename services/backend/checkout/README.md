# Checkout Service

## Bu servis ne yapar?

Orkestrasyon: sepet/fiyat/stok dogrulama, rezervasyon, pending order ve payment intent.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8088` (env: `HTTP_ADDR`)

- Schema: yok (orkestrasyon)

## Eventler

`checkout.created`

## Lokal calistirma

```bash
cd services/backend/checkout
go run ./cmd/checkout
```

Health: `GET http://localhost:8088/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
