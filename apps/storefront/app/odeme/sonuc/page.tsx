"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { StorefrontShell } from "../../../components/site-shell";
import { createStoreApi } from "../../../lib/store-api";

function ResultInner() {
  const sp = useSearchParams();
  const paymentId = sp.get("paymentId");
  const orderId = sp.get("orderId");
  const ok = !!(orderId || paymentId);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");

  useEffect(() => {
    if (!orderId) return;
    const api = createStoreApi();
    api.accounting
      .listInvoices()
      .then((res) => {
        const hit = (res.items || []).find((i) => i.orderId === orderId);
        if (hit) {
          setInvoiceNo(hit.number);
          setInvoiceUrl(hit.pdfUrl || `/api/v1/accounting/invoices/${hit.id}/pdf`);
          return;
        }
        return api.payments.byOrder(orderId).then((pay) =>
          api.accounting.createInvoice({
            orderId,
            amount: pay.amount || 1,
            customerName: "Musteri",
          }),
        );
      })
      .then((inv) => {
        if (inv && "pdfUrl" in inv) {
          setInvoiceNo(inv.number);
          setInvoiceUrl(inv.pdfUrl || `/api/v1/accounting/invoices/${inv.id}/pdf`);
        }
      })
      .catch(() => undefined);
  }, [orderId]);

  return (
    <StorefrontShell>
      <main style={{ maxWidth: 560, margin: "48px auto", padding: "0 24px 64px" }}>
        <div className="adb-card" style={{ padding: 28, textAlign: "center" }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 48, color: ok ? "#065f46" : "var(--adb-primary)" }}
          >
            {ok ? "check_circle" : "receipt_long"}
          </span>
          <h1 style={{ marginTop: 12 }}>{ok ? "Ödeme sonucu" : "Ödeme"}</h1>
          <p style={{ color: "var(--adb-muted)" }}>
            {ok
              ? "Siparişiniz alındı. Montaj ve sevk süreci için hesabınızdan takip edebilirsiniz."
              : "PSP dönüşü (mock). Gerçek ortamda webhook siparişi PAID yapar."}
          </p>
          {orderId ? (
            <p>
              Sipariş: <code>{orderId}</code>
            </p>
          ) : null}
          {paymentId ? (
            <p>
              Ödeme: <code>{paymentId}</code>
            </p>
          ) : null}
          {invoiceUrl ? (
            <p style={{ fontSize: 14 }}>
              Fatura {invoiceNo ? <strong>{invoiceNo}</strong> : null} hazır —{" "}
              <a href={invoiceUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
                PDF görüntüle
              </a>
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            <Link href="/hesabim/siparisler" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
              Siparişlerim
            </Link>
            <Link href="/" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
              Mağazaya dön
            </Link>
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}

export default function OdemeSonucPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor...</div>}>
      <ResultInner />
    </Suspense>
  );
}
