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
  deliveryType?: string;
};

function chipKind(status: string): "montage" | "delivered" | "preparing" {
  if (status.includes("MONTAJ") || status.includes("KESIF")) return "montage";
  if (status === "DELIVERED" || status === "MONTAJ_TAMAMLANDI") return "delivered";
  return "preparing";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PAYMENT_PENDING: "Ödeme bekleniyor",
    PAID: "Ödendi",
    PROCESSING: "Hazırlanıyor",
    PACKED: "Paketlendi",
    SHIPPED: "Kargoda",
    DELIVERED: "Teslim edildi",
    MONTAJ_BEKLIYOR: "Montaj bekliyor",
    MONTAJ_RANDEVU: "Montaj randevusu",
    MONTAJ_YOLDA: "Teknisyen yolda",
    MONTAJ_TAMAMLANDI: "Montaj tamam",
    KESIF_BEKLIYOR: "Keşif bekliyor",
    CANCELLED: "İptal",
  };
  return map[status] || status;
}

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
            deliveryType: o.deliveryType ? String(o.deliveryType) : undefined,
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
      const api = createStoreApi();
      const list = await api.accounting.listInvoices().catch(() => ({ items: [] as Array<Record<string, unknown>> }));
      const existing = (list.items || []).find((i) => String(i.orderId) === order.id);
      if (existing?.pdfUrl) {
        window.open(String(existing.pdfUrl), "_blank", "noopener,noreferrer");
        setTone("success");
        setMsg(`Fatura ${String(existing.number || "")} açıldı`);
        return;
      }
      const inv = await api.accounting.createInvoice({
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
        <div className="adb-card adb-animate-in" style={{ padding: 36, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)" }}>
            package_2
          </span>
          <h3 style={{ fontFamily: "var(--adb-font-display)", marginBottom: 8 }}>Henüz siparişiniz yok</h3>
          <p style={{ color: "var(--adb-muted)", maxWidth: 420, margin: "0 auto 18px" }}>
            İlk siparişinizde kargo, montaj randevusu ve fatura takibini buradan yönetirsiniz.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
              Alışverişe başla
            </Link>
            <Link href="/takas" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
              Takas teklifi
            </Link>
          </div>
        </div>
      ) : (
        <div className="adb-stagger" style={{ display: "grid", gap: 12 }}>
          {items.map((o) => (
            <article
              key={o.id}
              className="adb-card adb-animate-in"
              style={{
                padding: 18,
                display: "grid",
                gap: 14,
                borderTop: "3px solid var(--adb-primary)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                    #{o.id.slice(0, 8)}
                    {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString("tr-TR")}` : ""}
                  </div>
                  <h2 style={{ margin: "4px 0 0", fontSize: 17 }}>{o.productName || "Sipariş"}</h2>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                    {[o.district, o.deliveryType, o.montageStatus].filter(Boolean).join(" · ") || "Teslimat bilgisi güncellenecek"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: 18, fontFeatureSettings: '"tnum" 1' }}>{formatTRY(o.total)}</div>
                  <div style={{ marginTop: 8 }}>
                    <StatusChip status={chipKind(o.status)}>{statusLabel(o.status)}</StatusChip>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/hesabim/siparisler/${o.id}`} className="adb-btn adb-btn-primary" style={{ height: 36, textDecoration: "none" }}>
                  Detay & takip
                </Link>
                <Link href="/kargo-takip" className="adb-btn adb-btn-tertiary" style={{ height: 36, textDecoration: "none" }}>
                  Kargo
                </Link>
                <Button
                  type="button"
                  variant="tertiary"
                  style={{ height: 36, fontSize: 13 }}
                  disabled={busyId === o.id || o.total <= 0}
                  onClick={() => openInvoice(o)}
                >
                  {busyId === o.id ? "…" : "Fatura"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
