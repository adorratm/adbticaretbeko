package iyzico

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

// Stub adapter — gerçek iyzico API anahtarı gelince HTTP çağrılarıyla değiştirilir.
type Provider struct {
	APIKey        string
	SecretKey     string
	WebhookSecret string
}

func (p *Provider) Name() string { return "iyzico" }

func (p *Provider) CreatePayment(_ context.Context, req provider.CreatePaymentRequest) (*provider.PaymentResult, error) {
	id := "iyz_" + uuid.NewString()
	checkout := fmt.Sprintf("%s?provider=iyzico&paymentId=%s&orderId=%s", req.ReturnURL, id, req.OrderID)
	if p.APIKey != "" {
		// Gerçek entegrasyonda iyzico checkout form / payment page URL döner.
		checkout = fmt.Sprintf("https://sandbox-api.iyzipay.com/payment/iyzipos/checkoutform/initialize/auth/ecom#%s", id)
	}
	return &provider.PaymentResult{
		ProviderPaymentID: id,
		Status:            "pending",
		CheckoutURL:       checkout,
		Raw: map[string]any{
			"provider":    "iyzico",
			"amount":      req.AmountKurus,
			"configured":  p.APIKey != "",
			"returnUrl":   req.ReturnURL,
			"callbackUrl": req.CallbackURL,
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
