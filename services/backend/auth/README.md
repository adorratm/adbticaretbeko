# Auth Service

## Bu servis ne yapar?

Müşteri ve admin kimlik doğrulaması: kayıt, giriş, JWT access token, yenilenebilir refresh token, şifre hash (bcrypt), RBAC rolleri.

## Ne yapmaz?

Profil/adres yönetimi yapmaz (Customer Service). Ödeme veya sipariş bilmez.

## Port

`8081` (`HTTP_ADDR`)

- Schema: `auth`

## Eventler

`customer.registered` (ileride), auth audit logları

## Lokal çalıştırma

```bash
cd services/backend/auth
go run ./cmd/auth
```

## Gateway örnekleri

## Auth endpoints

- `POST /v1/auth/register`
- `POST /v1/auth/login` (`audience: admin|customer`)
- `POST /v1/auth/google`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/forgot-password` (dev’de `devResetToken` döner)
- `POST /v1/auth/reset-password`
- `GET /v1/auth/me`
- `GET /v1/admin/users` (ADMIN)

Port: `8081` · Schema: `auth`

