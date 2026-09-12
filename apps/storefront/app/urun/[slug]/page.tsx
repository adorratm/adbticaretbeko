import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../../components/site-shell";
import { PdpBuyBox } from "../../../components/pdp-buy-box";
import { PdpGallery } from "../../../components/pdp-gallery";
import { WishlistButton } from "../../../components/wishlist-button";
import { PdpReviews } from "../../../components/pdp-reviews";

type PageProps = { params: Promise<{ slug: string }> };

function api() {
  return createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });
}

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await api().products.getBySlug(slug);
    const description =
      product.shortDescription || product.description || `${product.name} — Beko yetkili satıcı ADB Ticaret`;
    return {
      title: product.name,
      description,
      alternates: { canonical: `/urun/${product.slug}` },
      openGraph: {
        title: product.name,
        description,
        url: `/urun/${product.slug}`,
        type: "website",
      },
      other: {
        "product:brand": "Beko",
        "product:retailer_item_id": product.sku,
      },
    };
  } catch {
    return { title: "Ürün bulunamadı" };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const client = api();
  let product;
  try {
    product = await client.products.getBySlug(slug);
  } catch {
    notFound();
  }

  let amount = 0;
  let saleable = 0;
  try {
    amount = (await client.pricing.get(product.id)).amount;
  } catch {
    amount = 0;
  }
  try {
    saleable = (await client.inventory.get(product.id)).saleable;
  } catch {
    saleable = 0;
  }

  let cms;
  try {
    cms = await client.cms.home();
  } catch {
    cms = null;
  }

  const list = amount > 0 ? Math.round(amount * 1.12) : 0;
  const installment = amount > 0 ? Math.round(amount / 9) : 0;
  const phone = cms?.store.phone || "0850 300 23 56";
  const dealerCode = cms?.store.dealerCode || "340982";

  const specs = [
    ["Model / SKU", product.sku],
    ["Durum", product.status],
    ["Enerji Sınıfı", "B"],
    ["Montaj", "Yetkili servis · Ücretsiz"],
    ["Garanti", "3 yıl resmi + 4 yıl opsiyonel"],
    ["Teslimat", "14:00’e kadar siparişlerde aynı gün sevk"],
    ["Açıklama", product.shortDescription || product.description || "Beko resmi bayi ürünü"],
  ];

  const techs = [
    { title: "ProSmart™ Inverter", body: "Düşük enerji, sessiz çalışma" },
    { title: "HarvestFresh™", body: "Sebze-meyve tazeliğini koruyan ışık teknolojisi" },
    { title: "Yetkili Montaj", body: "Beko servisi ile ücretsiz kurulum" },
  ];

  return (
    <StorefrontShell
      announcement={cms?.announcement}
      footer={{
        phone,
        whatsapp: cms?.store.whatsapp || phone,
        address: cms?.store.address,
        dealerCode,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            sku: product.sku,
            description: product.shortDescription || product.description || product.name,
            brand: { "@type": "Brand", name: "Beko" },
            offers: {
              "@type": "Offer",
              url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/urun/${product.slug}`,
              priceCurrency: "TRY",
              price: amount > 0 ? (amount / 100).toFixed(2) : undefined,
              availability:
                saleable > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: "ADB Ticaret Beko Yetkili Satıcısı" },
            },
          }),
        }}
      />
      <main className="adb-container" style={{ paddingTop: 24, paddingBottom: 64 }}>
        <p style={{ fontSize: 13, color: "var(--adb-muted)", marginBottom: 16 }}>
          <Link href="/">Ana Sayfa</Link> / <Link href="/kategori">Ürün Grupları</Link> /{" "}
          <span style={{ color: "var(--adb-on-surface)", fontWeight: 600 }}>{product.name}</span>
        </p>

        <div style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <PdpGallery dealerCode={dealerCode} images={product.images} />

          <div className="adb-animate-in">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Badge tone="dealer">Orijinal Beko</Badge>
              <Badge tone="service">Ücretsiz Montaj</Badge>
              <Badge tone="service">Resmi Garanti</Badge>
            </div>
            <h1 className="adb-headline-lg" style={{ margin: "0 0 6px" }}>
              {product.name}
            </h1>
            <p style={{ color: "var(--adb-outline)", marginTop: 0, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
              Model: {product.sku}
            </p>

            <div className="adb-card" style={{ padding: 16, marginBottom: 16, background: "var(--adb-surface-low)", border: "none" }}>
              {list > 0 ? (
                <div style={{ fontSize: 13, color: "var(--adb-outline)", textDecoration: "line-through" }}>{formatTRY(list)}</div>
              ) : null}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div className="adb-price" style={{ fontSize: 32 }}>
                  {amount > 0 ? formatTRY(amount) : "Fiyat sorunuz"}
                </div>
                <span style={{ fontSize: 13, color: "var(--adb-muted)" }}>(KDV Dahil)</span>
                {amount > 0 ? (
                  <span
                    style={{
                      background: "var(--adb-tertiary-fixed)",
                      color: "#7d1f00",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    %12 Bayi İndirimi
                  </span>
                ) : null}
              </div>
              {amount > 0 ? (
                <>
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                    Havale ile %3 ekstra indirim · Peşin fiyatına <strong>9 taksit</strong> ({formatTRY(installment)}/ay)
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                    Montaj dahil: <strong>0 TL</strong> · Ek garanti upsell: <strong>+2.490 TL</strong>
                  </p>
                </>
              ) : null}
            </div>

            <p style={{ fontSize: 14, color: saleable > 0 ? "var(--adb-success)" : "var(--adb-error)", fontWeight: 600 }}>
              {saleable > 0 ? `Mağazada ${saleable} adet satılabilir stok` : "Stok bilgisini sorun / tükendi"}
            </p>
            <p style={{ fontSize: 13, color: "var(--adb-tertiary)", fontWeight: 700, display: "flex", gap: 6, alignItems: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                schedule
              </span>
              Saat 15:00’e kadar siparişlerde aynı gün sevk
            </p>

            <div style={{ marginTop: 16, maxWidth: 420, display: "grid", gap: 10 }}>
              <PdpBuyBox
                productId={product.id}
                sku={product.sku}
                name={product.name}
                unitPrice={amount}
                variants={product.variants}
              />
              <WishlistButton
                productId={product.id}
                productName={product.name}
                sku={product.sku}
                productSlug={product.slug}
              />
              <a
                href={`https://wa.me/${(cms?.store.whatsapp || phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Merhaba, ${product.sku} hakkında bilgi almak istiyorum.`)}`}
                className="adb-btn adb-btn-tertiary"
              >
                <span className="material-symbols-outlined" style={{ color: "#059669" }}>
                  chat
                </span>
                WhatsApp ile özel teklif
              </a>
            </div>

            <div className="adb-card" style={{ marginTop: 20, padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)" }}>
                verified
              </span>
              <div style={{ fontSize: 13 }}>
                <strong>Bayi Belgesi #{dealerCode}</strong>
                <div style={{ color: "var(--adb-muted)" }}>Beko Türkiye yetkili satıcı güvencesi</div>
              </div>
            </div>
          </div>
        </div>

        <section style={{ marginTop: 40 }}>
          <h2 className="adb-headline-md">Patentli teknolojiler</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: 12 }}>
            {techs.map((t) => (
              <div key={t.title} className="adb-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className="adb-headline-md">Teknik özellikler</h2>
          <div className="adb-card" style={{ marginTop: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {specs.map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 ? "var(--adb-surface-low)" : "#fff" }}>
                    <td style={{ padding: "12px 14px", width: "40%", color: "var(--adb-muted)" }}>{k}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontFeatureSettings: '"tnum" 1' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className="adb-headline-md">Banka taksit örnekleri</h2>
          <div className="adb-card" style={{ marginTop: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>Banka</th>
                  <th style={{ padding: 12 }}>3 Taksit</th>
                  <th style={{ padding: 12 }}>6 Taksit</th>
                  <th style={{ padding: 12 }}>9 Taksit</th>
                </tr>
              </thead>
              <tbody>
                {["Garanti BBVA", "İş Bankası", "Yapı Kredi"].map((b) => (
                  <tr key={b} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                    <td style={{ padding: 12, fontWeight: 600 }}>{b}</td>
                    <td style={{ padding: 12 }}>{amount ? formatTRY(Math.round(amount / 3)) : "—"}</td>
                    <td style={{ padding: 12 }}>{amount ? formatTRY(Math.round(amount / 6)) : "—"}</td>
                    <td style={{ padding: 12 }}>{amount ? formatTRY(Math.round(amount / 9)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <PdpReviews productId={product.id} />
      </main>
    </StorefrontShell>
  );
}
