package adapter

import "context"

type ProductPayload struct {
	SKU         string
	Name        string
	PriceKurus  int64
	Stock       int
	Barcode     string
	ExternalID  string
}

type OrderPayload struct {
	ExternalID string
	Status     string
	Raw        map[string]any
}

// MarketplaceProvider — Trendyol/HB/Beko ERP ortak arayüzü.
type MarketplaceProvider interface {
	Name() string
	PushProduct(ctx context.Context, p ProductPayload) error
	UpdateStock(ctx context.Context, sku string, stock int) error
	UpdatePrice(ctx context.Context, sku string, priceKurus int64) error
	PullOrders(ctx context.Context) ([]OrderPayload, error)
	Health(ctx context.Context) (string, error)
}
