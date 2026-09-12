"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ProductDetail } from "@adb/api-types";
import { PdpReviews } from "./pdp-reviews";

type Branch = { name?: string; city?: string; district?: string; address?: string; phone?: string };

type Related = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  priceLabel?: string;
  compare?: Array<{ label: string; value: string }>;
};

const SECTIONS = [
  { id: "ozellikler", label: "Özellikler" },
  { id: "teknik", label: "Teknik Özellikler" },
  { id: "dokumanlar", label: "Dokümanlar" },
  { id: "magaza", label: "Mağaza" },
  { id: "odeme", label: "Ödeme ve Taksit" },
  { id: "iade", label: "İptal ve İade" },
  { id: "yorumlar", label: "Yorumlar" },
  { id: "karsilastir", label: "Karşılaştır" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export function PdpDetailSections({
  productId,
  productName,
  sku,
  amount,
  detail,
  store,
  related,
}: {
  productId: string;
  productName: string;
  sku: string;
  amount: number;
  detail?: ProductDetail | null;
  store?: {
    phone?: string;
    address?: string;
    dealerCode?: string;
    branches?: Branch[];
  } | null;
  related: Related[];
}) {
  const [active, setActive] = useState<SectionId>("ozellikler");
  const [animKey, setAnimKey] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const features = detail?.features || [];
  const specGroups = detail?.specGroups || [];
  const documents = detail?.documents || [];
  const dims = detail?.dimensions;
  const branches = store?.branches?.length
    ? store.branches
    : [
        {
          name: "ADB Ticaret Beko Yetkili Satıcı",
          city: "İstanbul",
          district: "Merkez",
          address: store?.address || "Yetkili bayi showroom",
          phone: store?.phone,
        },
      ];

  const compareRows = useMemo(() => {
    const keys = new Set<string>();
    for (const r of related) {
      for (const c of r.compare || []) keys.add(c.label);
    }
    if (specGroups[0]) {
      for (const row of specGroups[0].rows.slice(0, 6)) keys.add(row.label);
    }
    return Array.from(keys).slice(0, 8);
  }, [related, specGroups]);

  function selectTab(id: SectionId) {
    if (id === active) return;
    setActive(id);
    setAnimKey((k) => k + 1);
  }

  useLayoutEffect(() => {
    const track = trackRef.current;
    const btn = btnRefs.current[active];
    if (!track || !btn) return;

    const update = () => {
      const trackBox = track.getBoundingClientRect();
      const btnBox = btn.getBoundingClientRect();
      setIndicator({
        left: btnBox.left - trackBox.left + track.scrollLeft,
        width: btnBox.width,
        ready: true,
      });
    };

    update();
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const focused = document.activeElement;
      const inTabs = focused instanceof HTMLElement && focused.getAttribute("role") === "tab";
      if (!inTabs) return;
      const idx = SECTIONS.findIndex((s) => s.id === active);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = SECTIONS[Math.min(SECTIONS.length - 1, idx + 1)]!;
        selectTab(next.id);
        btnRefs.current[next.id]?.focus();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = SECTIONS[Math.max(0, idx - 1)]!;
        selectTab(prev.id);
        btnRefs.current[prev.id]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  let panel: ReactNode = null;
  switch (active) {
    case "ozellikler":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Özellikler
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 8px", fontFamily: "var(--adb-font-display)" }}>
            Ürün teknolojileri
          </h2>
          <p style={{ margin: "0 0 22px", color: "var(--adb-muted)", maxWidth: 640, fontSize: 14, lineHeight: 1.5 }}>
            {productName} modelinin öne çıkan Beko teknolojileri ve kullanım avantajları.
          </p>
          {dims ? (
            <div className="adb-pdp-dims">
              {[
                { label: "Genişlik", value: dims.width },
                { label: "Yükseklik", value: dims.height },
                { label: "Derinlik", value: dims.depth },
              ]
                .filter((d) => d.value)
                .map((d) => (
                  <div key={d.label}>
                    <strong>{d.value}</strong>
                    <span>{d.label}</span>
                  </div>
                ))}
              {detail?.energyClass ? (
                <div>
                  <strong>{detail.energyClass}</strong>
                  <span>Enerji sınıfı</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="adb-pdp-feature-list">
            {features.map((f) => (
              <article key={f.title} className="adb-pdp-feature">
                <div className="adb-pdp-feature-icon" aria-hidden>
                  <span className="material-symbols-outlined">{f.icon || "auto_awesome"}</span>
                </div>
                <div>
                  {f.subtitle ? <div className="adb-pdp-feature-sub">{f.subtitle}</div> : null}
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      );
      break;
    case "teknik":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Teknik
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
            Ürün teknik özellikleri
          </h2>
          <div className="adb-pdp-spec-stack">
            {specGroups.map((g) => (
              <div key={g.title} className="adb-pdp-spec-group">
                <h3>{g.title}</h3>
                <table>
                  <tbody>
                    {g.rows.map((row) => (
                      <tr key={`${g.title}-${row.label}`}>
                        <td>{row.label}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {!specGroups.length ? (
              <div className="adb-pdp-spec-group">
                <h3>Genel</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>Marka</td>
                      <td>Beko</td>
                    </tr>
                    <tr>
                      <td>Model / SKU</td>
                      <td>{sku}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </>
      );
      break;
    case "dokumanlar":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Dokümanlar
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 10px", fontFamily: "var(--adb-font-display)" }}>
            Kılavuzlar ve etiketler
          </h2>
          <p style={{ margin: "0 0 18px", color: "var(--adb-muted)", fontSize: 14, maxWidth: 560, lineHeight: 1.5 }}>
            Ürünün güvenli kurulum ve kullanımı ile ilgili bilgiler kullanma kılavuzunda yer alır.
          </p>
          <div className="adb-pdp-docs">
            {(documents.length ? documents : [{ title: "Ürün bilgi formu", url: "#", lang: "Türkçe", kind: "info" }]).map(
              (d) => (
                <a key={`${d.title}-${d.lang || ""}`} href={d.url} target="_blank" rel="noreferrer" className="adb-pdp-doc">
                  <span className="material-symbols-outlined">
                    {d.kind === "energy" ? "energy_savings_leaf" : d.kind === "manual" ? "menu_book" : "description"}
                  </span>
                  <span>
                    <strong>{d.title}</strong>
                    {d.lang ? <em>{d.lang}</em> : null}
                  </span>
                </a>
              ),
            )}
          </div>
        </>
      );
      break;
    case "magaza":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Mağaza
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 10px", fontFamily: "var(--adb-font-display)" }}>
            Hangi mağazada var
          </h2>
          <p style={{ margin: "0 0 18px", color: "var(--adb-muted)", fontSize: 14 }}>
            ADB Ticaret yetkili Beko satış noktaları{store?.dealerCode ? ` · Bayi kodu ${store.dealerCode}` : ""}.
          </p>
          <div className="adb-pdp-stores">
            {branches.map((b, i) => (
              <div key={`${b.name || "store"}-${i}`} className="adb-pdp-store">
                <strong>{b.name || "Yetkili satış noktası"}</strong>
                <span>{[b.district, b.city].filter(Boolean).join(" / ") || "Türkiye"}</span>
                {b.address ? <p>{b.address}</p> : null}
                {b.phone ? (
                  <a href={`tel:${b.phone}`} className="adb-btn adb-btn-tertiary" style={{ marginTop: 10, height: 36 }}>
                    {b.phone}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </>
      );
      break;
    case "odeme":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Ödeme
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
            Ödeme ve taksit seçenekleri
          </h2>
          <div className="adb-pdp-pay-grid">
            <div className="adb-pdp-pay-card">
              <h3>Kredi kartı</h3>
              <p>Peşin fiyatına taksit örnekleri (tek kart).</p>
              <table>
                <thead>
                  <tr>
                    <th>Banka</th>
                    <th>3</th>
                    <th>6</th>
                    <th>9</th>
                  </tr>
                </thead>
                <tbody>
                  {["Garanti BBVA", "İş Bankası", "Yapı Kredi"].map((b) => (
                    <tr key={b}>
                      <td>{b}</td>
                      <td>{amount ? formatTRY(Math.round(amount / 3)) : "—"}</td>
                      <td>{amount ? formatTRY(Math.round(amount / 6)) : "—"}</td>
                      <td>{amount ? formatTRY(Math.round(amount / 9)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adb-pdp-pay-card">
              <h3>Havale / EFT</h3>
              <ul>
                <li>Açıklamaya sipariş numarasını yazın.</li>
                <li>Tutar sipariş tutarı ile aynı olmalıdır.</li>
                <li>1 iş günü içinde ödeme beklenir.</li>
              </ul>
              <h3 style={{ marginTop: 18 }}>Alışveriş kredisi</h3>
              <p>Ödeme adımında anlaşmalı banka üzerinden başvuru yapabilirsiniz.</p>
            </div>
          </div>
        </>
      );
      break;
    case "iade":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            İade
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
            İptal ve iade
          </h2>
          <ol className="adb-pdp-steps">
            {[
              "Siparişlerim’den iptal/iade talebi oluşturun",
              "Yetkili servis iade randevusu planlansın",
              "Ürünü fatura ile eksiksiz teslim edin",
              "Kontrol sonrası iade onaylansın",
              "Ücret iadesi SMS ile bilgilendirilsin",
            ].map((step, i) => (
              <li key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
            Detaylar için <Link href="/iade">iade koşulları</Link> sayfasını inceleyebilirsiniz.
          </p>
        </>
      );
      break;
    case "yorumlar":
      panel = <PdpReviews productId={productId} />;
      break;
    case "karsilastir":
      panel = (
        <>
          <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
            Karşılaştır
          </p>
          <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
            Sizin için karşılaştırdık
          </h2>
          {related.length ? (
            <div className="adb-pdp-compare-wrap">
              <table className="adb-pdp-compare">
                <thead>
                  <tr>
                    <th>Özellik</th>
                    <th>
                      <div className="adb-pdp-compare-head current">{productName}</div>
                      <div className="adb-pdp-compare-sku">{sku}</div>
                    </th>
                    {related.slice(0, 2).map((r) => (
                      <th key={r.id}>
                        <Link href={`/urun/${r.slug}`} className="adb-pdp-compare-head">
                          {r.name}
                        </Link>
                        <div className="adb-pdp-compare-sku">{r.sku}</div>
                        {r.priceLabel ? <div className="adb-pdp-compare-price">{r.priceLabel}</div> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Fiyat</td>
                    <td>{amount ? formatTRY(amount) : "—"}</td>
                    {related.slice(0, 2).map((r) => (
                      <td key={`${r.id}-price`}>{r.priceLabel || "—"}</td>
                    ))}
                  </tr>
                  {compareRows.map((label) => {
                    const self = specGroups.flatMap((g) => g.rows).find((row) => row.label === label)?.value || "—";
                    return (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{self}</td>
                        {related.slice(0, 2).map((r) => (
                          <td key={`${r.id}-${label}`}>
                            {r.compare?.find((c) => c.label === label)?.value || r.shortDescription || "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--adb-muted)" }}>Karşılaştırılacak benzer ürün bulunamadı.</p>
          )}
        </>
      );
      break;
  }

  return (
    <div className="adb-pdp-sections">
      <div className="adb-pdp-section-nav" role="tablist" aria-label="Ürün detay bölümleri">
        <div className="adb-pdp-section-nav-track" ref={trackRef}>
          <span
            className={`adb-pdp-tab-indicator${indicator.ready ? " is-ready" : ""}`}
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
            aria-hidden
          />
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={active === s.id}
              aria-controls={`panel-${s.id}`}
              tabIndex={active === s.id ? 0 : -1}
              className={active === s.id ? "is-active" : undefined}
              ref={(el) => {
                btnRefs.current[s.id] = el;
              }}
              onClick={() => selectTab(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div
        key={animKey}
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="adb-pdp-tab-panel"
      >
        {panel}
      </div>
    </div>
  );
}
