import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";
import { DealCountdown } from "../../components/deal-countdown";

export const metadata: Metadata = {
  title: "Kampanyalar",
  description: "Beko takas, çeyiz ve taksit kampanyaları — ADB Ticaret yetkili satıcı.",
  alternates: { canonical: "/kampanyalar" },
  openGraph: {
    title: "Kampanyalar | ADB Ticaret Beko",
    description: "Takas desteği, çeyiz paketleri ve peşin fiyatına taksit fırsatları.",
    url: "/kampanyalar",
  },
};

const HERO =
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80";

const FALLBACK = [
  {
    id: "takas",
    href: "/takas",
    subtitle: "Takas 2026",
    title: "15.000 TL’ye varan değişim desteği",
    body: "Eski beyaz eşyanızı getirin, yeni Beko’da peşin indirim kazanın.",
    ctaLabel: "Takas teklifi al",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "ceyiz",
    href: "/ceyiz",
    subtitle: "Çeyiz paketleri",
    title: "Hazır setler + ücretsiz depolama",
    body: "Başlangıç ve premium paketler. Düğün tarihine kadar ürünlerinizi saklayın.",
    ctaLabel: "Paketleri incele",
    imageUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
  },
];

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default async function KampanyalarPage() {
  const api = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });
  let campaigns = FALLBACK.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    body: c.body,
    imageUrl: c.imageUrl,
    ctaLabel: c.ctaLabel,
    ctaHref: c.href,
  }));
  try {
    const res = await api.promotions.listCampaigns(true);
    if (res.items?.length) {
      campaigns = res.items.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle || "Kampanya",
        body: c.body,
        imageUrl: c.imageUrl || FALLBACK[0]!.imageUrl,
        ctaLabel: c.ctaLabel || "İncele",
        ctaHref: c.ctaHref || "/kampanyalar",
      }));
    }
  } catch {
    /* fallback */
  }

  let products: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    images?: Array<{ url: string }>;
    priceLabel?: string;
  }> = [];
  try {
    const list = await api.products.list();
    products = await Promise.all(
      list.items.slice(0, 4).map(async (p) => {
        let priceLabel: string | undefined;
        try {
          priceLabel = formatTRY((await api.pricing.get(p.id)).amount);
        } catch {
          priceLabel = undefined;
        }
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          images: p.images,
          priceLabel,
        };
      }),
    );
  } catch {
    products = [];
  }

  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero">
          <div className="adb-page-hero-media" style={{ backgroundImage: `url(${HERO})` }} />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#93c5fd" }}>
              Resmi bayi kampanyaları
            </p>
            <h1 className="adb-display" style={{ color: "#fff", margin: "8px 0 12px" }}>
              Takas, çeyiz ve sezon fırsatları
            </h1>
            <p style={{ color: "rgba(255,255,255,.85)", maxWidth: 540, margin: 0, lineHeight: 1.55 }}>
              ADB Ticaret Beko yetkili satıcısı olarak dönemsel kampanyaları mağaza stoklarıyla senkron yönetiyoruz.
            </p>
          </div>
        </section>

        <section className="adb-section">
          <div className="adb-container" style={{ marginBottom: 20 }}>
            <div
              className="adb-card"
              style={{
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "center",
                background: "linear-gradient(135deg, rgba(0,86,179,0.08), transparent)",
              }}
            >
              <div>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Bu haftanın fırsatı bitiyor
                </div>
                <strong style={{ fontSize: 16 }}>Takas + peşin fiyatına 9 taksit</strong>
              </div>
              <DealCountdown />
            </div>
          </div>

          <div className="adb-container adb-stagger" style={{ display: "grid", gap: 20 }}>
            {campaigns.map((c, i) => (
              <article
                key={c.id}
                className="adb-card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)",
                  overflow: "hidden",
                  padding: 0,
                  minHeight: 240,
                }}
              >
                <div style={{ padding: 28, order: i % 2 === 1 ? 2 : 1 }}>
                  <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                    {c.subtitle}
                  </div>
                  <h2 className="adb-headline-sm" style={{ margin: "8px 0 10px" }}>
                    {c.title}
                  </h2>
                  <p style={{ margin: 0, color: "var(--adb-muted)", lineHeight: 1.55 }}>{c.body}</p>
                  <Link
                    href={c.ctaHref}
                    className="adb-btn adb-btn-primary"
                    style={{ marginTop: 18, textDecoration: "none", display: "inline-flex" }}
                  >
                    {c.ctaLabel}
                  </Link>
                </div>
                <div
                  style={{
                    order: i % 2 === 1 ? 1 : 2,
                    minHeight: 220,
                    backgroundImage: `url(${c.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </article>
            ))}
          </div>

          {products.length > 0 ? (
            <div className="adb-container" style={{ marginTop: 36 }}>
              <h2 className="adb-headline-md" style={{ marginBottom: 14 }}>
                Kampanyalı ürünleri gör
              </h2>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    href={`/urun/${p.slug}`}
                    sku={p.sku}
                    title={p.name}
                    imageUrl={p.images?.[0]?.url}
                    priceLabel={p.priceLabel}
                    promoLabel="Kampanya"
                    features={["Ücretsiz montaj", "Yetkili satıcı"]}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="adb-container" style={{ marginTop: 48 }}>
            <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
              Kampanya rehberi
            </div>
            <h2 className="adb-headline-md" style={{ margin: "6px 0 16px", fontFamily: "var(--adb-font-display)" }}>
              Nasıl faydalanırım?
            </h2>
            <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              {[
                ["1 · Seçin", "Takas, çeyiz veya sezon ürününü belirleyin."],
                ["2 · Teklif / sepet", "Online ön teklif alın veya ürünü sepete ekleyin."],
                ["3 · Onay", "Ödeme sonrası stok rezervasyonu ve montaj planı SMS ile gelir."],
                ["4 · Kurulum", "Yetkili servis ücretsiz montajı tamamlar."],
              ].map(([t, b]) => (
                <div key={t} style={{ padding: 18, background: "#fff", borderLeft: "3px solid var(--adb-primary)" }}>
                  <strong style={{ fontFamily: "var(--adb-font-display)" }}>{t}</strong>
                  <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--adb-muted)", lineHeight: 1.5 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
