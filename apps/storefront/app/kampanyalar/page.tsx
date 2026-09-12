import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";

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
        </section>
      </main>
    </StorefrontShell>
  );
}
