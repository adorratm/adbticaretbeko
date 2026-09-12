module github.com/adbticaret/adbticaretbeko/services/backend/cart

go 1.27

require (
	github.com/adbticaret/adbticaretbeko/shared v0.0.0
	github.com/google/uuid v1.6.0
	github.com/redis/go-redis/v9 v9.22.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/klauspost/cpuid/v2 v2.4.0 // indirect
	github.com/stretchr/testify v1.11.1 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	golang.org/x/sys v0.48.0 // indirect
)

replace github.com/adbticaret/adbticaretbeko/shared => ../../../shared/go
