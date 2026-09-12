# Marketplace Service

## Bu servis ne yapar?

Trendyol/Hepsiburada adapterlari ve sync motoru. Domain servislerine sızdırılmaz.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8096` (env: `HTTP_ADDR`)

- Schema: `marketplace`

## Eventler

`marketplace.synced`

## Lokal calistirma

```bash
cd services/backend/marketplace
go run ./cmd/marketplace
```

Health: `GET http://localhost:8096/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
