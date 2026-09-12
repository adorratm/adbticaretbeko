"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Field, Input, SearchableSelect, TextArea } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

const HERO =
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80";

const CONDITIONS = [
  { value: "excellent", label: "Çok iyi" },
  { value: "good", label: "İyi" },
  { value: "fair", label: "Orta" },
  { value: "poor", label: "Kullanılmış" },
];

export default function TakasPage() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [oldBrand, setOldBrand] = useState("Beko");
  const [oldModel, setOldModel] = useState("");
  const [oldCondition, setOldCondition] = useState("fair");
  const [desiredProductSku, setDesiredProductSku] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ offeredAmount: number; message: string; id: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
      }),
    [],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await api.retail.createTradeIn({
        customerName,
        phone,
        oldBrand,
        oldModel,
        oldCondition,
        desiredProductSku: desiredProductSku || undefined,
        note: note || undefined,
      });
      setResult({
        id: res.id,
        offeredAmount: res.offeredAmount,
        message: res.message,
      });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Teklif alınamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StorefrontShell>
      <main>
        <section className="adb-page-hero">
          <div className="adb-page-hero-media" style={{ backgroundImage: `url(${HERO})` }} />
          <div className="adb-container adb-page-hero-content adb-animate-in">
            <p className="adb-label-sm" style={{ color: "#93c5fd" }}>
              Beko Değişim & Yenileme
            </p>
            <h1 className="adb-display" style={{ color: "#fff", margin: "8px 0 12px", maxWidth: 640 }}>
              Eski cihazınıza değer biçin, yeni Beko’da peşin indirim kazanın
            </h1>
            <p style={{ color: "rgba(255,255,255,.82)", maxWidth: 520, fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Online ön teklif dakikalar içinde. Kesin tutar mağaza ekspertizi sonrası onaylanır; ücretsiz yetkili servis
              montajı dahil.
            </p>
          </div>
        </section>

        <section className="adb-section">
          <div className="adb-container adb-split-grid" style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.75fr)", alignItems: "start" }}>
            {result ? (
              <div className="adb-card adb-animate-in" style={{ padding: 28 }}>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Ön teklif hazır
                </div>
                <p style={{ fontSize: 36, fontWeight: 800, color: "var(--adb-primary)", margin: "10px 0" }}>
                  {formatTRY(result.offeredAmount)}
                </p>
                <p style={{ color: "var(--adb-muted)", lineHeight: 1.55 }}>{result.message}</p>
                <p style={{ fontSize: 13 }}>Referans: {result.id.slice(0, 8)}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <Button type="button" onClick={() => setResult(null)}>
                    Yeni teklif
                  </Button>
                  <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                    Kampanyalar
                  </Link>
                </div>
              </div>
            ) : (
              <form className="adb-card adb-animate-in" style={{ padding: 24, display: "grid", gap: 12 }} onSubmit={submit}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Takas formu</h2>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
                  <Field label="Ad Soyad">
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  </Field>
                  <Field label="Telefon">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </Field>
                  <Field label="Eski marka">
                    <Input value={oldBrand} onChange={(e) => setOldBrand(e.target.value)} required />
                  </Field>
                  <Field label="Eski model">
                    <Input value={oldModel} onChange={(e) => setOldModel(e.target.value)} required />
                  </Field>
                  <Field label="Durum">
                    <SearchableSelect options={CONDITIONS} value={oldCondition} onChange={setOldCondition} />
                  </Field>
                  <Field label="Hedef ürün SKU (opsiyonel)">
                    <Input value={desiredProductSku} onChange={(e) => setDesiredProductSku(e.target.value)} placeholder="örn. B5RCNE505LXP" />
                  </Field>
                </div>
                <Field label="Not">
                  <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                </Field>
                {msg ? <p style={{ color: "var(--adb-error, #b91c1c)", margin: 0 }}>{msg}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? "Hesaplanıyor…" : "Ön teklif al"}
                </Button>
              </form>
            )}

            <aside className="adb-card adb-animate-in" style={{ padding: 20, background: "linear-gradient(160deg,#f8fbff,#eef4fb)" }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>Nasıl işler?</h3>
              <ol style={{ margin: 0, paddingLeft: 18, color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.7 }}>
                <li>Formu doldurun, anında ön teklif alın</li>
                <li>Mağazada cihaz kontrolü yapılır</li>
                <li>Onaylanan tutar yeni ürün faturasından düşülür</li>
              </ol>
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: "var(--adb-primary)" }}>
                Maks. 15.000 TL değişim desteği
              </div>
            </aside>
          </div>
        </section>

        <section className="adb-section" style={{ background: "#fff" }}>
          <div className="adb-container">
            <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
              Sık sorulanlar
            </div>
            <h2 className="adb-headline-md" style={{ margin: "6px 0 18px", fontFamily: "var(--adb-font-display)" }}>
              Takas hakkında bilmeniz gerekenler
            </h2>
            <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              {[
                ["Ön teklif kesin midir?", "Online tutar tahmini niteliğindedir. Kesin tutar mağaza ekspertizi sonrası onaylanır."],
                ["Cihazımı kim alır?", "Onay sonrası eski cihaz adresinizden veya mağazaya bırakarak alınabilir."],
                ["Hangi ürünler dahil?", "Buzdolabı, çamaşır, bulaşık, klima ve ankastre setlerde geçerli (kampanya koşullarına göre)."],
                ["Montaj dahil mi?", "Yeni ürününüzde ücretsiz yetkili servis montajı standarttır."],
              ].map(([q, a]) => (
                <div key={q} style={{ padding: 18, borderTop: "3px solid var(--adb-primary)", background: "var(--adb-surface)" }}>
                  <strong style={{ display: "block", marginBottom: 8, fontFamily: "var(--adb-font-display)" }}>{q}</strong>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--adb-muted)", lineHeight: 1.55 }}>{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
