import type { Metadata } from "next";
import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";
import { CATEGORY_IMAGES, categoryImage } from "../../lib/category-media";

export const metadata: Metadata = {
  title: "Ürün Grupları",
  description: "Beko resmi yetkili satıcı ADB Ticaret ürün grupları — buzdolabı, çamaşır, bulaşık, klima, ankastre ve daha fazlası.",
  alternates: { canonical: "/kategori" },
};

const FALLBACK = [
  { slug: "buzdolaplari", name: "Buzdolapları", tech: "HarvestFresh™", countHint: "48 Model", icon: "kitchen" },
  { slug: "camasir-makineleri", name: "Çamaşır Makineleri", tech: "SteamCure™", countHint: "34 Model", icon: "local_laundry_service" },
  { slug: "bulasik-makineleri", name: "Bulaşık Makineleri", tech: "CornerIntense™", countHint: "26 Model", icon: "dishwasher_gen" },
  { slug: "klimalar", name: "Klimalar", tech: "Ekostar A+++", countHint: "18 Model", icon: "mode_fan" },
  { slug: "ankastre-setler", name: "Ankastre Setler", tech: "Fırın & Ocak", countHint: "22 Paket", icon: "oven_gen" },
  { slug: "kucuk-ev-robot", name: "Küçük Ev & Robot", tech: "Lazer Haritalama", countHint: "52 Model", icon: "robot_2" },
];

export default async function CategoriesIndexPage() {
  const api = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });

  let cms;
  try {
    cms = await api.cms.home();
  } catch {
    cms = null;
  }

  let groups = FALLBACK;
  try {
    const cats = await api.categories.list();
    if (cats.items?.length) {
      groups = cats.items.map((c) => ({
        slug: c.slug,
        name: c.name,
        tech: c.tech || "",
        countHint: c.countHint || "",
        icon: c.icon || "category",
      }));
    }
  } catch {
    /* fallback */
  }

  const phone = cms?.store.phone || "0850 300 23 56";

  return (
    <StorefrontShell
      announcement={cms?.announcement}
      footer={{
        phone,
        whatsapp: cms?.store.whatsapp || phone,
        address: cms?.store.address,
        dealerCode: cms?.store.dealerCode || "340982",
      }}
    >
      <main>
        <section className="adb-page-hero" style={{ minHeight: "min(36vh, 320px)" }}>
          <div
            className="adb-page-hero-media"
            style={{ backgroundImage: `url(${CATEGORY_IMAGES["ankastre-setler"]})` }}
            aria-hidden
          />
          <div className="adb-container adb-page-hero-content">
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
              <Link href="/" style={{ color: "inherit" }}>
                Ana Sayfa
              </Link>{" "}
              / Ürün Grupları
            </p>
            <div className="adb-label-sm" style={{ color: "#7dd3fc" }}>
              Resmi Beko kataloğu
            </div>
            <h1
              style={{
                margin: "6px 0 10px",
                fontFamily: "var(--adb-font-display)",
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.03em",
              }}
            >
              Ürün grupları
            </h1>
            <p style={{ margin: 0, maxWidth: 520, color: "rgba(255,255,255,0.88)", lineHeight: 1.55 }}>
              Yaşam alanınıza göre keşfedin — orijinal stok, ücretsiz montaj ve resmi garanti.
            </p>
          </div>
        </section>

        <div className="adb-container" style={{ padding: "36px 24px 72px" }}>
          <div className="adb-stagger" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {groups.map((g) => (
              <Link key={g.slug} href={`/kategori/${g.slug}`} className="adb-beko-cat" style={{ minHeight: 260 }}>
                <div className="adb-beko-cat-media" style={{ backgroundImage: `url(${categoryImage(g.slug)})` }} />
                <div className="adb-beko-cat-body" style={{ minHeight: 260 }}>
                  <div style={{ fontFamily: "var(--adb-font-display)", fontWeight: 700, fontSize: 22 }}>{g.name}</div>
                  {g.tech ? <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>{g.tech}</div> : null}
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {g.countHint || "İncele"} →
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 36, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
              Tüm ürünlerde ara
            </Link>
            <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
              Kampanyalar
            </Link>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}
