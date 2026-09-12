import type { Metadata } from "next";
import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { ProductCard } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";

const categoryMeta: Record<
  string,
  { title: string; blurb: string; accent: string }
> = {
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
  // Eski slug yönlendirmeleri için meta (redirect next.config'te)
  "beyaz-esya": {
    title: "Beyaz Eşya",
    blurb: "Buzdolabı, çamaşır ve bulaşık makineleri.",
    accent: "Beyaz eşya",
  },
};

type PageProps = { params: Promise<{ slug: string }> };

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
  }> = [];
  let loadError = false;

  try {
    const res = await api.search.query({ category: slug });
    items = res.items;
  } catch {
    try {
      const res = await api.products.list({ category: slug });
      items = res.items;
    } catch {
      loadError = true;
    }
  }

  return (
    <StorefrontShell>
      <main>
        <section
          style={{
            background:
              "linear-gradient(135deg, rgba(0,63,135,0.12), rgba(0,63,135,0.02) 55%), var(--adb-surface)",
            borderBottom: "1px solid var(--adb-border-subtle)",
          }}
        >
          <div className="adb-container" style={{ padding: "40px 24px 36px" }}>
            <p className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 8 }}>
              {meta.accent}
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>{meta.title}</h1>
            <p style={{ color: "var(--adb-muted)", maxWidth: 560, marginTop: 10, lineHeight: 1.55 }}>
              {meta.blurb}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <Link href={`/arama?category=${encodeURIComponent(slug)}`} className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
                Bu kategoride ara
              </Link>
              <Link href="/takas" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                Takas teklifi al
              </Link>
            </div>
          </div>
        </section>

        <div className="adb-container" style={{ padding: "28px 24px 64px" }}>
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
              <p style={{ color: "var(--adb-muted)", marginBottom: 18 }}>{items.length} ürün</p>
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
                    features={p.shortDescription ? [p.shortDescription] : undefined}
                    promoLabel="Bayi stoku"
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

function EmptyState({
  title,
  body,
  slug,
}: {
  title: string;
  body: string;
  slug?: string;
}) {
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
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)", opacity: 0.65 }}>
        inventory_2
      </span>
      <h2 style={{ marginTop: 12, marginBottom: 8 }}>{title}</h2>
      <p style={{ color: "var(--adb-muted)", maxWidth: 480, margin: "0 auto 22px", lineHeight: 1.55 }}>{body}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
          Ürün ara
        </Link>
        <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
          Kampanyalar
        </Link>
        <Link href="/" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
          Ana sayfa
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
