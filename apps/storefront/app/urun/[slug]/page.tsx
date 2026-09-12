import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../../components/site-shell";
import { PdpBuyBox } from "../../../components/pdp-buy-box";
import { PdpGallery } from "../../../components/pdp-gallery";
import { WishlistButton } from "../../../components/wishlist-button";
import { PdpDetailSections } from "../../../components/pdp-detail-sections";

type PageProps = { params: Promise<{ slug: string }> };

function api() {
  return createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  });
}

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function parseBranches(raw?: string) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((b) => ({
        name: String(b.name || b.title || "Mağaza"),
        city: String(b.city || ""),
        district: String(b.district || ""),
        address: String(b.address || ""),
        phone: String(b.phone || ""),
      }));
    }
  } catch {
    /* plain text */
  }
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ name: line, city: "", district: "", address: line, phone: "" }));
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
  const detail = product.detail;
  const energy = detail?.energyClass || "B";

  let related: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    shortDescription?: string;
    images?: Array<{ url: string }>;
  }> = [];
  try {
    related = (await client.products.list()).items.filter((p) => p.id !== product.id).slice(0, 4);
  } catch {
    related = [];
  }

  const relatedPrices = await Promise.all(
    related.map(async (p) => {
      try {
        const price = await client.pricing.get(p.id);
        return { id: p.id, label: formatTRY(price.amount), list: formatTRY(Math.round(price.amount * 1.12)) };
      } catch {
        return { id: p.id, label: undefined as string | undefined, list: undefined as string | undefined };
      }
    }),
  );
  const relatedPriceMap = Object.fromEntries(relatedPrices.map((p) => [p.id, p]));

  const relatedDetails = await Promise.all(
    related.slice(0, 2).map(async (p) => {
      try {
        const full = await client.products.getBySlug(p.slug);
        const rows = full.detail?.specGroups?.[0]?.rows?.slice(0, 6) || [];
        return {
          id: p.id,
          compare: rows.map((r) => ({ label: r.label, value: r.value })),
        };
      } catch {
        return { id: p.id, compare: [] as Array<{ label: string; value: string }> };
      }
    }),
  );
  const relatedDetailMap = Object.fromEntries(relatedDetails.map((r) => [r.id, r.compare]));

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
              availability: saleable > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: "ADB Ticaret Beko Yetkili Satıcısı" },
            },
          }),
        }}
      />
      <main>
        <div className="adb-container" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--adb-muted)", margin: 0 }}>
            <Link href="/">Ana Sayfa</Link> / <Link href="/kategori">Ürün Grupları</Link> /{" "}
            <span style={{ color: "var(--adb-on-surface)", fontWeight: 600 }}>{product.name}</span>
          </p>
        </div>

        <section style={{ background: "#fff", borderTop: "1px solid var(--adb-border-subtle)", borderBottom: "1px solid var(--adb-border-subtle)" }}>
          <div
            className="adb-container adb-pdp-grid"
            style={{
              display: "grid",
              gap: 40,
              gridTemplateColumns: "minmax(0, 1.05fr) minmax(280px, 0.95fr)",
              padding: "28px 24px 40px",
              alignItems: "start",
            }}
          >
            <PdpGallery dealerCode={dealerCode} images={product.images} energyClass={energy} />

            <div className="adb-animate-in adb-pdp-buy">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <span className="adb-pdp-chip">beko</span>
                <span className="adb-pdp-chip adb-pdp-chip-muted">Ücretsiz montaj</span>
                <span className="adb-pdp-chip adb-pdp-chip-muted">Resmi garanti</span>
              </div>

              <h1
                style={{
                  margin: "0 0 8px",
                  fontFamily: "var(--adb-font-display)",
                  fontSize: "clamp(1.45rem, 2.8vw, 2rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {product.name}
              </h1>
              <p style={{ color: "var(--adb-outline)", margin: "0 0 18px", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                Model {product.sku}
              </p>

              <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--adb-border-subtle)", marginBottom: 18 }}>
                {list > 0 ? (
                  <div style={{ fontSize: 13, color: "var(--adb-outline)", textDecoration: "line-through" }}>{formatTRY(list)}</div>
                ) : null}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <div className="adb-price" style={{ fontSize: 34, color: "var(--adb-primary-deep)", fontFamily: "var(--adb-font-display)" }}>
                    {amount > 0 ? formatTRY(amount) : "Fiyat sorunuz"}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--adb-muted)" }}>KDV dahil</span>
                  {amount > 0 ? (
                    <span
                      style={{
                        background: "var(--adb-tertiary-fixed)",
                        color: "#9a3412",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 2,
                      }}
                    >
                      %12 bayi indirimi
                    </span>
                  ) : null}
                </div>
                {amount > 0 ? (
                  <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--adb-muted)", lineHeight: 1.5 }}>
                    Peşin fiyatına <strong style={{ color: "var(--adb-on-surface)" }}>9 taksit</strong> ({formatTRY(installment)}/ay) · Montaj{" "}
                    <strong style={{ color: "var(--adb-on-surface)" }}>0 TL</strong>
                  </p>
                ) : null}
              </div>

              <p style={{ fontSize: 14, color: saleable > 0 ? "var(--adb-success)" : "var(--adb-error)", fontWeight: 650, margin: "0 0 8px" }}>
                {saleable > 0 ? `Stokta · ${saleable} adet satılabilir` : "Stok bilgisini sorun / tükendi"}
              </p>
              <p style={{ fontSize: 13, color: "var(--adb-primary-deep)", fontWeight: 700, display: "flex", gap: 6, alignItems: "center", margin: "0 0 18px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  local_shipping
                </span>
                15:00’e kadar siparişlerde aynı gün sevk
              </p>

              <div style={{ display: "grid", gap: 10, maxWidth: 440 }}>
                <PdpBuyBox productId={product.id} productSlug={product.slug} sku={product.sku} name={product.name} unitPrice={amount} variants={product.variants} />
                <WishlistButton productId={product.id} productName={product.name} sku={product.sku} productSlug={product.slug} />
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

              <div
                style={{
                  marginTop: 22,
                  display: "grid",
                  gap: 0,
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  borderTop: "1px solid var(--adb-border-subtle)",
                }}
              >
                {[
                  { icon: "handyman", t: "Ücretsiz montaj" },
                  { icon: "published_with_changes", t: "Takas desteği" },
                  { icon: "verified_user", t: "3+4 garanti" },
                ].map((x) => (
                  <div key={x.t} style={{ padding: "16px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--adb-muted)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--adb-primary)", display: "block", margin: "0 auto 6px" }}>
                      {x.icon}
                    </span>
                    {x.t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="adb-container" style={{ padding: "24px 24px 72px" }}>
          <PdpDetailSections
            productId={product.id}
            productName={product.name}
            sku={product.sku}
            amount={amount}
            detail={detail}
            store={{
              phone,
              address: cms?.store.address,
              dealerCode,
              branches: parseBranches(cms?.store.branches),
            }}
            related={related.slice(0, 2).map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              sku: p.sku,
              shortDescription: p.shortDescription,
              priceLabel: relatedPriceMap[p.id]?.label,
              compare: relatedDetailMap[p.id] || [],
            }))}
          />

          {related.length > 0 ? (
            <section style={{ marginTop: 48 }}>
              <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                Keşfet
              </div>
              <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
                Benzer ürünler
              </h2>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                {related.map((p) => (
                  <ProductCard
                    key={p.id}
                    href={`/urun/${p.slug}`}
                    sku={p.sku}
                    title={p.name}
                    imageUrl={p.images?.[0]?.url}
                    priceLabel={relatedPriceMap[p.id]?.label}
                    listPriceLabel={relatedPriceMap[p.id]?.list}
                    features={p.shortDescription ? [p.shortDescription] : ["Orijinal Beko"]}
                    action={
                      <Link href={`/urun/${p.slug}`} className="adb-btn adb-btn-primary" style={{ width: "100%", textDecoration: "none" }}>
                        İncele
                      </Link>
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </StorefrontShell>
  );
}
