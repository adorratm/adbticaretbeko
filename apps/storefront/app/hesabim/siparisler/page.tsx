"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, StatusChip } from "@adb/ui";
import { getStoreUser, parseApiError } from "@adb/api-client";
import { AccountShell } from "../../../components/account-shell";
import { createStoreApi, formatTRY } from "../../../lib/store-api";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  productName?: string;
  district?: string;
  createdAt?: string;
  montageStatus?: string;
};

export default function AccountOrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"error" | "success" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const api = createStoreApi();
    const user = getStoreUser();
    api.customers
      .me()
      .catch(() =>
        api.customers.ensure({
          email: user?.email,
          firstName: "Müşteri",
          lastName: "-",
        }),
      )
      .then((profile) => api.orders.list({ customerId: profile.id }))
      .then((res) => {
        setItems(
          (res.items as OrderRow[]).map((o) => ({
            id: String(o.id),
            status: String(o.status),
            total: Number(o.total) || 0,
            productName: o.productName ? String(o.productName) : undefined,
            district: o.district ? String(o.district) : undefined,
            createdAt: o.createdAt ? String(o.createdAt) : undefined,
            montageStatus: o.montageStatus ? String(o.montageStatus) : undefined,
          })),
        );
      })
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, []);

  async function openInvoice(order: OrderRow) {
    setBusyId(order.id);
    setMsg("");
    try {
      const inv = await createStoreApi().accounting.createInvoice({
        orderId: order.id,
        amount: order.total || 1,
        customerName: "Musteri",
      });
      const url = inv.pdfUrl || `/api/v1/accounting/invoices/${inv.id}/pdf`;
      window.open(url, "_blank", "noopener,noreferrer");
      setTone("success");
      setMsg(`Fatura ${inv.number} hazır`);
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AccountShell title="Siparişlerim">
      {msg ? (
        <Alert tone={tone === "success" ? "success" : tone === "error" ? "error" : "info"} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--adb-muted)" }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="adb-card" style={{ padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--adb-muted)" }}>Henüz siparişiniz yok.</p>
          <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
            Alışverişe başla
          </Link>
        </div>
      ) : (
        <div className="adb-card" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>Tarih</th>
                <th style={{ padding: 12 }}>Ürün</th>
                <th style={{ padding: 12 }}>Tutar</th>
                <th style={{ padding: 12 }}>Durum</th>
                <th style={{ padding: 12 }}>Fatura</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString("tr-TR") : "—"}
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{o.productName || "Sipariş"}</div>
                    <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>{o.id.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: 12, fontFeatureSettings: '"tnum" 1' }}>{formatTRY(o.total)}</td>
                  <td style={{ padding: 12 }}>
                    <StatusChip status={String(o.status).includes("MONTAJ") ? "montage" : "preparing"}>
                      {o.status}
                    </StatusChip>
                  </td>
                  <td style={{ padding: 12 }}>
                    <Button
                      type="button"
                      variant="tertiary"
                      style={{ height: 34, fontSize: 12 }}
                      disabled={busyId === o.id || o.total <= 0}
                      onClick={() => openInvoice(o)}
                    >
                      {busyId === o.id ? "…" : "Fatura"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
