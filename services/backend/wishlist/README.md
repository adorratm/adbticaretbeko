# Wishlist Service

## Bu servis ne yapar?

Favori urun listesi, stok ve fiyat dususu sinyalleri.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8095` (env: `HTTP_ADDR`)

- Schema: `wishlist`

## Eventler

`wishlist.product_added`

## Lokal calistirma

```bash
cd services/backend/wishlist
go run ./cmd/wishlist
```

Health: `GET http://localhost:8095/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
