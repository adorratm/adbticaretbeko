"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, SearchableSelect, TextArea } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";

type Bundle = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  items: Array<{ sku: string; name: string; qty: number }>;
};

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

const HERO =
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80";

export default function CeyizPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [packageId, setPackageId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
      }),
    [],
  );

  useEffect(() => {
    api.retail
      .bundles()
      .then((r) => {
        setBundles(r.items as Bundle[]);
        if (r.items[0]) setPackageId(r.items[0].id);
      })
      .catch(() => setMsg("Paketler yüklenemedi"));
  }, [api]);

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api.retail.reserveStorage({
        customerName,
        phone,
        packageId: packageId || undefined,
        startDate,
        endDate,
        note: note || undefined,
      });
      setMsg("Ücretsiz depolama rezervasyonunuz alındı. Mağaza sizi arayacak.");
      setCustomerName("");
      setPhone("");
      setNote("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Rezervasyon başarısız");
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
            <p className="adb-label-sm" style={{ color: "#fcd34d" }}>
              Çeyiz & Fırsat
            </p>
            <h1 className="adb-display" style={{ color: "#fff", margin: "8px 0 12px", maxWidth: 640 }}>
              Hazır setler, ücretsiz depolama
            </h1>
            <p style={{ color: "rgba(255,255,255,.85)", maxWidth: 520, fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Düğün tarihine kadar ürünleriniz ADB deposunda güvende. Montaj günü yetkili servisle teslim.
            </p>
          </div>
        </section>

        <section className="adb-section">
          <div className="adb-container">
            <div className="adb-stagger" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", marginBottom: 28 }}>
              {bundles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="adb-card adb-cat-tile"
                  onClick={() => setPackageId(b.id)}
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    borderColor: packageId === b.id ? "var(--adb-primary-container)" : undefined,
                    boxShadow: packageId === b.id ? "0 0 0 2px rgba(0,86,179,.15)" : undefined,
                  }}
                >
                  <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                    {b.code}
                  </div>
                  <h2 style={{ margin: "8px 0 6px", fontSize: 18 }}>{b.name}</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--adb-muted)", lineHeight: 1.5 }}>{b.description}</p>
                  <div style={{ marginTop: 12, fontWeight: 800, fontSize: 20, color: "var(--adb-primary)" }}>{formatTRY(b.price)}</div>
                  <ul style={{ margin: "10px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--adb-muted)" }}>
                    {(b.items || []).slice(0, 4).map((it) => (
                      <li key={`${b.id}-${it.sku}`}>
                        {it.name} ×{it.qty}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <form className="adb-card" style={{ padding: 24, display: "grid", gap: 12, maxWidth: 720 }} onSubmit={reserve}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Ücretsiz depolama rezervasyonu</h2>
              <Field label="Paket">
                <SearchableSelect
                  options={bundles.map((b) => ({ value: b.id, label: `${b.name} · ${formatTRY(b.price)}` }))}
                  value={packageId}
                  onChange={setPackageId}
                  placeholder="Paket seçin"
                />
              </Field>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
                <Field label="Ad Soyad">
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </Field>
                <Field label="Telefon">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </Field>
                <Field label="Başlangıç">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </Field>
                <Field label="Bitiş / düğün">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </Field>
              </div>
              <Field label="Not">
                <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </Field>
              {msg ? (
                <p style={{ margin: 0, color: msg.includes("alındı") ? "var(--adb-primary)" : "var(--adb-error,#b91c1c)" }}>{msg}</p>
              ) : null}
              <Button type="submit" disabled={busy}>
                {busy ? "Gönderiliyor…" : "Rezervasyon oluştur"}
              </Button>
            </form>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
