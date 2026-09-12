package provider

import "context"

type CreatePaymentRequest struct {
	OrderID     string
	AmountKurus int64
	Currency    string
	CustomerID  string
	ReturnURL   string
	CallbackURL string
}

type PaymentResult struct {
	ProviderPaymentID string
	Status            string // pending | succeeded | failed
	CheckoutURL       string
	Raw               map[string]any
}

type RefundRequest struct {
	ProviderPaymentID string
	AmountKurus       int64
	Reason            string
}

type PaymentProvider interface {
	Name() string
	CreatePayment(ctx context.Context, req CreatePaymentRequest) (*PaymentResult, error)
	RefundPayment(ctx context.Context, req RefundRequest) error
	GetPayment(ctx context.Context, providerPaymentID string) (*PaymentResult, error)
	VerifyWebhook(ctx context.Context, payload []byte, signature string) (map[string]any, error)
}
