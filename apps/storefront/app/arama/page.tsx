import type { Metadata } from "next";
import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { ProductCard } from "@adb/ui";
import { StorefrontShell } from "../../components/site-shell";
import { SearchFilters } from "../../components/search-filters";

const categoryLabels: Record<string, string> = {
  buzdolaplari: "Buzdolapları",
  "camasir-makineleri": "Çamaşır Makineleri",
  "bulasik-makineleri": "Bulaşık Makineleri",
  klimalar: "Klimalar",
  "ankastre-setler": "Ankastre Setler",
  "kucuk-ev-robot": "Küçük Ev & Robot",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const title = q ? `Arama: ${q}` : "Ürün Arama";
  return {
    title,
    description: q
      ? `"${q}" için Beko ürün arama sonuçları — ADB Ticaret yetkili satıcı.`
      : "Beko ürünlerini ad, model veya kategoriye göre arayın.",
    robots: { index: !!q, follow: true },
    alternates: { canonical: q ? `/arama?q=${encodeURIComponent(q)}` : "/arama" },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const category = (sp.category || "").trim();
  const api = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });

  let items: Array<{
    id: string;
    sku: string;
    name: string;
    slug: string;
    shortDescription?: string;
    categoryName?: string;
  }> = [];
  let backend = "catalog";
  let error = "";

  try {
    const res = await api.search.query({ q, category });
    items = res.items;
    backend = res.backend;
  } catch {
    try {
      const fallback = await api.products.list({ q, category });
      items = fallback.items.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
      }));
    } catch (e) {
      error = e instanceof Error ? e.message : "Arama şu an kullanılamıyor";
    }
  }

  const title =
    q || category
      ? `"${q || categoryLabels[category] || category}" için sonuçlar`
      : "Ürün ara";

  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "32px 24px 64px" }}>
        <div style={{ marginBottom: 24 }}>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 6 }}>
            Arama
          </p>
          <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
          <p style={{ color: "var(--adb-muted)", marginTop: 8 }}>
            {error
              ? error
              : `${items.length} ürün bulundu${backend === "elasticsearch" ? " · Elasticsearch" : ""}`}
          </p>
        </div>

        <SearchFilters q={q} category={category} />

        {items.length === 0 && !error ? (
          <EmptySearch q={q} category={category} />
        ) : (
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {items.map((p) => (
              <ProductCard
                key={p.id}
                href={`/urun/${p.slug}`}
                sku={p.sku}
                title={p.name}
                features={p.shortDescription ? [p.shortDescription] : p.categoryName ? [p.categoryName] : undefined}
                promoLabel="Stokta"
              />
            ))}
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}

function EmptySearch({ q, category }: { q: string; category: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        background:
          "linear-gradient(160deg, rgba(0,63,135,0.06), transparent 60%), var(--adb-surface-low)",
        borderRadius: 16,
        border: "1px solid var(--adb-border-subtle)",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)", opacity: 0.7 }}>
        search_off
      </span>
      <h2 style={{ marginTop: 12, marginBottom: 8 }}>Sonuç bulunamadı</h2>
      <p style={{ color: "var(--adb-muted)", maxWidth: 420, margin: "0 auto 20px" }}>
        {q || category
          ? "Farklı bir anahtar kelime veya kategori deneyin. Demo katalogda Beko ürünleri yer alır."
          : "Arama kutusuna model kodu veya ürün adı yazın."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/kategori" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
          Ürün grupları
        </Link>
        <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
          Kampanyalar
        </Link>
        <Link href="/" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
