"use client";

import { useState } from "react";
import { Alert, Button, Field, Input } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";
import { createStoreApi } from "../../lib/store-api";

type TrackResult = {
  trackingNumber: string;
  status: string;
  orderId: string;
  events?: Array<{ status: string; note: string; at: string }>;
};

export default function KargoTakipPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onTrack(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setResult(null);
    try {
      const api = createStoreApi();
      const res = await api.shipments.track(code.trim());
      setResult(res);
    } catch (err) {
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StorefrontShell>
      <main className="adb-container" style={{ padding: "32px 24px 64px", maxWidth: 720 }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
          Sevkiyat
        </p>
        <h1 style={{ marginTop: 6 }}>Kargo takip</h1>
        <form onSubmit={onTrack} className="adb-card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <Field label="Takip numarası">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TRK-…" required />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Sorgulanıyor…" : "Sorgula"}
          </Button>
        </form>
        {msg ? (
          <Alert tone="error" style={{ marginTop: 12 }}>
            {msg}
          </Alert>
        ) : null}
        {result ? (
          <div className="adb-card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontWeight: 800 }}>{result.trackingNumber}</div>
            <div style={{ color: "var(--adb-muted)", marginTop: 4 }}>
              Durum: <strong>{result.status}</strong> · Sipariş {result.orderId.slice(0, 8)}…
            </div>
            <ul style={{ marginTop: 16, paddingLeft: 18 }}>
              {(result.events || []).map((ev, i) => (
                <li key={`${ev.at}-${i}`} style={{ marginBottom: 8 }}>
                  <strong>{ev.status}</strong> — {ev.note}
                  <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>
                    {new Date(ev.at).toLocaleString("tr-TR")}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </StorefrontShell>
  );
}
