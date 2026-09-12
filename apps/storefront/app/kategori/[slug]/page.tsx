import type { Metadata } from "next";
import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { ProductCard } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";
import { categoryImage } from "../../../lib/category-media";

const categoryMeta: Record<string, { title: string; blurb: string; accent: string }> = {
  buzdolaplari: {
    title: "Buzdolapları",
    blurb: "HarvestFresh™ teknolojili No Frost buzdolapları — orijinal Beko seçkisi.",
    accent: "HarvestFresh™ · No Frost",
  },
  "camasir-makineleri": {
    title: "Çamaşır Makineleri",
    blurb: "SteamCure™ buharlı çamaşır makineleri — ücretsiz yetkili servis montajı.",
    accent: "SteamCure™ · Kurutmalı",
  },
  "bulasik-makineleri": {
    title: "Bulaşık Makineleri",
    blurb: "CornerIntense™ ankastre ve serbest duran bulaşık makineleri.",
    accent: "CornerIntense™ · Sessiz",
  },
  klimalar: {
    title: "Klimalar",
    blurb: "Ekostar A+++ inverter klimalar ve ısıtma çözümleri — montaj dahil.",
    accent: "Ekostar · Inverter",
  },
  "ankastre-setler": {
    title: "Ankastre Setler",
    blurb: "Fırın, ocak ve davlumbaz setleri — mutfak planınıza uygun paketler.",
    accent: "Fırın · Ocak · Davlumbaz",
  },
  "kucuk-ev-robot": {
    title: "Küçük Ev & Robot",
    blurb: "Robot süpürge ve günlük yaşamı kolaylaştıran Beko ürünleri.",
    accent: "Robot · Lazer haritalama",
  },
  "beyaz-esya": {
    title: "Beyaz Eşya",
    blurb: "Buzdolabı, çamaşır ve bulaşık makineleri.",
    accent: "Beyaz eşya",
  },
};

type PageProps = { params: Promise<{ slug: string }> };

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = categoryMeta[slug];
  const title = meta?.title ?? slug.replace(/-/g, " ");
  const description = meta?.blurb ?? `${title} kategorisindeki Beko ürünleri — ADB Ticaret yetkili satıcı.`;
  return {
    title,
    description,
    alternates: { canonical: `/kategori/${slug}` },
    openGraph: {
      title: `${title} | ADB Ticaret Beko`,
      description,
      url: `/kategori/${slug}`,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = categoryMeta[slug] ?? {
    title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    blurb: "Bu kategorideki Beko ürünlerini inceleyin.",
    accent: "Kategori vitrini",
  };

  const api = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });

  let items: Array<{
    id: string;
    sku: string;
    name: string;
    slug: string;
    shortDescription?: string;
    images?: Array<{ url: string }>;
  }> = [];
  let loadError = false;

  try {
    const res = await api.search.query({ category: slug });
    items = res.items as typeof items;
  } catch {
    try {
      const res = await api.products.list({ category: slug });
      items = res.items;
    } catch {
      loadError = true;
    }
  }

  // Enrich missing images from product detail list when search returns thin payloads
  if (items.length > 0 && items.some((p) => !p.images?.[0]?.url)) {
    try {
      const all = await api.products.list({ category: slug });
      const byId = Object.fromEntries(all.items.map((p) => [p.id, p]));
      items = items.map((p) => ({
        ...p,
        images: p.images?.length ? p.images : byId[p.id]?.images,
        shortDescription: p.shortDescription || byId[p.id]?.shortDescription,
      }));
    } catch {
      /* ignore */
    }
  }

  const prices = await Promise.all(
    items.slice(0, 24).map(async (p) => {
      try {
        const price = await api.pricing.get(p.id);
        return { id: p.id, label: formatTRY(price.amount), list: formatTRY(Math.round(price.amount * 1.12)) };
      } catch {
        return { id: p.id, label: undefined as string | undefined, list: undefined as string | undefined };
      }
    }),
  );
  const priceMap = Object.fromEntries(prices.map((p) => [p.id, p]));

  const heroImg = categoryImage(slug);

  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(38vh, 340px)" }}>
          <div className="adb-page-hero-media" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden />
          <div className="adb-container adb-page-hero-content">
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
              <Link href="/" style={{ color: "inherit" }}>
                Ana Sayfa
              </Link>{" "}
              /{" "}
              <Link href="/kategori" style={{ color: "inherit" }}>
                Ürün Grupları
              </Link>{" "}
              / {meta.title}
            </p>
            <p className="adb-label-sm" style={{ color: "#7dd3fc", marginBottom: 8 }}>
              {meta.accent}
            </p>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--adb-font-display)",
                fontSize: "clamp(1.7rem, 3.5vw, 2.6rem)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.03em",
              }}
            >
              {meta.title}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.88)", maxWidth: 560, marginTop: 12, lineHeight: 1.55 }}>{meta.blurb}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              <Link href={`/arama?category=${encodeURIComponent(slug)}`} className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
                Bu kategoride ara
              </Link>
              <Link
                href="/takas"
                className="adb-btn"
                style={{ textDecoration: "none", background: "transparent", border: "1px solid rgba(255,255,255,0.45)", color: "#fff" }}
              >
                Takas teklifi al
              </Link>
            </div>
          </div>
        </section>

        <div className="adb-container" style={{ padding: "32px 24px 72px" }}>
          {loadError ? (
            <EmptyState
              title="Katalog şu an yanıt vermiyor"
              body="Gateway veya catalog servisini kontrol edin. Kısa süre sonra tekrar deneyin."
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="Bu kategoride henüz ürün yok"
              body="Demo ürünler catalog servisi yeniden başlatıldığında otomatik eklenir. Diğer kategorilere göz atabilir veya arama yapabilirsiniz."
              slug={slug}
            />
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "end" }}>
                <div>
                  <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                    Vitrin
                  </div>
                  <h2 className="adb-headline-md" style={{ margin: "4px 0 0", fontFamily: "var(--adb-font-display)" }}>
                    {items.length} ürün
                  </h2>
                </div>
                <Link href="/kategori" style={{ color: "var(--adb-primary)", fontWeight: 700, fontSize: 14 }}>
                  Tüm gruplar →
                </Link>
              </div>
              <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    href={`/urun/${p.slug}`}
                    sku={p.sku}
                    title={p.name}
                    imageUrl={p.images?.[0]?.url || heroImg}
                    priceLabel={priceMap[p.id]?.label}
                    listPriceLabel={priceMap[p.id]?.list}
                    features={p.shortDescription ? [p.shortDescription, "Ücretsiz montaj"] : ["Ücretsiz montaj", "Orijinal Beko"]}
                    promoLabel="Stokta"
                    action={
                      <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%", textDecoration: "none" }}>
                        İncele
                      </Link>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </StorefrontShell>
  );
}

function EmptyState({ title, body, slug }: { title: string; body: string; slug?: string }) {
  return (
    <div style={{ padding: "56px 24px", textAlign: "center", background: "#fff", borderRadius: 8, border: "1px solid var(--adb-border-subtle)" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)", opacity: 0.65 }}>
        inventory_2
      </span>
      <h2 style={{ marginTop: 12, marginBottom: 8, fontFamily: "var(--adb-font-display)" }}>{title}</h2>
      <p style={{ color: "var(--adb-muted)", maxWidth: 480, margin: "0 auto 22px", lineHeight: 1.55 }}>{body}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
          Ürün ara
        </Link>
        <Link href="/kategori" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
          Kategoriler
        </Link>
        {slug ? (
          <Link href={`/arama?category=${encodeURIComponent(slug)}`} className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
            Filtreyi yenile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
