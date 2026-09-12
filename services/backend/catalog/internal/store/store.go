package store

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("conflict")

type Brand struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Category struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Slug      string  `json:"slug"`
	ParentID  *string `json:"parentId,omitempty"`
	Tech      string  `json:"tech,omitempty"`
	Icon      string  `json:"icon,omitempty"`
	SortOrder int     `json:"sortOrder"`
	Active    bool    `json:"active"`
	CountHint string  `json:"countHint,omitempty"`
}

type Product struct {
	ID               string           `json:"id"`
	SKU              string           `json:"sku"`
	Name             string           `json:"name"`
	Slug             string           `json:"slug"`
	BrandID          *string          `json:"brandId,omitempty"`
	CategoryID       *string          `json:"categoryId,omitempty"`
	Description      string           `json:"description,omitempty"`
	ShortDescription string           `json:"shortDescription,omitempty"`
	Status           string           `json:"status"`
	Images           []ProductImage   `json:"images,omitempty"`
	Variants         []ProductVariant `json:"variants,omitempty"`
}

type ProductVariant struct {
	ID          string `json:"id"`
	ProductID   string `json:"productId"`
	SKU         string `json:"sku"`
	Barcode     string `json:"barcode,omitempty"`
	Name        string `json:"name"`
	WeightGrams int    `json:"weightGrams,omitempty"`
}

type ProductImage struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	URL       string `json:"url"`
	Alt       string `json:"alt,omitempty"`
	SortOrder int    `json:"sortOrder"`
}

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES categories(id),
    tech TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 100,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    count_hint TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tech TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS count_hint TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    description TEXT,
    short_description TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT,
    name TEXT NOT NULL,
    weight_grams INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
	return err
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	replacer := strings.NewReplacer(
		" ", "-", "ı", "i", "ğ", "g", "ü", "u", "ş", "s", "ö", "o", "ç", "c",
		"İ", "i", "Ğ", "g", "Ü", "u", "Ş", "s", "Ö", "o", "Ç", "c",
	)
	s = replacer.Replace(s)
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-'
		if !ok {
			continue
		}
		if r == '-' {
			if prevDash {
				continue
			}
			prevDash = true
		} else {
			prevDash = false
		}
		b.WriteRune(r)
	}
	return strings.Trim(b.String(), "-")
}

