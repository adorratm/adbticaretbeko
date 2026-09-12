package googleauth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Profile struct {
	Sub           string
	Email         string
	EmailVerified bool
	GivenName     string
	FamilyName    string
	Name          string
}

func VerifyIDToken(clientID, idToken string) (*Profile, error) {
	if clientID == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID not configured")
	}
	if strings.TrimSpace(idToken) == "" {
		return nil, errors.New("id token required")
	}

	u := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google tokeninfo status %d", resp.StatusCode)
	}

	var raw struct {
		Aud           string `json:"aud"`
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Name          string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	if raw.Aud != clientID {
		return nil, errors.New("audience mismatch")
	}
	verified := raw.EmailVerified == "true" || raw.EmailVerified == "1"
	if raw.Email == "" || !verified {
		return nil, errors.New("email not verified")
	}
	return &Profile{
		Sub:           raw.Sub,
		Email:         strings.ToLower(raw.Email),
		EmailVerified: verified,
		GivenName:     raw.GivenName,
		FamilyName:    raw.FamilyName,
		Name:          raw.Name,
	}, nil
}
