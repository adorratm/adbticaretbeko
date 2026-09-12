# Reporting Service

## Bu servis ne yapar?

Satis ve donusum raporlari. Transactional DB yi yormamak icin read-model.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8098` (env: `HTTP_ADDR`)

- Schema: `reporting`

## Eventler

`report.generated`

## Lokal calistirma

```bash
cd services/backend/reporting
go run ./cmd/reporting
```

Health: `GET http://localhost:8098/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