func (s *Store) CreateBrand(ctx context.Context, name string) (*Brand, error) {
	b := Brand{ID: uuid.NewString(), Name: name, Slug: slugify(name)}
	_, err := s.db.Exec(ctx, `INSERT INTO brands (id, name, slug) VALUES ($1,$2,$3)`, b.ID, b.Name, b.Slug)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *Store) ListBrands(ctx context.Context) ([]Brand, error) {
	rows, err := s.db.Query(ctx, `SELECT id, name, slug FROM brands ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Brand
	for rows.Next() {
		var b Brand
		if err := rows.Scan(&b.ID, &b.Name, &b.Slug); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	if out == nil {
		out = []Brand{}
	}
	return out, rows.Err()
}

func (s *Store) CreateCategory(ctx context.Context, name string, parentID *string) (*Category, error) {
	c := Category{
		ID: uuid.NewString(), Name: name, Slug: slugify(name), ParentID: parentID,
		Active: true, SortOrder: 100, Icon: "category",
	}
	_, err := s.db.Exec(ctx, `
INSERT INTO categories (id, name, slug, parent_id, tech, icon, sort_order, active, count_hint)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`, c.ID, c.Name, c.Slug, parentID, c.Tech, c.Icon, c.SortOrder, c.Active, c.CountHint)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) ListCategories(ctx context.Context, activeOnly bool) ([]Category, error) {
	q := `
SELECT id, name, slug, parent_id, COALESCE(tech,''), COALESCE(icon,''), COALESCE(sort_order,100), COALESCE(active,TRUE), COALESCE(count_hint,'')
FROM categories`
	if activeOnly {
		q += ` WHERE COALESCE(active,TRUE)=TRUE`
	}
	q += ` ORDER BY sort_order ASC, name ASC`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.Tech, &c.Icon, &c.SortOrder, &c.Active, &c.CountHint); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if out == nil {
		out = []Category{}
	}
	return out, rows.Err()
}

func (s *Store) UpsertCategoryMeta(ctx context.Context, c Category) (*Category, error) {
	if c.Slug == "" {
		c.Slug = slugify(c.Name)
	}
	var existing Category
	err := s.db.QueryRow(ctx, `
SELECT id, name, slug, parent_id, COALESCE(tech,''), COALESCE(icon,''), COALESCE(sort_order,100), COALESCE(active,TRUE), COALESCE(count_hint,'')
FROM categories WHERE slug=$1
`, c.Slug).Scan(&existing.ID, &existing.Name, &existing.Slug, &existing.ParentID, &existing.Tech, &existing.Icon, &existing.SortOrder, &existing.Active, &existing.CountHint)
	if errors.Is(err, pgx.ErrNoRows) {
		c.ID = uuid.NewString()
		if c.Icon == "" {
			c.Icon = "category"
		}
		_, err = s.db.Exec(ctx, `
INSERT INTO categories (id, name, slug, tech, icon, sort_order, active, count_hint)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
`, c.ID, c.Name, c.Slug, c.Tech, c.Icon, c.SortOrder, c.Active, c.CountHint)
		if err != nil {
			return nil, err
		}
		return &c, nil
	}
	if err != nil {
		return nil, err
	}
	c.ID = existing.ID
	_, err = s.db.Exec(ctx, `
UPDATE categories SET name=$2, tech=$3, icon=$4, sort_order=$5, active=$6, count_hint=$7 WHERE id=$1
`, c.ID, c.Name, c.Tech, c.Icon, c.SortOrder, c.Active, c.CountHint)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) UpdateCategory(ctx context.Context, id string, c Category) (*Category, error) {
	tag, err := s.db.Exec(ctx, `
UPDATE categories SET name=$2, tech=$3, icon=$4, sort_order=$5, active=$6, count_hint=$7 WHERE id=$1
`, id, c.Name, c.Tech, c.Icon, c.SortOrder, c.Active, c.CountHint)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	c.ID = id
	if c.Slug == "" {
		_ = s.db.QueryRow(ctx, `SELECT slug FROM categories WHERE id=$1`, id).Scan(&c.Slug)
	}
	return &c, nil
}

func (s *Store) ReassignProductsBySKU(ctx context.Context, skuToCategorySlug map[string]string) error {
	for sku, slug := range skuToCategorySlug {
		var catID string
		err := s.db.QueryRow(ctx, `SELECT id FROM categories WHERE slug=$1`, slug).Scan(&catID)
		if err != nil {
			continue
		}
		_, _ = s.db.Exec(ctx, `UPDATE products SET category_id=$1, updated_at=NOW() WHERE sku=$2`, catID, sku)
	}
	return nil
}

func InferCategorySlug(name string) string {
	n := strings.ToLower(name)
	replacer := strings.NewReplacer("ı", "i", "ğ", "g", "ü", "u", "ş", "s", "ö", "o", "ç", "c", "İ", "i")
	n = replacer.Replace(n)
	switch {
	case strings.Contains(n, "buzdolab") || strings.Contains(n, "derin dondur") || strings.Contains(n, "no frost"):
		return "buzdolaplari"
	case strings.Contains(n, "camasir") || strings.Contains(n, "kurutma"):
		return "camasir-makineleri"
	case strings.Contains(n, "bulasik"):
		return "bulasik-makineleri"
	case strings.Contains(n, "klima") || strings.Contains(n, "kombi"):
		return "klimalar"
	case strings.Contains(n, "ankastre") || strings.Contains(n, "firin") || strings.Contains(n, "ocak") || strings.Contains(n, "davlunbaz"):
		return "ankastre-setler"
	case strings.Contains(n, "robot") || strings.Contains(n, "supurge") || strings.Contains(n, "smart tv") || strings.Contains(n, "televizyon") || strings.Contains(n, "mikrodalga") || strings.Contains(n, "blender") || strings.Contains(n, " tv") || strings.HasSuffix(n, "tv"):
		return "kucuk-ev-robot"
	default:
		return ""
	}
}

// RemapProductsByNameHints binds products with missing/inactive/wrong categories using name heuristics.
func (s *Store) RemapProductsByNameHints(ctx context.Context, catIDs map[string]string) error {
	rows, err := s.db.Query(ctx, `
SELECT p.id, p.name, COALESCE(c.active, FALSE), COALESCE(c.slug, '')
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, name, slug string
		var active bool
		if err := rows.Scan(&id, &name, &active, &slug); err != nil {
			return err
		}
		inferred := InferCategorySlug(name)
		if inferred == "" {
			continue
		}
		if active && slug == inferred {
			continue
		}
		catID := catIDs[inferred]
		if catID == "" {
			continue
		}
		_, _ = s.db.Exec(ctx, `UPDATE products SET category_id=$1, updated_at=NOW() WHERE id=$2`, catID, id)
	}
	return rows.Err()
}

