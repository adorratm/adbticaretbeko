package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/adbticaret/adbticaretbeko/shared/config"
	"github.com/adbticaret/adbticaretbeko/shared/httpx"
	"github.com/adbticaret/adbticaretbeko/shared/logging"
)

type product struct {
	ID               string  `json:"id"`
	SKU              string  `json:"sku"`
	Name             string  `json:"name"`
	Slug             string  `json:"slug"`
	CategoryID       *string `json:"categoryId"`
	ShortDescription string  `json:"shortDescription"`
	Description      string  `json:"description"`
	Status           string  `json:"status"`
}

type categoryItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func main() {
	log := logging.New("search")
	addr := config.Getenv("HTTP_ADDR", ":8093")
	catalogURL := strings.TrimRight(config.Getenv("CATALOG_URL", "http://localhost:8083"), "/")
	esURL := strings.TrimRight(config.Getenv("ELASTICSEARCH_URL", ""), "/")

	client := &http.Client{Timeout: 8 * time.Second}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpx.Healthz())
	mux.HandleFunc("GET /readyz", httpx.Healthz())

	mux.HandleFunc("GET /v1/search", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		category := strings.TrimSpace(r.URL.Query().Get("category"))

		var items []map[string]any
		backend := "catalog"

		if esURL != "" {
			esItems, err := searchElastic(client, esURL, q, category)
			if err == nil {
				items = esItems
				backend = "elasticsearch"
			} else {
				log.Error("es_fallback", map[string]any{"error": err.Error()})
			}
		}

		if items == nil {
			catalogItems, cats, err := searchCatalog(client, catalogURL, q, category)
			if err != nil {
				httpx.WriteError(w, 502, "catalog_unreachable", "katalog araması başarısız: "+err.Error(), rid)
				return
			}
			items = catalogItems
			httpx.WriteJSON(w, 200, map[string]any{
				"items": items, "total": len(items), "q": q, "category": category,
				"backend": backend, "categories": cats,
			})
			return
		}

		httpx.WriteJSON(w, 200, map[string]any{
			"items": items, "total": len(items), "q": q, "category": category, "backend": backend,
		})
	})

	mux.HandleFunc("POST /v1/search/reindex", func(w http.ResponseWriter, r *http.Request) {
		rid := httpx.RequestIDFromContext(r.Context())
		if esURL == "" {
			httpx.WriteJSON(w, 200, map[string]any{"ok": true, "message": "Elasticsearch yok; catalog backend kullanılıyor"})
			return
		}
		products, _, err := searchCatalog(client, catalogURL, "", "")
		if err != nil {
			httpx.WriteError(w, 502, "catalog_unreachable", err.Error(), rid)
			return
		}
		n, err := reindexElastic(client, esURL, products)
		if err != nil {
			httpx.WriteError(w, 502, "es_reindex_failed", err.Error(), rid)
			return
		}
		httpx.WriteJSON(w, 200, map[string]any{"ok": true, "indexed": n})
	})

	_ = httpx.ListenAndServe(addr, httpx.CORS(httpx.WithRequestID(httpx.WithLogging(log, mux))), log)
}

func searchCatalog(client *http.Client, catalogURL, q, category string) ([]map[string]any, []categoryItem, error) {
	u, _ := url.Parse(catalogURL + "/v1/products")
	qs := u.Query()
	if q != "" {
		qs.Set("q", q)
	}
	if category != "" {
		qs.Set("category", category)
	}
	u.RawQuery = qs.Encode()

	resp, err := client.Get(u.String())
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, nil, fmt.Errorf("catalog status %d: %s", resp.StatusCode, string(b))
	}
	var body struct {
		Items []product `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, nil, err
	}

	cres, err := client.Get(catalogURL + "/v1/categories")
	var cats []categoryItem
	if err == nil {
		defer cres.Body.Close()
		var cbody struct {
			Items []categoryItem `json:"items"`
		}
		_ = json.NewDecoder(cres.Body).Decode(&cbody)
		cats = cbody.Items
	}
	if cats == nil {
		cats = []categoryItem{}
	}

	catName := map[string]string{}
	for _, c := range cats {
		catName[c.ID] = c.Name
	}

	out := make([]map[string]any, 0, len(body.Items))
	for _, p := range body.Items {
		row := map[string]any{
			"id": p.ID, "sku": p.SKU, "name": p.Name, "slug": p.Slug,
			"shortDescription": p.ShortDescription, "status": p.Status,
			"href": "/urun/" + p.Slug,
		}
		if p.CategoryID != nil {
			row["categoryId"] = *p.CategoryID
			row["categoryName"] = catName[*p.CategoryID]
		}
		out = append(out, row)
	}
	return out, cats, nil
}

func searchElastic(client *http.Client, esURL, q, category string) ([]map[string]any, error) {
	must := []map[string]any{}
	if q != "" {
		must = append(must, map[string]any{
			"multi_match": map[string]any{
				"query":  q,
				"fields": []string{"name^3", "sku^2", "shortDescription", "description"},
			},
		})
	} else {
		must = append(must, map[string]any{"match_all": map[string]any{}})
	}
	if category != "" {
		must = append(must, map[string]any{"term": map[string]any{"categorySlug.keyword": category}})
	}
	payload := map[string]any{
		"size": 50,
		"query": map[string]any{
			"bool": map[string]any{"must": must},
		},
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, esURL+"/adb_products/_search", strings.NewReader(string(raw)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("es %d: %s", resp.StatusCode, string(b))
	}
	var parsed struct {
		Hits struct {
			Hits []struct {
				Source map[string]any `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for _, h := range parsed.Hits.Hits {
		out = append(out, h.Source)
	}
	return out, nil
}

func reindexElastic(client *http.Client, esURL string, products []map[string]any) (int, error) {
	req, _ := http.NewRequest(http.MethodPut, esURL+"/adb_products", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
	n := 0
	for _, p := range products {
		id, _ := p["id"].(string)
		if id == "" {
			continue
		}
		raw, _ := json.Marshal(p)
		ireq, _ := http.NewRequest(http.MethodPut, esURL+"/adb_products/_doc/"+id, strings.NewReader(string(raw)))
		ireq.Header.Set("Content-Type", "application/json")
		iresp, err := client.Do(ireq)
		if err != nil {
			return n, err
		}
		iresp.Body.Close()
		n++
	}
	return n, nil
}
