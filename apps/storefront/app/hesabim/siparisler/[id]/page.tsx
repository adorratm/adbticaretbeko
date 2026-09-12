"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, EmptyState, StatusChip } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AccountShell } from "../../../../components/account-shell";
import { createStoreApi, formatTRY } from "../../../../lib/store-api";

const FLOW = [
  { key: "PAID", label: "Ödeme" },
  { key: "PROCESSING", label: "Hazırlık" },
  { key: "SHIPPED", label: "Kargo" },
  { key: "MONTAJ", label: "Montaj" },
  { key: "DONE", label: "Tamam" },
];

function flowIndex(status: string) {
  if (status === "CANCELLED") return -1;
  if (status === "PAYMENT_PENDING") return 0;
  if (status === "PAID" || status === "PROCESSING" || status === "PACKED") return status === "PAID" ? 1 : 2;
  if (status === "SHIPPED" || status === "DELIVERED") return 3;
  if (status.includes("MONTAJ") || status.includes("KESIF")) {
    if (status === "MONTAJ_TAMAMLANDI") return 5;
    return 4;
  }
  if (status === "DELIVERED") return 5;
  return 1;
}

export default function AccountOrderDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const api = useMemo(() => createStoreApi(), []);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [shipment, setShipment] = useState<Record<string, unknown> | null>(null);
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.orders.get(id),
      api.shipments.byOrder(id).catch(() => null),
      api.accounting.listInvoices().catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    ])
      .then(([d, ship, inv]) => {
        if (cancelled) return;
        setDetail(d);
        setShipment(ship as Record<string, unknown> | null);
        const match = (inv.items || []).find((i) => String(i.orderId) === id) || null;
        setInvoice(match);
      })
      .catch((e) => {
        if (!cancelled) setMsg(parseApiError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  async function ensureInvoice() {
    if (!detail) return;
    setBusy(true);
    try {
      if (invoice?.pdfUrl) {
        window.open(String(invoice.pdfUrl), "_blank", "noopener,noreferrer");
        return;
      }
      const inv = await api.accounting.createInvoice({
        orderId: id,
        amount: Number(detail.total) || 1,
        customerName: String(detail.customerName || "Musteri"),
      });
      setInvoice(inv as unknown as Record<string, unknown>);
      const url = inv.pdfUrl || `/api/v1/accounting/invoices/${inv.id}/pdf`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const status = String(detail?.status || "");
  const idx = flowIndex(status);
  const ship = (detail?.shippingAddress || {}) as Record<string, unknown>;
  const items = Array.isArray(detail?.items) ? (detail!.items as Array<Record<string, unknown>>) : [];
  const history = Array.isArray(detail?.history) ? (detail!.history as Array<Record<string, unknown>>) : [];

  return (
    <AccountShell title="Sipariş detayı">
      <div style={{ marginBottom: 12 }}>
        <Link href="/hesabim/siparisler" style={{ fontSize: 13, color: "var(--adb-primary)", fontWeight: 600 }}>
          ← Siparişlerim
        </Link>
      </div>

      {msg ? (
        <Alert tone="error" style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      {loading ? (
        <EmptyState title="Yükleniyor…" />
      ) : !detail ? (
        <EmptyState title="Sipariş bulunamadı" description="Listeye dönüp tekrar deneyin." />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <section
            className="adb-card"
            style={{
              padding: 18,
              background: "linear-gradient(145deg, rgba(0,86,179,0.07), transparent 50%), #fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                  Sipariş #{id.slice(0, 8)}
                </div>
                <h2 style={{ margin: "4px 0 8px", fontSize: 22 }}>{formatTRY(Number(detail.total || 0))}</h2>
                <StatusChip status={status.includes("MONTAJ") ? "montage" : status === "DELIVERED" ? "delivered" : "preparing"}>
                  {status}
                </StatusChip>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <Button type="button" variant="tertiary" style={{ height: 36 }} disabled={busy} onClick={ensureInvoice}>
                  {invoice ? "Faturayı aç" : "Fatura oluştur"}
                </Button>
                {shipment?.trackingNumber ? (
                  <Link
                    href={`/kargo-takip?code=${encodeURIComponent(String(shipment.trackingNumber))}`}
                    className="adb-btn adb-btn-primary"
                    style={{ height: 36, textDecoration: "none" }}
                  >
                    Kargo takip
                  </Link>
                ) : (
                  <Link href="/kargo-takip" className="adb-btn adb-btn-tertiary" style={{ height: 36, textDecoration: "none" }}>
                    Kargo takip
                  </Link>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 0, marginTop: 22, overflowX: "auto", paddingBottom: 4 }}>
              {FLOW.map((step, i) => {
                const done = idx > i;
                const current = idx === i || (i === 3 && idx === 4);
                return (
                  <div key={step.key} style={{ flex: "1 0 72px", minWidth: 72, textAlign: "center" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        margin: "0 auto 8px",
                        background: done || current ? "var(--adb-primary)" : "var(--adb-surface-low)",
                        color: done || current ? "#fff" : "var(--adb-muted)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: current ? "var(--adb-primary)" : "var(--adb-muted)" }}>
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <section className="adb-card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--adb-primary)" }}>TESLİMAT</h3>
              <p style={{ margin: 0, fontWeight: 700 }}>{String(detail.customerName || ship.name || "—")}</p>
              <p style={{ margin: "6px 0 0", fontSize: 13 }}>{String(detail.customerPhone || ship.phone || "—")}</p>
              <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--adb-muted)" }}>
                {String(ship.line1 || detail.addressLine || "Adres kaydı yok")}
                <br />
                {[ship.district || detail.district, ship.city || detail.city].filter(Boolean).join(" / ") || "—"}
              </p>
            </section>

            <section className="adb-card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--adb-primary)" }}>MONTAJ / SERVİS</h3>
              <p style={{ margin: 0, fontSize: 13 }}>
                Durum: <strong>{String(detail.montageStatus || "—")}</strong>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                Servis ref: <strong>{String(detail.serviceRef || "Atanmadı")}</strong>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                Teslimat tipi: {String(detail.deliveryType || "—")}
              </p>
              {detail.montageNote ? (
                <p style={{ margin: "10px 0 0", fontSize: 13 }}>{String(detail.montageNote)}</p>
              ) : null}
            </section>

            <section className="adb-card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--adb-primary)" }}>KARGO</h3>
              {shipment ? (
                <>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Takip: <strong>{String(shipment.trackingNumber || "—")}</strong>
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>Durum: {String(shipment.status || "—")}</p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--adb-muted)" }}>Kargo henüz oluşturulmadı.</p>
              )}
            </section>
          </div>

          <section className="adb-card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--adb-primary)" }}>KALEMLER</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {items.length === 0 ? (
                <span style={{ color: "var(--adb-muted)", fontSize: 13 }}>Kalem yok</span>
              ) : (
                items.map((it) => (
                  <div
                    key={String(it.id)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "var(--adb-surface-low)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 650 }}>{String(it.name || "Ürün")}</div>
                      <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>
                        {String(it.sku || "")} · x{Number(it.qty || 1)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{formatTRY(Number(it.unitPrice || 0) * Number(it.qty || 1))}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          {history.length > 0 ? (
            <section className="adb-card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--adb-primary)" }}>DURUM GEÇMİŞİ</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--adb-muted)", lineHeight: 1.8 }}>
                {history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    {String(h.from || "—")} → <strong>{String(h.to)}</strong>
                    {h.note ? ` (${String(h.note)})` : ""} · {h.at ? new Date(String(h.at)).toLocaleString("tr-TR") : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </AccountShell>
  );
}