func (s *Store) DeactivateCategoriesNotIn(ctx context.Context, keepSlugs []string) error {
	if len(keepSlugs) == 0 {
		return nil
	}
	_, err := s.db.Exec(ctx, `
UPDATE categories SET active=FALSE
WHERE slug <> ALL($1::text[])
`, keepSlugs)
	return err
}

func (s *Store) CreateProduct(ctx context.Context, p Product) (*Product, error) {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.Slug == "" {
		p.Slug = slugify(p.Name)
	}
	if p.Status == "" {
		p.Status = "DRAFT"
	}
	_, err := s.db.Exec(ctx, `
INSERT INTO products (id, sku, name, slug, brand_id, category_id, description, short_description, status)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`, p.ID, p.SKU, p.Name, p.Slug, p.BrandID, p.CategoryID, nullEmpty(p.Description), nullEmpty(p.ShortDescription), p.Status)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrConflict
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) ListProducts(ctx context.Context) ([]Product, error) {
	return s.SearchProducts(ctx, "", "")
}

func (s *Store) SearchProducts(ctx context.Context, q, categorySlug string) ([]Product, error) {
	q = strings.TrimSpace(strings.ToLower(q))
	categorySlug = strings.TrimSpace(strings.ToLower(categorySlug))

	query := `
SELECT p.id, p.sku, p.name, p.slug, p.brand_id, p.category_id,
  COALESCE(p.description,''), COALESCE(p.short_description,''), p.status
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE ($1 = '' OR lower(p.name) LIKE '%'||$1||'%' OR lower(p.sku) LIKE '%'||$1||'%' OR lower(p.slug) LIKE '%'||$1||'%'
  OR lower(COALESCE(p.short_description,'')) LIKE '%'||$1||'%' OR lower(p.id::text) LIKE '%'||$1||'%')
  AND ($2 = '' OR c.slug = $2)
ORDER BY p.created_at DESC
`
	rows, err := s.db.Query(ctx, query, q, categorySlug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Slug, &p.BrandID, &p.CategoryID, &p.Description, &p.ShortDescription, &p.Status); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	if out == nil {
		out = []Product{}
	}
	return out, rows.Err()
}

func (s *Store) EnsureCategory(ctx context.Context, name, slug string) (*Category, error) {
	return s.UpsertCategoryMeta(ctx, Category{Name: name, Slug: slug, Active: true, SortOrder: 100})
}

