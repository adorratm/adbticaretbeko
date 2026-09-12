# ADB Ticaret Beko

Monorepo: Next.js (storefront + admin) + Go mikroservisleri. Tek Hetzner sunucuda Docker Compose ile ayağa kalkacak şekilde tasarlandı.

## Gereksinimler

- [Volta](https://volta.sh) (Node/Yarn pin)
- Node + Yarn (`package.json` volta alanı)
- Go 1.24+
- Docker / Docker Compose

## Hızlı başlangıç

```bash
# 1) Bağımlılıklar
node .yarn/releases/yarn-4.9.2.cjs install

# 2) Altyapı + env
cp .env.example .env
# GOOGLE_CLIENT_ID / NEXT_PUBLIC_GOOGLE_CLIENT_ID / INITIAL_ALLOWED_ADMIN_EMAILS doldurun
docker compose up -d postgres redis nats minio mailpit

# 3) Tüm Go backend'ler (önerilen)
make backends
# veya: powershell -File scripts/dev-backends.ps1

# 4) Frontend
node .yarn/releases/yarn-4.9.2.cjs workspace @adb/storefront dev
node .yarn/releases/yarn-4.9.2.cjs workspace @adb/admin dev

# 5) Smoke (opsiyonel)
powershell -File scripts/smoke-checkout.ps1
```

| Servis | URL |
|--------|-----|
| Storefront | http://localhost:3000 |
| Admin | http://localhost:3001 |
| Gateway | http://localhost:8080 |
| Postgres (Docker) | localhost:5433 |
| MinIO | http://localhost:9001 |
| Mailpit | http://localhost:8025 |

## Go servis haritası

| Servis | Port | Ne işe yarar? |
|--------|------|----------------|
| gateway | 8080 | Public API, routing, CORS |
| auth | 8081 | Email/Google login, JWT |
| customer | 8082 | Profil, adres |
| catalog | 8083 | Ürün, kategori, marka |
| inventory | 8084 | Stok / transfer |
| pricing | 8085 | Fiyat (kuruş) |
| promotion | 8086 | Kupon / kampanya |
| cart | 8087 | Misafir/üye sepet + merge |
| checkout | 8088 | Preview + pending order |
| order | 8089 | Sipariş / montaj pipeline |
| payment | 8090 | mock / iyzico / paytr stub + iade |
| shipment | 8091 | Kargo / tracking |
| notification | 8092 | E-posta / SMS şablonları |
| search | 8093 | ES veya katalog arama |
| review | 8094 | Ürün yorumları |
| wishlist | 8095 | Favoriler |
| marketplace | 8096 | Beko / Trendyol / HB sync |
| accounting | 8097 | E-fatura stub |
| reporting | 8098 | Prim / kota |
| worker | 8099 | Abandoned cart vb. |
| cms | 8100 | Vitrin içerik |
| retail | 8101 | Takas, çeyiz, depolama |

## Öne çıkan akışlar

1. **Checkout:** Sepet → `/odeme` → mock ödeme → sipariş `PAID` + otomatik fatura stub
2. **Admin sipariş:** `/siparisler` montaj pipeline
3. **Pazaryeri:** `/beko-sync` → provider seç (Beko/Trendyol/HB) → products sync → mappings
4. **Favori / yorum:** PDP’de favori + müşteri yorumları
5. **Arama:** Storefront `/arama` ve admin ürün araması (Elasticsearch opsiyonel)

## Admin sayfaları

`/urunler` · `/siparisler` · `/takas` · `/depolama` · `/stok` · `/beko-sync` · `/musteriler` · `/kampanyalar` · `/muhasebe` · `/vitrin` · `/raporlar`

## Dokümanlar

- [Mimari](documents/ADB_Ticaret_ECommerce_Architecture.md)
- [OpenAPI](docs/api/openapi.yaml)
- [Stitch design](stitch/adb_ticaret_corporate_retail_system/DESIGN.md)
