package hepsiburada

import (
	"context"
	"sync"

	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter"
)

// Stub Hepsiburada adapter — HB_* env ile gerçek API bağlanır.
type Adapter struct {
	MerchantID string
	APIKey     string
	mu         sync.Mutex
	lastSync   string
}

func New(merchantID, apiKey string) *Adapter {
	return &Adapter{MerchantID: merchantID, APIKey: apiKey}
}

func (a *Adapter) Name() string { return "hepsiburada" }

func (a *Adapter) PushProduct(_ context.Context, _ adapter.ProductPayload) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastSync = "product_push"
	return nil
}

func (a *Adapter) UpdateStock(_ context.Context, _ string, _ int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastSync = "stock_update"
	return nil
}

func (a *Adapter) UpdatePrice(_ context.Context, _ string, _ int64) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastSync = "price_update"
	return nil
}

func (a *Adapter) PullOrders(_ context.Context) ([]adapter.OrderPayload, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastSync = "order_pull"
	return []adapter.OrderPayload{}, nil
}

func (a *Adapter) Health(_ context.Context) (string, error) {
	if a.APIKey == "" {
		return "stub_offline", nil
	}
	return "online", nil
}

func (a *Adapter) LastSync() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.lastSync
}

func (a *Adapter) Configured() bool { return a.APIKey != "" }
