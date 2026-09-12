"use client";

import { useEffect, useState } from "react";
import { Alert, Button, EmptyState } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Invoice = {
  id: string;
  orderId: string;
  number: string;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  netAmount?: number;
  taxNo?: string;
  status: string;
  eInvoiceStatus?: string;
  eInvoiceUuid?: string;
  pdfUrl: string;
  customerName?: string;
};

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function MuhasebePage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);

  async function load() {
    const api = createAdminApi();
    const res = await api.accounting.listInvoices();
    setItems(res.items as Invoice[]);
  }

  useEffect(() => {
    load()
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell title="Muhasebe / Faturalar">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        E-fatura stub — KDV ayrımı + UUID hazır; gerçek GİB entegrasyonu `EINVOICE_PROVIDER` ile bağlanır
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div className="adb-card" style={{ overflow: "hidden" }}>
        <div className="admin-table-wrap">
          {loading ? (
            <EmptyState title="Yükleniyor…" />
          ) : items.length === 0 ? (
            <EmptyState
              title="Fatura yok"
              description="Checkout smoke veya ödeme sonrası fatura oluşturulduğunda burada listelenir."
            />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>No</th>
                  <th style={{ padding: 12 }}>Sipariş</th>
                  <th style={{ padding: 12 }}>Net / KDV</th>
                  <th style={{ padding: 12 }}>Toplam</th>
                  <th style={{ padding: 12 }}>e-Fatura</th>
                  <th style={{ padding: 12 }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{inv.number}</td>
                    <td style={{ padding: 12 }}>{inv.orderId.slice(0, 8)}…</td>
                    <td style={{ padding: 12, fontSize: 12 }}>
                      {formatTRY(inv.netAmount ?? Math.round(inv.amount / 1.2))}
                      <br />
                      <span style={{ color: "var(--adb-muted)" }}>
                        KDV %{inv.taxRate ?? 20}: {formatTRY(inv.taxAmount ?? inv.amount - Math.round(inv.amount / 1.2))}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>{formatTRY(inv.amount)}</td>
                    <td style={{ padding: 12, fontSize: 12 }}>
                      {inv.eInvoiceStatus || inv.status}
                      {inv.eInvoiceUuid ? (
                        <>
                          <br />
                          <code style={{ fontSize: 10 }}>{inv.eInvoiceUuid.slice(0, 12)}…</code>
                        </>
                      ) : null}
                    </td>
                    <td style={{ padding: 12 }}>
                      <a href={inv.pdfUrl || `/api/v1/accounting/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }}>
                          Görüntüle
                        </Button>
                      </a>
                    </td>
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
