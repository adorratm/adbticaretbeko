import Link from "next/link";
import { ProductCard } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../components/site-shell";
import { DealCountdown } from "../components/deal-countdown";
import { LeadForm } from "../components/lead-form";

const HERO_IMG =
  "https://images.unsplash.com/photo-1556912173-46c336c7fd55?auto=format&fit=crop&w=1400&q=80";

const FALLBACK_CATEGORIES = [
  { href: "/kategori/buzdolaplari", title: "Buzdolapları", tech: "HarvestFresh™", count: "48 Model", icon: "kitchen" },
  { href: "/kategori/camasir-makineleri", title: "Çamaşır Makineleri", tech: "SteamCure™", count: "34 Model", icon: "local_laundry_service" },
  { href: "/kategori/bulasik-makineleri", title: "Bulaşık Makineleri", tech: "CornerIntense™", count: "26 Model", icon: "dishwasher_gen" },
  { href: "/kategori/klimalar", title: "Klimalar", tech: "Ekostar A+++", count: "18 Model", icon: "mode_fan" },
  { href: "/kategori/ankastre-setler", title: "Ankastre Setler", tech: "Fırın & Ocak", count: "22 Paket", icon: "oven_gen" },
  { href: "/kategori/kucuk-ev-robot", title: "Küçük Ev & Robot", tech: "Lazer Haritalama", count: "52 Model", icon: "robot_2" },
];

const DEMO_PRODUCTS = [
  {
    id: "demo-1",
    slug: "beko-b5rcne505lxp",
    sku: "B5RCNE505LXP",
    name: "Beko B5RCNE505LXP No Frost Buzdolabı",
    price: "34.499 TL",
    list: "38.999 TL",
    features: ["HarvestFresh™ 3 Işıklı Teknoloji", "505 Litre Geniş Hacim", "Dark Inox Leke Tutmaz"],
  },
  {
    id: "demo-2",
    slug: "beko-b3t68230w",
    sku: "B3T68230W",
    name: "Beko B3T68230W Kurutmalı Çamaşır Makinesi",
    price: "27.990 TL",
    list: "31.490 TL",
    features: ["SteamCure™ Buhar", "9 kg Yıkama", "A Enerji Sınıfı"],
  },
  {
    id: "demo-3",
    slug: "beko-bm3340i",
    sku: "BM 3340 I",
    name: "Beko BM 3340 I Ankastre Bulaşık Makinesi",
    price: "18.750 TL",
    list: "21.200 TL",
    features: ["CornerIntense™", "14 Kişilik", "Sessiz Motor"],
  },
  {
    id: "demo-4",
    slug: "beko-31260",
    sku: "31260",
    name: "Beko 31260 A+++ Inverter Klima",
    price: "22.499 TL",
    list: "25.999 TL",
    features: ["Ekostar Inverter", "Hızlı Soğutma", "Ücretsiz Montaj"],
  },
];

const TRUST = [
  { icon: "verified_user", title: "Yetkili Satıcı Güvencesi", body: "%100 orijinal ambalajında Beko Türkiye faturalı ve barkodlu ürünler." },
  { icon: "handyman", title: "Ücretsiz Servis Montajı", body: "Türkiye genelinde yetkili servis ekiplerince ücretsiz profesyonel kurulum." },
  { icon: "credit_card", title: "Vade Farksız 9 Taksit", body: "Anlaşmalı banka kartlarına peşin fiyatına sıfır faiz avantajı." },
  { icon: "security", title: "Resmi 3+4 Yıl Garanti", body: "Arçelik & Beko A.Ş. güvencesiyle opsiyonel uzatılmış fabrika garantisi." },
];

const STATS = [
  { value: "20+", label: "Yıllık bayi tecrübesi" },
  { value: "85.000+", label: "Kurulu ürün" },
  { value: "4.9/5", label: "Müşteri puanı" },
  { value: "%100", label: "Orijinal ürün" },
];

