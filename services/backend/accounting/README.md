# Accounting Service

## Bu servis ne yapar?

E-fatura / e-arsiv hazirligi. Order servisini degistirmeden provider eklenebilir.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8097` (env: `HTTP_ADDR`)

- Schema: `accounting`

## Eventler

`invoice.created`

## Lokal calistirma

```bash
cd services/backend/accounting
go run ./cmd/accounting
```

Health: `GET http://localhost:8097/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
