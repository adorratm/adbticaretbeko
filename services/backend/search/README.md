# Search Service

## Bu servis ne yapar?

Urun arama. Ilk etap PostgreSQL FTS; sonra Meilisearch/OpenSearch.

## Ne yapmaz?

Baska servisin veritabanina dogrudan erismez. Is kurallarini gateway icine koymaz.

## Port

`8093` (env: `HTTP_ADDR`)

- Schema: `search`

## Eventler

`search.indexed`

## Lokal calistirma

```bash
cd services/backend/search
go run ./cmd/search
```

Health: `GET http://localhost:8093/healthz`

## Gateway ornegi

Henuz Phase 1 disinda; is mantigi sonraki fazlarda eklenecek. Health endpoint hazir.
