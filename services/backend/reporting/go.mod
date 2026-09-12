module github.com/adbticaret/adbticaretbeko/services/backend/reporting

go 1.24

require (
	github.com/adbticaret/adbticaretbeko/shared v0.0.0
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.5
)

replace github.com/adbticaret/adbticaretbeko/shared => ../../../shared/go
