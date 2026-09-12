package paytr

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider"
	"github.com/google/uuid"
)

// Stub adapter — gerçek PayTR merchant bilgisi gelince iframe/token akışı bağlanır.
type Provider struct {
	MerchantID    string
	MerchantKey   string
	MerchantSalt  string
	WebhookSecret string
}

func (p *Provider) Name() string { return "paytr" }

func (p *Provider) CreatePayment(_ context.Context, req provider.CreatePaymentRequest) (*provider.PaymentResult, error) {
	id := "ptr_" + uuid.NewString()
	checkout := fmt.Sprintf("%s?provider=paytr&paymentId=%s&orderId=%s", req.ReturnURL, id, req.OrderID)
	if p.MerchantID != "" && p.MerchantKey != "" {
		checkout = fmt.Sprintf("https://www.paytr.com/odeme/guvenli/%s", id)
	}
	return &provider.PaymentResult{
		ProviderPaymentID: id,
		Status:            "pending",
		CheckoutURL:       checkout,
		Raw: map[string]any{
			"provider":   "paytr",
			"amount":     req.AmountKurus,
			"configured": p.MerchantID != "",
			"returnUrl":  req.ReturnURL,
		},
	}, nil
}

func (p *Provider) RefundPayment(_ context.Context, req provider.RefundRequest) error {
	if req.ProviderPaymentID == "" {
		return errors.New("providerPaymentId gerekli")
	}
	return nil
}

func (p *Provider) GetPayment(_ context.Context, providerPaymentID string) (*provider.PaymentResult, error) {
	return &provider.PaymentResult{
		ProviderPaymentID: providerPaymentID,
		Status:            "pending",
	}, nil
}

func (p *Provider) VerifyWebhook(_ context.Context, payload []byte, signature string) (map[string]any, error) {
	secret := p.WebhookSecret
	if secret == "" {
		secret = p.MerchantSalt
	}
	if secret == "" {
		secret = "dev-webhook-secret"
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	if signature != "" && !hmac.Equal([]byte(expected), []byte(signature)) {
		return nil, errors.New("invalid webhook signature")
	}
	var body map[string]any
	if err := json.Unmarshal(payload, &body); err != nil {
		return nil, err
	}
	return body, nil
}
