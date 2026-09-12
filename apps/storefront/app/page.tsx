import Link from "next/link";
import { ProductCard } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../components/site-shell";
import { DealCountdown } from "../components/deal-countdown";
import { LeadForm } from "../components/lead-form";
import { CampaignSlider, type CampaignSlide } from "../components/campaign-slider";

import { categoryImage } from "../lib/category-media";

const HERO_IMG =
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=2000&q=80";

const FALLBACK_CAMPAIGNS: CampaignSlide[] = [
  {
    id: "takas",
    subtitle: "Takas 2026",
    title: "15.000 TL’ye varan değişim desteği",
    body: "Eski beyaz eşyanızı getirin, yeni Beko’da peşin indirim kazanın. Yetkili servis montajı dahil.",
    ctaLabel: "Takas teklifi al",
    ctaHref: "/takas",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "ceyiz",
    subtitle: "Çeyiz paketleri",
    title: "Hazır setler + ücretsiz depolama",
    body: "Başlangıç ve premium paketler. Düğün tarihine kadar ürünlerinizi güvende saklayın.",
    ctaLabel: "Paketleri incele",
    ctaHref: "/ceyiz",
    imageUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "taksit",
    subtitle: "Ödeme avantajı",
    title: "Peşin fiyatına 9 taksit",
    body: "Anlaşmalı kartlara vade farksız taksit. Resmi garanti ve ücretsiz montajla birlikte.",
    ctaLabel: "Kampanyaları gör",
    ctaHref: "/kampanyalar",
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
  },
];

const FALLBACK_CATEGORIES = [
  { href: "/kategori/buzdolaplari", title: "Buzdolapları", tech: "HarvestFresh™", count: "48 Model", icon: "kitchen", image: categoryImage("buzdolaplari") },
  { href: "/kategori/camasir-makineleri", title: "Çamaşır Makineleri", tech: "SteamCure™", count: "34 Model", icon: "local_laundry_service", image: categoryImage("camasir-makineleri") },
  { href: "/kategori/bulasik-makineleri", title: "Bulaşık Makineleri", tech: "CornerIntense™", count: "26 Model", icon: "dishwasher_gen", image: categoryImage("bulasik-makineleri") },
  { href: "/kategori/klimalar", title: "Klimalar", tech: "Ekostar A+++", count: "18 Model", icon: "mode_fan", image: categoryImage("klimalar") },
  { href: "/kategori/ankastre-setler", title: "Ankastre Setler", tech: "Fırın & Ocak", count: "22 Paket", icon: "oven_gen", image: categoryImage("ankastre-setler") },
  { href: "/kategori/kucuk-ev-robot", title: "Küçük Ev & Robot", tech: "Lazer Haritalama", count: "52 Model", icon: "robot_2", image: categoryImage("kucuk-ev-robot") },
];

const DEMO_PRODUCTS = [
  {
    id: "demo-1",
    slug: "beko-b5rcne505lxp",
    sku: "B5RCNE505LXP",
    name: "Beko B5RCNE505LXP No Frost Buzdolabı",
    price: "34.499 TL",
    list: "38.999 TL",
    imageUrl: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80",
    features: ["HarvestFresh™ 3 Işıklı Teknoloji", "505 Litre Geniş Hacim"],
  },
  {
    id: "demo-2",
    slug: "beko-b3t68230w",
    sku: "B3T68230W",
    name: "Beko B3T68230W Kurutmalı Çamaşır Makinesi",
    price: "27.990 TL",
    list: "31.490 TL",
    imageUrl: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80",
    features: ["SteamCure™ Buhar", "9 kg Yıkama"],
  },
  {
    id: "demo-3",
    slug: "beko-bm3340i",
    sku: "BM 3340 I",
    name: "Beko BM 3340 I Ankastre Bulaşık Makinesi",
    price: "18.750 TL",
    list: "21.200 TL",
    imageUrl: "https://images.unsplash.com/photo-1585659722983-3a675dabf8ff?auto=format&fit=crop&w=800&q=80",
    features: ["CornerIntense™", "14 Kişilik"],
  },
  {
    id: "demo-4",
    slug: "beko-31260",
    sku: "31260",
    name: "Beko 31260 A+++ Inverter Klima",
    price: "22.499 TL",
    list: "25.999 TL",
    imageUrl: "https://images.unsplash.com/photo-1631545806609-3c9f7b0e0c1f?auto=format&fit=crop&w=800&q=80",
    features: ["Ekostar Inverter", "Ücretsiz Montaj"],
  },
];

