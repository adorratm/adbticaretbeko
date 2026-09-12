# Promotion Service

## Bu servis ne yapar?

Kupon, kampanya ve indirim kurallarini sunucu tarafında hesaplar.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8086` (env: `HTTP_ADDR`)

- Schema: `promotion`

## Eventler

`promotion.applied`

## Lokal calistirma

```bash
cd services/backend/promotion
go run ./cmd/promotion
```

Health: `GET http://localhost:8086/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
