# Catalog Service

## Bu servis ne yapar?

Ürün, kategori, marka, varyant ve SEO meta verisi. E-ticaret katalogunun kalbi.

## Ne yapmaz?

Stok tutmaz (Inventory). Liste fiyatını sahiplenmez (Pricing). Sepet bilmez.

## Port

`8083` (`HTTP_ADDR`)

- Schema: `catalog`

## Eventler

`product.created`, `product.updated`, `product.deleted`

## Lokal çalıştırma

```bash
cd services/backend/catalog
go run ./cmd/catalog
```

## Gateway örnekleri

- `GET /api/v1/products`
- `GET /api/v1/products/{slug}`
- `GET /api/v1/categories`
- `GET /api/v1/brands`
- `POST /api/v1/admin/products` (admin / `X-Dev-Admin: 1`)
