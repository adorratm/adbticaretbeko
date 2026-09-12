.PHONY: infra down payment shipment notification order checkout gateway auth cms cart catalog inventory pricing search backends help

help:
	@echo "Targets: infra backends auth catalog search gateway ..."

backends:
	powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev-backends.ps1

infra:
	docker compose up -d postgres redis nats minio mailpit

search-infra:
	docker compose --profile search up -d elasticsearch

down:
	docker compose down

payment:
	cd services/backend/payment && go run ./cmd/payment

shipment:
	cd services/backend/shipment && go run ./cmd/shipment

notification:
	cd services/backend/notification && go run ./cmd/notification

order:
	cd services/backend/order && go run ./cmd/order

checkout:
	cd services/backend/checkout && go run ./cmd/checkout

gateway:
	cd services/backend/gateway && go run ./cmd/gateway

auth:
	cd services/backend/auth && go run ./cmd/auth

cms:
	cd services/backend/cms && go run ./cmd/cms

cart:
	cd services/backend/cart && go run ./cmd/cart

catalog:
	cd services/backend/catalog && go run ./cmd/catalog

search:
	cd services/backend/search && go run ./cmd/search

inventory:
	cd services/backend/inventory && go run ./cmd/inventory

pricing:
	cd services/backend/pricing && go run ./cmd/pricing
