package mockpsp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/adbticaret/adbticaretbeko/services/backend/payment/internal/provider"
	"github.com/google/uuid"
)

// Dev/mock PSP — production'da iyzico/PayTR adapter ile değiştirilir.
type Provider struct {
	WebhookSecret string
}

func (p *Provider) Name() string { return "mock" }

func (p *Provider) CreatePayment(_ context.Context, req provider.CreatePaymentRequest) (*provider.PaymentResult, error) {
	id := "mock_" + uuid.NewString()
	// Storefront mock PSP sayfası — gerçek iyzico/PayTR yerine local onay
	base := strings.TrimRight(req.ReturnURL, "/")
	// returnUrl .../odeme/sonuc → mock checkout .../odeme/mock
	checkout := strings.Replace(base, "/odeme/sonuc", "/odeme/mock", 1)
	if checkout == base {
		checkout = base + "/../odeme/mock"
	}
	checkout = fmt.Sprintf("%s?paymentId=%s&orderId=%s&amount=%d", checkout, id, req.OrderID, req.AmountKurus)
	return &provider.PaymentResult{
		ProviderPaymentID: id,
		Status:            "pending",
		CheckoutURL:       checkout,
		Raw: map[string]any{
			"provider": "mock",
			"amount":   req.AmountKurus,
		},
	}, nil
}

func (p *Provider) RefundPayment(_ context.Context, _ provider.RefundRequest) error {
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