const TRUST = [
  { icon: "verified_user", title: "Yetkili Satıcı Güvencesi", body: "%100 orijinal ambalajında Beko Türkiye faturalı ürünler." },
  { icon: "handyman", title: "Ücretsiz Servis Montajı", body: "Yetkili servis ekiplerince profesyonel kurulum." },
  { icon: "credit_card", title: "Vade Farksız 9 Taksit", body: "Anlaşmalı kartlara peşin fiyatına taksit." },
  { icon: "security", title: "Resmi 3+4 Yıl Garanti", body: "Arçelik & Beko A.Ş. güvencesiyle." },
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
  let products: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    shortDescription?: string;
    images?: Array<{ url: string }>;
  }> = [];
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
        image: categoryImage(c.slug),
      }));
    }
  } catch {
    /* fallback */
  }

  let campaignSlides: CampaignSlide[] = FALLBACK_CAMPAIGNS;
  try {
    const res = await client.promotions.listCampaigns(true);
    if (res.items?.length) {
      campaignSlides = res.items.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle || "Kampanya",
        body: c.body,
        imageUrl: c.imageUrl || FALLBACK_CAMPAIGNS[0]!.imageUrl,
        ctaLabel: c.ctaLabel || "İncele",
        ctaHref: c.ctaHref || "/kampanyalar",
      }));
    } else if (cms?.banners?.length) {
      const activeBanners = cms.banners.filter((b) => b.active !== false);
      if (activeBanners.length) {
        campaignSlides = activeBanners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle || "Kampanya",
          body: b.subtitle,
          imageUrl: b.imageUrl || FALLBACK_CAMPAIGNS[0]!.imageUrl,
          ctaLabel: b.ctaLabel || "İncele",
          ctaHref: b.ctaHref || "/kampanyalar",
        }));
      }
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
        <section className="adb-beko-hero">
          <div className="adb-beko-hero-media" style={{ backgroundImage: `url(${HERO_IMG})` }} aria-hidden />
          <div className="adb-container adb-beko-hero-content adb-animate-in">
            <p className="adb-beko-brand">beko</p>
            <h1 className="adb-display" style={{ color: "#fff", maxWidth: 640, margin: "0 0 14px" }}>
              {heroTitle.includes("15.000") ? (
                <>
                  Eski eşyanızı alın,{" "}
                  <span style={{ color: "#7dd3fc" }}>15.000 TL&apos;ye varan</span> avantajla yenileyin
                </>
              ) : (
                heroTitle
              )}
            </h1>
            <p style={{ margin: 0, maxWidth: 480, fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>{heroSub}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
              <Link href={cms?.hero?.ctaHref || "/takas"} className="adb-btn adb-btn-primary" style={{ height: 48, padding: "0 24px" }}>
                {cms?.hero?.ctaLabel || "Kampanyayı İncele"}
              </Link>
              <Link
                href="/kategori"
                className="adb-btn"
                style={{ height: 48, background: "transparent", border: "1px solid rgba(255,255,255,0.55)", color: "#fff" }}
              >
                Ürünleri Keşfet
              </Link>
            </div>
          </div>
        </section>

        <section style={{ background: "#fff", borderBottom: "1px solid var(--adb-border-subtle)" }}>
          <div
            className="adb-container"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
              padding: "18px 24px",
            }}
          >
            {TRUST.map((t) => (
              <div key={t.title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 4px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)", fontSize: 26 }}>
                  {t.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--adb-muted)", lineHeight: 1.4, marginTop: 2 }}>{t.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <CampaignSlider slides={campaignSlides} />

        <section className="adb-section" style={{ background: "#fff" }}>
          <div className="adb-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
              <div>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Ürün grupları
                </div>
                <h2 className="adb-headline-lg" style={{ margin: "4px 0 0", fontFamily: "var(--adb-font-display)" }}>
                  Yaşam alanınıza göre keşfedin
                </h2>
              </div>
              <Link href="/kategori" style={{ color: "var(--adb-primary)", fontWeight: 700, fontSize: 14 }}>
                Tüm kategoriler →
              </Link>
            </div>
            <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {categories.map((c) => (
                <Link key={c.title} href={c.href} className="adb-beko-cat">
                  <div className="adb-beko-cat-media" style={{ backgroundImage: `url(${c.image || categoryImage("buzdolaplari")})` }} />
                  <div className="adb-beko-cat-body">
                    <div style={{ fontFamily: "var(--adb-font-display)", fontWeight: 700, fontSize: 18 }}>{c.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{c.tech || c.count}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section
          className="adb-section"
          style={{
            background: "linear-gradient(120deg, #005f8a 0%, #0083be 55%, #00a3e0 100%)",
            color: "#fff",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <div className="adb-container" style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "center" }}>
            <div>
              <div className="adb-label-sm" style={{ color: "#b3e5fc" }}>
                Yetkili servis montajı
              </div>
              <h2 style={{ margin: "8px 0 12px", fontFamily: "var(--adb-font-display)", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700 }}>
                Siparişten kuruluma kadar yanınızdayız
              </h2>
              <p style={{ margin: 0, opacity: 0.92, lineHeight: 1.6, maxWidth: 480 }}>
                Ödeme onayı, sevk, randevu SMS’i ve ücretsiz montaj — tüm adımları tek yerden takip edin.
              </p>
              <Link
                href="/hesabim/siparisler"
                className="adb-btn"
                style={{ marginTop: 18, background: "#fff", color: "var(--adb-primary-deep)", textDecoration: "none" }}
              >
                Siparişimi takip et
              </Link>
            </div>
            <div
              style={{
                minHeight: 240,
                borderRadius: 8,
                backgroundImage: "url(https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1000&q=80)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </div>
        </section>

        <section id="haftanin-firsatlari" className="adb-section" style={{ background: "var(--adb-surface)" }}>
          <div className="adb-container">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22, alignItems: "center" }}>
              <div>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Öne çıkanlar
                </div>
                <h2 className="adb-headline-lg" style={{ margin: "4px 0 0", fontFamily: "var(--adb-font-display)" }}>
                  Haftanın fırsat ürünleri
                </h2>
              </div>
              <DealCountdown />
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
              {products.length > 0
                ? products.slice(0, 8).map((p) => (
                    <ProductCard
                      key={p.id}
                      href={`/urun/${p.slug}`}
                      sku={p.sku}
                      title={p.name}
                      imageUrl={p.images?.[0]?.url}
                      priceLabel={priceMap[p.id]?.label}
                      listPriceLabel={priceMap[p.id]?.list}
                      energyClass="B"
                      features={p.shortDescription ? [p.shortDescription, "Ücretsiz montaj"] : ["Ücretsiz montaj", "Orijinal Beko"]}
                      action={
                        <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%" }}>
                          İncele
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
                      imageUrl={p.imageUrl}
                      priceLabel={p.price}
                      listPriceLabel={p.list}
                      energyClass="B"
                      features={p.features}
                      action={
                        <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%" }}>
                          İncele
                        </Link>
                      }
                    />
                  ))}
            </div>
          </div>
        </section>

        <section className="adb-section" style={{ background: "#fff" }}>
          <div className="adb-container">
            <div
              style={{
                borderRadius: 8,
                padding: "36px 28px",
                background: "var(--adb-secondary-navy)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div className="adb-label-sm" style={{ color: "#7dd3fc" }}>
                  Çeyiz & Depolama
                </div>
                <h2 style={{ margin: "8px 0", fontSize: 28, fontWeight: 700, fontFamily: "var(--adb-font-display)" }}>
                  Hazır çeyiz paketleri + ücretsiz depolama
                </h2>
                <p style={{ margin: 0, opacity: 0.9, maxWidth: 480 }}>Düğün tarihine kadar ürünleriniz ADB deposunda güvende.</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/ceyiz" className="adb-btn adb-btn-primary">
                  Paketleri Gör
                </Link>
                <Link
                  href="/ceyiz"
                  className="adb-btn"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.4)", color: "#fff" }}
                >
                  Depolama
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="adb-section" style={{ background: "var(--adb-surface)" }}>
          <div className="adb-container">
            <div style={{ marginBottom: 28, maxWidth: 560 }}>
              <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                Neden ADB Ticaret?
              </div>
              <h2 className="adb-headline-lg" style={{ margin: "6px 0 0", fontFamily: "var(--adb-font-display)" }}>
                Güvenilir bayi, ölçülebilir hizmet
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gap: 0,
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                marginBottom: 36,
                borderTop: "1px solid var(--adb-border)",
                borderBottom: "1px solid var(--adb-border)",
              }}
            >
              {STATS.map((s) => (
                <div key={s.label} style={{ padding: "22px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "var(--adb-primary)", fontFamily: "var(--adb-font-display)" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "var(--adb-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {[
                ["Ayşe K.", "Montaj ekibi aynı gün geldi, buzdolabı kurulum mükemmeldi."],
                ["Mehmet Y.", "Takas teklifi net ve hızlıydı. Resmi fatura + garanti belgesi eksiksiz."],
                ["Elif D.", "Çeyiz paketini 4 ay depoladılar, düğün haftası teslim aldık."],
              ].map(([name, text]) => (
                <div key={name} style={{ paddingTop: 4 }}>
                  <div style={{ color: "var(--adb-primary)", marginBottom: 8, letterSpacing: 2 }}>★★★★★</div>
                  <p style={{ margin: 0, fontSize: 15, color: "var(--adb-muted)", lineHeight: 1.55 }}>&ldquo;{text}&rdquo;</p>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="adb-section" style={{ background: "#fff" }}>
          <div className="adb-container" style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div>
              <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                Showroom
              </div>
              <h2 className="adb-headline-md" style={{ margin: "6px 0 10px", fontFamily: "var(--adb-font-display)" }}>
                Mağazalarımızı ziyaret edin
              </h2>
              <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.55 }}>
                {cms?.store.address || "Beşiktaş Merkez · Kadıköy Konsept · Bursa Nilüfer"}
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>Hafta içi 10:00–19:30 · Cumartesi 10:00–18:00</p>
              <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Bayi #{dealerCode}</p>
            </div>
            <div>
              <h2 className="adb-headline-md" style={{ marginTop: 0, fontFamily: "var(--adb-font-display)" }}>
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
