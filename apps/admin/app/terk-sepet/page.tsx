"use client";

import { useEffect, useState } from "react";
import { Alert, Button, EmptyState } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Abandoned = {
  cartId: string;
  customerId?: string;
  itemCount: number;
  updatedAt: string;
  idleHours: number;
};

export default function TerkSepetPage() {
  const [items, setItems] = useState<Abandoned[]>([]);
  const [idleHours, setIdleHours] = useState(24);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await createAdminApi().worker.listAbandonedCarts(idleHours);
    setItems(res.items);
    setIdleHours(res.idleHours);
  }

  useEffect(() => {
    load()
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runReminders() {
    setBusy(true);
    try {
      const res = await createAdminApi().worker.runAbandonedCarts();
      setTone("success");
      setMsg(`Hatırlatma çalıştı: ${res.reminded}/${res.checked} sepet`);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Terk Edilen Sepetler">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        {idleHours}+ saattir güncellenmeyen, ürün içeren sepetler — hatırlatma e-postası tetiklenebilir
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Button type="button" onClick={() => load().catch((e) => setMsg(parseApiError(e)))}>
          Yenile
        </Button>
        <Button type="button" disabled={busy} onClick={runReminders}>
          {busy ? "Çalışıyor…" : "Hatırlatmaları çalıştır"}
        </Button>
      </div>
      <div className="adb-card" style={{ overflow: "hidden" }}>
        <div className="admin-table-wrap">
          {loading ? (
            <EmptyState title="Yükleniyor…" />
          ) : items.length === 0 ? (
            <EmptyState
              title="Terk sepet yok"
              description="Misafir sepete ürün ekleyip 24 saat bekleyince burada görünür (dev’de idleHours düşürülebilir)."
            />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
              <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>Sepet</th>
                  <th style={{ padding: 12 }}>Müşteri</th>
                  <th style={{ padding: 12 }}>Kalem</th>
                  <th style={{ padding: 12 }}>Boşta (saat)</th>
                  <th style={{ padding: 12 }}>Son güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.cartId} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                    <td style={{ padding: 12, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{c.cartId}</td>
                    <td style={{ padding: 12 }}>{c.customerId || "misafir"}</td>
                    <td style={{ padding: 12 }}>{c.itemCount}</td>
                    <td style={{ padding: 12 }}>{c.idleHours}</td>
                    <td style={{ padding: 12 }}>{new Date(c.updatedAt).toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
