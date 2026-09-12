module github.com/adbticaret/adbticaretbeko/services/backend/auth

go 1.24

require (
	github.com/adbticaret/adbticaretbeko/shared v0.0.0
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.5
	golang.org/x/crypto v0.39.0
)

require (
	github.com/golang-jwt/jwt/v5 v5.2.2 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.15.0 // indirect
	golang.org/x/text v0.26.0 // indirect
)

replace github.com/adbticaret/adbticaretbeko/shared => ../../../shared/go
