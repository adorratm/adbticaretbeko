# Worker Service

## Bu servis ne yapar?

Arka plan isleri: abandoned cart, indexleme, marketplace sync, temizlik. Idempotent.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8099` (env: `HTTP_ADDR`)

- Schema: `worker`

## Eventler

`job.completed`

## Lokal calistirma

```bash
cd services/backend/worker
go run ./cmd/worker
```

Health: `GET http://localhost:8099/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
