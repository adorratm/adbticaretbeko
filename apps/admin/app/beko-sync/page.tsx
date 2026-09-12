"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, SearchableSelect, StatusChip } from "@adb/ui";
import { createApiClient } from "@adb/api-client";
import { AdminShell } from "../../components/admin-shell";

type Job = {
  id: string;
  provider: string;
  type: string;
  status: string;
  createdAt?: string;
};

type ProviderRow = {
  provider: string;
  status: string;
  configured: boolean;
  lastSyncOp: string;
};

type Mapping = { id: string; sku: string; provider: string; externalId: string };

export default function BekoSyncPage() {
  const [status, setStatus] = useState<{
    provider: string;
    status: string;
    dealerCode: string;
    configured: boolean;
    lastSyncOp: string;
    providers?: ProviderRow[];
  } | null>(null);
  const [provider, setProvider] = useState("beko-erp");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
        getAccessToken: () =>
          typeof window !== "undefined" ? localStorage.getItem("adb_admin_token") : null,
      }),
    [],
  );

  async function load(selected = provider) {
    try {
      const [s, j, m] = await Promise.all([
        api.marketplace.status(selected),
        api.marketplace.jobs(),
        api.marketplace.mappings(),
      ]);
      setStatus(s);
      setJobs(j.items as unknown as Job[]);
      setMappings(m.items || []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Durum alınamadı");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sync(type: string) {
    setBusy(true);
    try {
      const res = await api.marketplace.sync(type, provider);
      setMsg(`${provider} · ${type} sync tamam${res.externalId ? ` · ${res.externalId}` : ""}`);
      await load(provider);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync hatası");
      await load(provider);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Pazaryeri Sync">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Beko ERP · Trendyol · Hepsiburada stub adapter’ları — env anahtarları ile canlıya bağlanır
      </p>

      <div style={{ marginBottom: 12, maxWidth: 280 }}>
        <SearchableSelect
          options={[
            { value: "beko-erp", label: "Beko ERP" },
            { value: "trendyol", label: "Trendyol" },
            { value: "hepsiburada", label: "Hepsiburada" },
          ]}
          value={provider}
          onChange={(v) => {
            setProvider(v);
            load(v);
          }}
        />
      </div>

      {status ? (
        <div className="adb-card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 6 }}>
          <div>
            Seçili: <strong>{status.provider}</strong>
          </div>
          <div>
            Durum: <StatusChip status="preparing">{status.status}</StatusChip>
          </div>
          <div>Bayi kodu: {status.dealerCode}</div>
          <div>Yapılandırılmış: {status.configured ? "Evet" : "Hayır (stub)"}</div>
          <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>Son ops: {status.lastSyncOp || "—"}</div>
          {status.providers?.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {status.providers.map((p) => (
                <span
                  key={p.provider}
                  className="adb-badge"
                  style={{
                    background: p.provider === provider ? "var(--adb-primary-container)" : "var(--adb-surface-low)",
                    color: p.provider === provider ? "#fff" : "inherit",
                  }}
                >
                  {p.provider}: {p.status}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {["stock", "products", "price", "orders"].map((t) => (
          <Button key={t} type="button" disabled={busy} onClick={() => sync(t)}>
            Sync {t}
          </Button>
        ))}
      </div>
      {msg ? <p style={{ fontSize: 13, color: "var(--adb-primary)" }}>{msg}</p> : null}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="adb-card admin-table-wrap">
          <div style={{ padding: 12, fontWeight: 700, borderBottom: "1px solid var(--adb-border-subtle)" }}>
            Sync job’ları
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>Job</th>
                <th style={{ padding: 12 }}>Provider</th>
                <th style={{ padding: 12 }}>Tip</th>
                <th style={{ padding: 12 }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                  <td style={{ padding: 12 }}>{j.id.slice(0, 8)}</td>
                  <td style={{ padding: 12 }}>{j.provider}</td>
                  <td style={{ padding: 12 }}>{j.type}</td>
                  <td style={{ padding: 12 }}>
                    <StatusChip status={j.status === "DONE" ? "delivered" : j.status === "FAILED" ? "preparing" : "montage"}>
                      {j.status}
                    </StatusChip>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, color: "var(--adb-muted)" }}>
                    Henüz sync job yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="adb-card admin-table-wrap">
          <div style={{ padding: 12, fontWeight: 700, borderBottom: "1px solid var(--adb-border-subtle)" }}>
            Ürün eşlemeleri
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>SKU</th>
                <th style={{ padding: 12 }}>Provider</th>
                <th style={{ padding: 12 }}>External ID</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                  <td style={{ padding: 12 }}>{m.sku}</td>
                  <td style={{ padding: 12 }}>{m.provider}</td>
                  <td style={{ padding: 12, fontSize: 12 }}>{m.externalId}</td>
                </tr>
              ))}
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 24, color: "var(--adb-muted)" }}>
                    Products sync çalıştırınca eşleme oluşur.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
