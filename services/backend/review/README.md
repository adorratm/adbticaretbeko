# Review Service

## Bu servis ne yapar?

Urun yorumlari, puan ve moderasyon. Dogrulanmis satin alma kurali.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8094` (env: `HTTP_ADDR`)

- Schema: `review`

## Eventler

`review.created`

## Lokal calistirma

```bash
cd services/backend/review
go run ./cmd/review
```

Health: `GET http://localhost:8094/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