function api() {
  return createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });
}

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default async function HomePage() {
  const client = api();
  let cms;
  let products: Array<{ id: string; name: string; slug: string; sku: string }> = [];
  let categories = FALLBACK_CATEGORIES;
  try {
    cms = await client.cms.home();
  } catch {
    cms = null;
  }
  try {
    products = (await client.products.list()).items;
  } catch {
    products = [];
  }
  try {
    const cats = await client.categories.list();
    if (cats.items?.length) {
      categories = cats.items.map((c) => ({
        href: `/kategori/${c.slug}`,
        title: c.name,
        tech: c.tech || "",
        count: c.countHint || "",
        icon: c.icon || "category",
      }));
    }
  } catch {
    /* fallback */
  }

  const prices = await Promise.all(
    products.slice(0, 8).map(async (p) => {
      try {
        const price = await client.pricing.get(p.id);
        return { id: p.id, label: formatTRY(price.amount), list: formatTRY(Math.round(price.amount * 1.12)) };
      } catch {
        return { id: p.id, label: undefined, list: undefined };
      }
    }),
  );
  const priceMap = Object.fromEntries(prices.map((p) => [p.id, p]));

  const phone = cms?.store.phone || "0850 300 23 56";
  const dealerCode = cms?.store.dealerCode || "340982";
  const heroTitle = cms?.hero?.title || "Eski Beyaz Eşyanızı Alıyoruz, 15.000 TL'ye Varan İndirimle Değiştiriyoruz!";
  const heroSub =
    cms?.hero?.subtitle ||
    "ADB Ticaret güvencesiyle Beko teknolojisine en avantajlı takas desteğiyle geçin. Orijinal fabrika ambalajında, resmi garanti ve ücretsiz yetkili servis kurulumu.";

  return (
    <StorefrontShell
      announcement={cms?.announcement}
      footer={{
        phone,
        whatsapp: cms?.store.whatsapp || phone,
        address: cms?.store.address || "Beşiktaş · Kadıköy · Bursa",
        dealerCode,
      }}
    >
      <main>
        <section
          style={{
            background: "linear-gradient(180deg, var(--adb-surface) 0%, var(--adb-surface-low) 100%)",
            padding: "28px 0 40px",
          }}
        >
          <div className="adb-container" style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "center" }}>
            <div className="adb-animate-in">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#fff",
                  padding: "8px 14px",
                  borderRadius: 999,
                  boxShadow: "var(--adb-shadow-sm)",
                  marginBottom: 14,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981" }} />
                <span className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Beko Değişim & Yenileme Kampanyası
                </span>
                <span style={{ fontSize: 11, color: "var(--adb-secondary)" }}>| 2026 Resmi Sezon</span>
              </div>
              <div className="adb-label-sm" style={{ color: "var(--adb-secondary)", marginBottom: 8 }}>
                Beko Yeni Nesil ProSmart™ Inverter Serisi
              </div>
              <h1 className="adb-display" style={{ margin: "0 0 14px" }}>
                {heroTitle.includes("15.000") ? (
                  <>
                    Eski Beyaz Eşyanızı Alıyoruz,{" "}
                    <span style={{ color: "var(--adb-tertiary)" }}>15.000 TL&apos;ye Varan</span> İndirimle Değiştiriyoruz!
                  </>
                ) : (
                  heroTitle
                )}
              </h1>
              <p style={{ color: "var(--adb-muted)", fontSize: 16, lineHeight: 1.6, maxWidth: 540, margin: 0 }}>{heroSub}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
                <Link href={cms?.hero?.ctaHref || "/takas"} className="adb-btn adb-btn-primary" style={{ height: 48, padding: "0 22px" }}>
                  <span className="material-symbols-outlined">local_offer</span>
                  {cms?.hero?.ctaLabel || "Kampanyayı İncele"}
                </Link>
                <a
                  href={`https://wa.me/${(cms?.store.whatsapp || phone).replace(/\D/g, "")}`}
                  className="adb-btn adb-btn-tertiary"
                  style={{ height: 48 }}
                >
                  <span className="material-symbols-outlined" style={{ color: "#059669" }}>
                    chat
                  </span>
                  WhatsApp&apos;tan Bilgi Al
                </a>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 16,
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(194,198,212,0.45)",
                }}
              >
                {[
                  ["15.000 TL", "Maksimum Takas"],
                  ["Peşin Fiyatına", "9 Taksit"],
                  ["7 Yıl", "3+4 Garanti"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <div className="adb-headline-sm" style={{ margin: 0 }}>
                      {v}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="adb-animate-in adb-hero-visual" style={{ position: "relative" }}>
              <div className="adb-card" style={{ padding: 14, boxShadow: "0 12px 32px -8px rgba(15,32,66,0.16)", border: "none" }}>
                <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: 12, overflow: "hidden", background: "var(--adb-surface-low)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={HERO_IMG}
                    alt="Modern mutfak ve beyaz eşya"
                    className="adb-hero-img"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "rgba(38,49,67,0.95)",
                      color: "#ecf1ff",
                      padding: "8px 10px",
                      borderRadius: 8,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: "#acc7ff" }}>
                      verified
                    </span>
                    <div>
                      <div className="adb-label-sm" style={{ color: "#b6c6f1" }}>
                        Resmi Yetkili Satıcı
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>ADB Ticaret Güvencesi</div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      background: "var(--adb-tertiary)",
                      color: "#fff",
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      display: "inline-flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      bolt
                    </span>
                    ProSmart™ Inverter
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    background: "var(--adb-surface-container)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)" }}>
                      published_with_changes
                    </span>
                    Eski cihazınız adresten alınır
                  </span>
                  <Link href="/takas" style={{ color: "var(--adb-primary)", fontSize: 12, fontWeight: 700 }}>
                    Detaylar
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="adb-container adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 28 }}>
            {TRUST.map((t) => (
              <div key={t.title} className="adb-card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="adb-trust-icon">
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                    {t.icon}
                  </span>
                </div>
                <div>
                  <h3 className="adb-headline-sm" style={{ margin: 0 }}>
                    {t.title}
                  </h3>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--adb-muted)", lineHeight: 1.45 }}>{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="adb-section" style={{ background: "var(--adb-surface)" }}>
          <div className="adb-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Resmi Beko Kataloğu
                </div>
                <h2 className="adb-headline-lg" style={{ margin: "4px 0 0" }}>
                  Popüler Kategoriler
                </h2>
              </div>
              <Link href="/kategori" style={{ color: "var(--adb-primary-container)", fontWeight: 700, fontSize: 14 }}>
                Tüm ürün gruplarını gör →
              </Link>
            </div>
            <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              {categories.map((c) => (
                <Link
                  key={c.title}
                  href={c.href}
                  className="adb-card adb-cat-tile"
                  style={{ padding: 16, textAlign: "center", textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      margin: "0 auto 10px",
                      borderRadius: 999,
                      background: "var(--adb-surface-low)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--adb-primary)" }}>
                      {c.icon}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--adb-primary-container)", fontWeight: 600, marginTop: 4 }}>{c.tech}</div>
                  <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{c.count}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="haftanin-firsatlari" className="adb-section adb-section-tint">
          <div className="adb-container">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--adb-tertiary)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <h2 className="adb-headline-lg" style={{ margin: 0 }}>
                      Haftanın Fırsat Ürünleri
                    </h2>
                    <span
                      style={{
                        background: "var(--adb-tertiary-fixed)",
                        color: "#3b0900",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      Sınırlı Stok
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                    Ana depodan aynı gün kargo avantajıyla.
                  </p>
                </div>
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  padding: "4px",
                  boxShadow: "var(--adb-shadow-sm)",
                }}
              >
                <DealCountdown />
              </div>
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
              {products.length > 0
                ? products.slice(0, 8).map((p) => (
                    <ProductCard
                      key={p.id}
                      href={`/urun/${p.slug}`}
                      sku={p.sku}
                      title={p.name}
                      priceLabel={priceMap[p.id]?.label}
                      listPriceLabel={priceMap[p.id]?.list}
                      energyClass="B"
                      features={["Ücretsiz montaj", "Orijinal Beko", "Hızlı sevk"]}
                      action={
                        <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%" }}>
                          Sepete Ekle / İncele
                        </Link>
                      }
                    />
                  ))
                : DEMO_PRODUCTS.map((p) => (
                    <ProductCard
                      key={p.id}
                      href={`/urun/${p.slug}`}
                      sku={p.sku}
                      title={p.name}
                      priceLabel={p.price}
                      listPriceLabel={p.list}
                      energyClass="B"
                      features={p.features}
                      action={
                        <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%" }}>
                          Sepete Ekle / İncele
                        </Link>
                      }
                    />
                  ))}
            </div>
          </div>
        </section>

        <section className="adb-section">
          <div className="adb-container">
            <div
              style={{
                borderRadius: 12,
                padding: "28px 24px",
                background: "linear-gradient(110deg, var(--adb-primary) 0%, var(--adb-primary-container) 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div className="adb-label-sm" style={{ color: "#bbd0ff" }}>
                  Çeyiz & Depolama
                </div>
                <h2 style={{ margin: "6px 0", fontSize: 28, fontWeight: 800 }}>Hazır çeyiz paketleri + ücretsiz depolama</h2>
                <p style={{ margin: 0, opacity: 0.9, maxWidth: 480 }}>
                  Düğün tarihine kadar ürünleriniz ADB deposunda güvende. Premium paketlerde fırın + ocak dahil.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/ceyiz" className="adb-btn adb-btn-promo" style={{ background: "var(--adb-tertiary-container)" }}>
                  Paketleri Gör
                </Link>
                <Link href="/ceyiz" className="adb-btn" style={{ background: "#fff", color: "var(--adb-primary)" }}>
                  Depolama Rezervasyonu
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="adb-section adb-section-tint">
          <div className="adb-container">
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                Neden ADB Ticaret?
              </div>
              <h2 className="adb-headline-lg" style={{ margin: "6px 0 0" }}>
                Güvenilir bayi, ölçülebilir hizmet
              </h2>
            </div>
            <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 28 }}>
              {STATS.map((s) => (
                <div key={s.label} className="adb-card" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "var(--adb-primary)" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "var(--adb-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {[
                ["Ayşe K.", "Montaj ekibi aynı gün geldi, buzdolabı kurulum mükemmeldi."],
                ["Mehmet Y.", "Takas teklifi net ve hızlıydı. Resmi fatura + garanti belgesi eksiksiz."],
                ["Elif D.", "Çeyiz paketini 4 ay depoladılar, düğün haftası teslim aldık."],
              ].map(([name, text]) => (
                <div key={name} className="adb-card" style={{ padding: 18 }}>
                  <div style={{ color: "#eab308", marginBottom: 8 }}>★★★★★</div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--adb-muted)", lineHeight: 1.55 }}>&ldquo;{text}&rdquo;</p>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>{name} · Google</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="adb-section">
          <div className="adb-container" style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div className="adb-card" style={{ padding: 22 }}>
              <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                Showroom
              </div>
              <h2 className="adb-headline-md" style={{ margin: "6px 0 10px" }}>
                Mağazalarımızı ziyaret edin
              </h2>
              <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.55 }}>
                {cms?.store.address || "Beşiktaş Merkez · Kadıköy Konsept · Bursa Nilüfer"}
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                Hafta içi 10:00–19:30 · Cumartesi 10:00–18:00 · Otopark / vale
              </p>
              <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Bayi #{dealerCode}</p>
            </div>
            <div className="adb-card" style={{ padding: 22 }}>
              <h2 className="adb-headline-md" style={{ marginTop: 0 }}>
                Sizi 15 dakika içinde arayalım
              </h2>
              <p style={{ color: "var(--adb-muted)", fontSize: 14 }}>Montaj, takas veya stok danışmanlığı için formu doldurun.</p>
              <LeadForm />
            </div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
