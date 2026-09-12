package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"
)

type HomeContent struct {
	Announcement string        `json:"announcement"`
	Hero         Hero          `json:"hero"`
	Banners      []Banner      `json:"banners"`
	CategoryIDs  []string      `json:"categoryIds"`
	Store        StoreSettings `json:"store"`
}

type Hero struct {
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	CTALabel    string `json:"ctaLabel"`
	CTAHref     string `json:"ctaHref"`
	ImageURL    string `json:"imageUrl"`
	Active      bool   `json:"active"`
}

type Banner struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	CTALabel string `json:"ctaLabel"`
	CTAHref  string `json:"ctaHref"`
	ImageURL string `json:"imageUrl"`
	Active   bool   `json:"active"`
}

type StoreSettings struct {
	DealerCode string `json:"dealerCode"`
	Phone      string `json:"phone"`
	WhatsApp   string `json:"whatsapp"`
	Address    string `json:"address"`
	Branches   string `json:"branches"`
}

type Store struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
	if err != nil {
		return err
	}
	def, _ := json.Marshal(defaultHome())
	_, err = s.db.Exec(ctx, `
INSERT INTO site_content (key, payload) VALUES ('home', $1::jsonb)
ON CONFLICT (key) DO NOTHING
`, string(def))
	return err
}

func defaultHome() HomeContent {
	return HomeContent{
		Announcement: "BEKO YETKİLİ SATICISI · Ücretsiz Montaj · Resmi Bayi",
		Hero: Hero{
			Title:    "Takas’ta 15.000 TL’ye varan indirim",
			Subtitle: "Eski cihazınızı getirin, yeni Beko ile tanışın. Ücretsiz montaj ve resmi garanti.",
			CTALabel: "Kampanyaları İncele",
			CTAHref:  "/kampanyalar",
			Active:   true,
		},
		Banners: []Banner{{
			ID: "ceyiz", Title: "Çeyiz Paketleri", Subtitle: "Ücretsiz depolama ile paketini yapılandır",
			CTALabel: "Paketleri Gör", CTAHref: "/kampanyalar", Active: true,
		}},
		CategoryIDs: []string{},
		Store: StoreSettings{
			DealerCode: "BEKO-TR-340982",
			Phone:      "0850 300 23 56",
			WhatsApp:   "08503002356",
			Address:    "İstanbul · Bursa · Kocaeli",
			Branches:   "Beşiktaş, Kadıköy, Bursa Nilüfer",
		},
	}
}

func (s *Store) GetHome(ctx context.Context) (*HomeContent, error) {
	var raw []byte
	err := s.db.QueryRow(ctx, `SELECT payload FROM site_content WHERE key = 'home'`).Scan(&raw)
	if err != nil {
		h := defaultHome()
		return &h, nil
	}
	var h HomeContent
	if err := json.Unmarshal(raw, &h); err != nil {
		return nil, err
	}
	return &h, nil
}

func (s *Store) SaveHome(ctx context.Context, h HomeContent) error {
	raw, err := json.Marshal(h)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `
INSERT INTO site_content (key, payload, updated_at) VALUES ('home', $1::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
`, string(raw))
	return err
}