func (s *Store) EnsureBrand(ctx context.Context, name string) (*Brand, error) {
	slug := slugify(name)
	var b Brand
	err := s.db.QueryRow(ctx, `SELECT id, name, slug FROM brands WHERE slug=$1`, slug).Scan(&b.ID, &b.Name, &b.Slug)
	if err == nil {
		return &b, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return s.CreateBrand(ctx, name)
}

func (s *Store) SeedDemo(ctx context.Context) error {
	// Storefront “Popüler Kategoriler” ile birebir aynı set
	popular := []Category{
		{Name: "Buzdolapları", Slug: "buzdolaplari", Tech: "HarvestFresh™", CountHint: "48 Model", Icon: "kitchen", SortOrder: 1, Active: true},
		{Name: "Çamaşır Makineleri", Slug: "camasir-makineleri", Tech: "SteamCure™", CountHint: "34 Model", Icon: "local_laundry_service", SortOrder: 2, Active: true},
		{Name: "Bulaşık Makineleri", Slug: "bulasik-makineleri", Tech: "CornerIntense™", CountHint: "26 Model", Icon: "dishwasher_gen", SortOrder: 3, Active: true},
		{Name: "Klimalar", Slug: "klimalar", Tech: "Ekostar A+++", CountHint: "18 Model", Icon: "mode_fan", SortOrder: 4, Active: true},
		{Name: "Ankastre Setler", Slug: "ankastre-setler", Tech: "Fırın & Ocak", CountHint: "22 Paket", Icon: "oven_gen", SortOrder: 5, Active: true},
		{Name: "Küçük Ev & Robot", Slug: "kucuk-ev-robot", Tech: "Lazer Haritalama", CountHint: "52 Model", Icon: "robot_2", SortOrder: 6, Active: true},
	}
	catIDs := map[string]string{}
	keep := make([]string, 0, len(popular))
	for _, c := range popular {
		created, err := s.UpsertCategoryMeta(ctx, c)
		if err != nil {
			return err
		}
		catIDs[c.Slug] = created.ID
		keep = append(keep, c.Slug)
	}
	_ = s.DeactivateCategoriesNotIn(ctx, keep)

	brand, err := s.EnsureBrand(ctx, "Beko")
	if err != nil {
		return err
	}
	demos := []struct {
		sku, name, cat, desc string
	}{
		{"B5RCNE505LXP", "Beko B5RCNE505LXP No Frost Buzdolabı", "buzdolaplari", "HarvestFresh™ · 505L Dark Inox"},
		{"B3T68230W", "Beko B3T68230W Kurutmalı Çamaşır Makinesi", "camasir-makineleri", "SteamCure™ · 9 kg"},
		{"BM3340I", "Beko BM 3340 I Ankastre Bulaşık", "bulasik-makineleri", "CornerIntense™ · 14 kişilik"},
		{"AFK-31260", "Beko 31260 A+++ Inverter Klima", "klimalar", "Ekostar · ücretsiz montaj"},
		{"BBO6852PDX", "Beko BBO6852PDX Ankastre Fırın", "ankastre-setler", "Multifunction · pyrolytic"},
		{"VRT94929", "Beko VRT94929 Robot Süpürge", "kucuk-ev-robot", "Lazer haritalama"},
		{"B50D 890 B", "Beko B50D 890 B 4K Smart TV", "kucuk-ev-robot", "50 inç · Dolby Vision"},
		{"CMG-2540", "Beko Yoğuşmalı Kombi", "klimalar", "24 kW · verimli ısıtma"},
	}
	for _, d := range demos {
		var existing string
		err := s.db.QueryRow(ctx, `SELECT id FROM products WHERE sku=$1`, d.sku).Scan(&existing)
		if err == nil {
			if catID := catIDs[d.cat]; catID != "" {
				_, _ = s.db.Exec(ctx, `UPDATE products SET category_id=$1, updated_at=NOW() WHERE id=$2`, catID, existing)
			}
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		catID := catIDs[d.cat]
		p := Product{
			SKU: d.sku, Name: d.name, Status: "ACTIVE",
			BrandID: &brand.ID, CategoryID: &catID,
			ShortDescription: d.desc, Description: d.desc,
		}
		if _, err := s.CreateProduct(ctx, p); err != nil && !errors.Is(err, ErrConflict) {
			return err
		}
	}
	_ = s.ReassignProductsBySKU(ctx, map[string]string{
		"B5RCNE505LXP": "buzdolaplari",
		"B3T68230W":    "camasir-makineleri",
		"BM3340I":      "bulasik-makineleri",
		"AFK-31260":    "klimalar",
		"BBO6852PDX":   "ankastre-setler",
		"VRT94929":     "kucuk-ev-robot",
		"B50D 890 B":   "kucuk-ev-robot",
		"CMG-2540":     "klimalar",
	})
	_ = s.RemapProductsByNameHints(ctx, catIDs)

	rows, err := s.db.Query(ctx, `SELECT id, sku, name FROM products`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, sku, name string
		if err := rows.Scan(&id, &sku, &name); err != nil {
			return err
		}
		var n int
		_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM product_variants WHERE product_id=$1`, id).Scan(&n)
		if n > 0 {
			continue
		}
		if _, err := s.UpsertVariant(ctx, id, ProductVariant{SKU: sku, Name: name + " · Standart"}); err != nil && !errors.Is(err, ErrConflict) {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteCategory(ctx context.Context, id string) error {
	var n int
	_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE category_id=$1`, id).Scan(&n)
	if n > 0 {
		return ErrConflict
	}
	tag, err := s.db.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) GetBySlug(ctx context.Context, slug string) (*Product, error) {
	var p Product
	err := s.db.QueryRow(ctx, `
SELECT id, sku, name, slug, brand_id, category_id, COALESCE(description,''), COALESCE(short_description,''), status
FROM products WHERE slug=$1
`, slug).Scan(&p.ID, &p.SKU, &p.Name, &p.Slug, &p.BrandID, &p.CategoryID, &p.Description, &p.ShortDescription, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	s.attachImages(ctx, &p)
	s.attachVariants(ctx, &p)
	return &p, nil
}

func (s *Store) GetByID(ctx context.Context, id string) (*Product, error) {
	var p Product
	err := s.db.QueryRow(ctx, `
SELECT id, sku, name, slug, brand_id, category_id, COALESCE(description,''), COALESCE(short_description,''), status
FROM products WHERE id=$1
`, id).Scan(&p.ID, &p.SKU, &p.Name, &p.Slug, &p.BrandID, &p.CategoryID, &p.Description, &p.ShortDescription, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	s.attachImages(ctx, &p)
	s.attachVariants(ctx, &p)
	return &p, nil
}

func (s *Store) UpdateProduct(ctx context.Context, id string, p Product) (*Product, error) {
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.SKU == "" {
		p.SKU = existing.SKU
	}
	if p.Name == "" {
		p.Name = existing.Name
	}
	if p.Slug == "" {
		p.Slug = existing.Slug
	}
	if p.Status == "" {
		p.Status = existing.Status
	}
	if p.Description == "" {
		p.Description = existing.Description
	}
	if p.ShortDescription == "" {
		p.ShortDescription = existing.ShortDescription
	}
	if p.BrandID == nil {
		p.BrandID = existing.BrandID
	}
	if p.CategoryID == nil {
		p.CategoryID = existing.CategoryID
	}
	p.ID = id
	tag, err := s.db.Exec(ctx, `
UPDATE products SET sku=$2, name=$3, slug=$4, brand_id=$5, category_id=$6,
  description=$7, short_description=$8, status=$9, updated_at=NOW()
WHERE id=$1
`, p.ID, p.SKU, p.Name, p.Slug, p.BrandID, p.CategoryID, nullEmpty(p.Description), nullEmpty(p.ShortDescription), p.Status)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrConflict
		}
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return &p, nil
}

func (s *Store) DeleteProduct(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) ListImages(ctx context.Context, productID string) ([]ProductImage, error) {
	rows, err := s.db.Query(ctx, `
SELECT id, product_id, url, COALESCE(alt,''), sort_order
FROM product_images WHERE product_id=$1 ORDER BY sort_order, created_at
`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProductImage{}
	for rows.Next() {
		var img ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.Alt, &img.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

func (s *Store) AddImage(ctx context.Context, productID, imageURL, alt string, sortOrder int) (*ProductImage, error) {
	if _, err := s.GetByID(ctx, productID); err != nil {
		return nil, err
	}
	img := ProductImage{
		ID: uuid.NewString(), ProductID: productID, URL: imageURL, Alt: alt, SortOrder: sortOrder,
	}
	_, err := s.db.Exec(ctx, `
INSERT INTO product_images (id, product_id, url, alt, sort_order) VALUES ($1,$2,$3,$4,$5)
`, img.ID, img.ProductID, img.URL, nullEmpty(img.Alt), img.SortOrder)
	if err != nil {
		return nil, err
	}
	return &img, nil
}

func (s *Store) DeleteImage(ctx context.Context, imageID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM product_images WHERE id=$1`, imageID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) attachImages(ctx context.Context, p *Product) {
	imgs, err := s.ListImages(ctx, p.ID)
	if err == nil {
		p.Images = imgs
	}
}

func (s *Store) attachVariants(ctx context.Context, p *Product) {
	items, err := s.ListVariants(ctx, p.ID)
	if err == nil {
		p.Variants = items
	}
}

func (s *Store) ListVariants(ctx context.Context, productID string) ([]ProductVariant, error) {
	rows, err := s.db.Query(ctx, `
SELECT id, product_id, sku, COALESCE(barcode,''), name, COALESCE(weight_grams,0)
FROM product_variants WHERE product_id=$1 ORDER BY created_at
`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProductVariant{}
	for rows.Next() {
		var v ProductVariant
		if err := rows.Scan(&v.ID, &v.ProductID, &v.SKU, &v.Barcode, &v.Name, &v.WeightGrams); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) UpsertVariant(ctx context.Context, productID string, v ProductVariant) (*ProductVariant, error) {
	var exists string
	err := s.db.QueryRow(ctx, `SELECT id FROM products WHERE id=$1`, productID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if v.SKU == "" || v.Name == "" {
		return nil, errors.New("sku and name required")
	}
	v.ProductID = productID
	if v.ID == "" {
		v.ID = uuid.NewString()
		_, err = s.db.Exec(ctx, `
INSERT INTO product_variants (id, product_id, sku, barcode, name, weight_grams)
VALUES ($1,$2,$3,$4,$5,$6)
`, v.ID, productID, v.SKU, nullEmpty(v.Barcode), v.Name, nullInt(v.WeightGrams))
		if err != nil {
			if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
				return nil, ErrConflict
			}
			return nil, err
		}
		return &v, nil
	}
	tag, err := s.db.Exec(ctx, `
UPDATE product_variants SET sku=$3, barcode=$4, name=$5, weight_grams=$6
WHERE id=$1 AND product_id=$2
`, v.ID, productID, v.SKU, nullEmpty(v.Barcode), v.Name, nullInt(v.WeightGrams))
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return &v, nil
}

func (s *Store) DeleteVariant(ctx context.Context, productID, variantID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM product_variants WHERE id=$1 AND product_id=$2`, variantID, productID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func nullEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullInt(n int) any {
	if n <= 0 {
		return nil
	}
	return n
}
