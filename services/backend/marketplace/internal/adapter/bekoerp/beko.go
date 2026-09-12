package bekoerp

import (
	"context"
	"sync"

	"github.com/adbticaret/adbticaretbeko/services/backend/marketplace/internal/adapter"
)

// Stub Beko ERP adapter — gerçek API anahtarları .env ile bağlanır.
type Adapter struct {
	BaseURL   string
	APIKey    string
	DealerCode string
	mu        sync.Mutex
	lastSync  string
	online    bool
}

func New(baseURL, apiKey, dealerCode string) *Adapter {
	a := &Adapter{BaseURL: baseURL, APIKey: apiKey, DealerCode: dealerCode, online: true}
	if apiKey == "" {
		a.online = false // not configured → offline stub mode still usable
	}
	return a
}

func (a *Adapter) Name() string { return "beko-erp" }

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
	if a.online {
		return "online", nil
	}
	return "offline", nil
}

func (a *Adapter) LastSync() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.lastSync
}

func (a *Adapter) Configured() bool { return a.APIKey != "" }
