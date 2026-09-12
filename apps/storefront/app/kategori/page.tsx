import type { Metadata } from "next";
import Link from "next/link";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";

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
      <main className="adb-container" style={{ padding: "32px 24px 64px" }}>
        <p style={{ fontSize: 13, color: "var(--adb-muted)", marginBottom: 12 }}>
          <Link href="/">Ana Sayfa</Link> / <span style={{ color: "var(--adb-on-surface)", fontWeight: 600 }}>Ürün Grupları</span>
        </p>
        <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
          Resmi Beko Kataloğu
        </div>
        <h1 className="adb-headline-lg" style={{ margin: "4px 0 8px" }}>
          Tüm ürün grupları
        </h1>
        <p style={{ color: "var(--adb-muted)", maxWidth: 560, marginBottom: 28 }}>
          Ana sayfadaki popüler kategorilerle aynı gruplar — orijinal stok, ücretsiz montaj ve resmi garanti.
        </p>

        <div
          className="adb-stagger"
          style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {groups.map((g) => (
            <Link
              key={g.slug}
              href={`/kategori/${g.slug}`}
              className="adb-card"
              style={{ padding: 20, textDecoration: "none", color: "inherit", display: "grid", gap: 10 }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "var(--adb-surface-low)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--adb-primary)" }}>
                  {g.icon}
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{g.name}</div>
              {g.tech ? (
                <div style={{ fontSize: 13, color: "var(--adb-primary-container)", fontWeight: 600 }}>{g.tech}</div>
              ) : null}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adb-muted)" }}>
                {g.countHint || "İncele"} →
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
            Tüm ürünlerde ara
          </Link>
          <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
            Kampanyalar
          </Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
