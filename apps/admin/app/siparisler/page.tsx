"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  RouteCard,
  SectionHeader,
  SearchableSelect,
  StatusChip,
} from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";
import { useAdminBranch } from "../../components/admin-branch";

type OrderRow = {
  id: string;
  status: string;
  total: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  district: string;
  city?: string;
  deliveryType: string;
  montageStatus: string;
  serviceRef: string;
  paymentMethod: string;
  productName: string;
  createdAt: string;
};

type ServiceRoute = {
  id: string;
  teamId: string;
  warehouseCode: string;
  title: string;
  districtHint: string;
  plannedStops: number;
  doneStops: number;
  nextStop: string;
  status: string;
  teamName: string;
  technician: string;
  vehiclePlate: string;
  tone: "success" | "warn" | "danger";
};

const pipelines = [
  { key: "ALL", label: "Tüm Siparişler", accent: "#0056b3", hint: "Bugün +18" },
  { key: "PAYMENT_PENDING", label: "Onay Bekleyen", accent: "#115cb9", hint: "Ödeme" },
  { key: "MONTAJ_RANDEVU", label: "Servis Randevusu", accent: "#a62c00", hint: "4 ekip aktif" },
  { key: "MONTAJ_YOLDA", label: "Yolda / Dağıtım", accent: "#d97706", hint: "Canlı rota" },
  { key: "MONTAJ_TAMAMLANDI", label: "Montajı Tamamlanan", accent: "#059669", hint: "%98.4 memnuniyet" },
];

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function maskPhone(p: string) {
  if (!p || p.length < 7) return p || "—";
  return p.slice(0, 3) + " *** " + p.slice(-2);
}

export default function SiparislerPage() {
  const { branchCode, branch, matchesOrder } = useAdminBranch();
  const [filter, setFilter] = useState("ALL");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; body: string; title?: string }>>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("ALL");
  const [montageType, setMontageType] = useState("ALL");
  const [smsOrderId, setSmsOrderId] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("order.montage_scheduled");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPayment, setDetailPayment] = useState<Record<string, unknown> | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Record<string, unknown> | null>(null);
  const [detailShipment, setDetailShipment] = useState<Record<string, unknown> | null>(null);
  const [shipments, setShipments] = useState<
    Record<string, { id: string; trackingNumber: string; status: string }>
  >({});
  const [routes, setRoutes] = useState<ServiceRoute[]>([]);
  const [teamCount, setTeamCount] = useState(0);

  const api = useMemo(() => createAdminApi(), []);

  async function loadService() {
    try {
      const [t, r] = await Promise.all([
        api.serviceTeams.list(branchCode),
        api.serviceRoutes.list(branchCode),
      ]);
      setTeamCount((t.items || []).length);
      setRoutes((r.items || []).filter((x) => x.status !== "DONE").slice(0, 4));
    } catch {
      /* ignore sidebar errors */
    }
  }

  async function load() {
    try {
      const res = await api.orders.list(
        filter === "ALL" ? undefined : { status: filter },
      );
      const rows = res.items as unknown as OrderRow[];
      setItems(rows);
      setCounts(res.counts || {});
      const map: Record<string, { id: string; trackingNumber: string; status: string }> = {};
      await Promise.all(
        rows.slice(0, 40).map(async (o) => {
          try {
            const s = await api.shipments.byOrder(o.id);
            map[o.id] = { id: s.id, trackingNumber: s.trackingNumber, status: s.status };
          } catch {
            /* no shipment */
          }
        }),
      );
      setShipments(map);
    } catch (e) {
      setMsg(parseApiError(e));
    }
  }

  useEffect(() => {
    load();
    api.notifications.templates().then((t) => setTemplates(t.items)).catch(() => undefined);
  }, [filter]);

  useEffect(() => {
    loadService();
  }, [branchCode]);

  useEffect(() => {
    setDistrict("ALL");
  }, [branchCode]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailPayment(null);
      setDetailInvoice(null);
      setDetailShipment(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      api.orders.get(selectedId),
      api.payments.byOrder(selectedId).catch(() => null),
      api.shipments.byOrder(selectedId).catch(() => null),
      api.accounting.listInvoices().catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    ])
      .then(([d, pay, ship, inv]) => {
        if (cancelled) return;
        setDetail(d);
        setDetailPayment(pay as Record<string, unknown> | null);
        setDetailShipment(ship as Record<string, unknown> | null);
        const match = (inv.items || []).find((i) => String(i.orderId) === selectedId) || null;
        setDetailInvoice(match as Record<string, unknown> | null);
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null);
          setMsg(parseApiError(e));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, api]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedId]);

  async function setStatus(id: string, status: string, extra?: Record<string, string>) {
    setBusy(id);
    try {
      await api.orders.updateStatus(id, { status, ...extra });
      setMsg(`${id.slice(0, 8)} → ${status}`);
      await load();
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function sendSMS(orderId: string, template: string) {
    try {
      await api.notifications.send({ template, channel: "sms", data: { orderId } });
      setMsg(`SMS şablonu tetiklendi: ${template}`);
    } catch (e) {
      setMsg(parseApiError(e));
    }
  }

  async function markPaidDev(orderId: string) {
    try {
      const pay = await api.payments.byOrder(orderId);
      await api.payments.simulateSuccess(pay.id);
      setMsg("Ödeme simüle edildi (dev)");
      await load();
    } catch (e) {
      setMsg(parseApiError(e));
    }
  }

  async function createShipment(orderId: string) {
    setBusy(orderId);
    try {
      const s = await api.shipments.create({ orderId });
      setMsg(`Kargo oluşturuldu: ${s.trackingNumber}`);
      await load();
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function advanceShipment(orderId: string, status: string) {
    const s = shipments[orderId];
    if (!s) return;
    setBusy(orderId);
    try {
      await api.shipments.updateStatus(s.id, status);
      setMsg(`${s.trackingNumber} → ${status}`);
      await load();
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(totalAll, 1);

  const branchItems = items.filter((o) => matchesOrder({ city: o.city, district: o.district }));

  const filtered = branchItems.filter((o) => {
    const hay = `${o.id} ${o.customerName} ${o.productName} ${o.district} ${o.city || ""}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (district !== "ALL" && (o.district || "").toLowerCase() !== district.toLowerCase()) return false;
    if (montageType === "DISCOVERY" && !(o.montageStatus || "").toLowerCase().includes("kesif") && o.status !== "KESIF_BEKLIYOR")
      return false;
    if (montageType === "FREE" && (o.status === "KESIF_BEKLIYOR" || (o.montageStatus || "").toLowerCase().includes("kesif")))
      return false;
    return true;
  });

  const districts = Array.from(new Set(branchItems.map((o) => o.district).filter(Boolean)));

  return (
    <AdminShell title="Siparişler & Montaj">
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Sipariş & Yetkili Servis Montaj Takip</h2>
          <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 13 }}>
            Aktif şube: {branch?.name || branchCode}
            {branch?.city ? ` · ${branch.city}` : ""} · Siparişler ve servis rotaları şubeye göre
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/servis-ekipleri" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
            Servis Ekipleri
          </Link>
          <Link href="/servis-rotalari" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
            Servis Rotaları
          </Link>
          <Button
            type="button"
            variant="tertiary"
            style={{ height: 40 }}
            onClick={() => {
              const rows = [
                ["id", "status", "customer", "phone", "product", "total", "district", "createdAt"],
                ...filtered.map((o) => [
                  o.id,
                  o.status,
                  o.customerName,
                  o.customerPhone,
                  o.productName,
                  String(o.total),
                  o.district,
                  o.createdAt,
                ]),
              ];
              const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
              const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `siparisler-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              setMsg("CSV indirildi");
            }}
          >
            Excel (CSV)
          </Button>
          <Button
            type="button"
            variant="tertiary"
            style={{ height: 40 }}
            onClick={() => {
              if (filtered.length === 0) {
                setMsg("Yazdırılacak sipariş yok");
                return;
              }
              const rows = filtered
                .map(
                  (o) => `
<tr>
  <td>${o.id.slice(0, 8)}</td>
  <td>${o.customerName || "-"}<br/><small>${o.customerPhone || ""}</small></td>
  <td>${o.productName || "-"}</td>
  <td>${o.district || "-"}</td>
  <td>${o.status}<br/><small>${o.montageStatus || ""}</small></td>
  <td>${o.serviceRef || ""}</td>
</tr>`,
                )
                .join("");
              const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Toplu Servis Fişi</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}
.meta{color:#666;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #ccc;padding:8px;vertical-align:top}
th{background:#f3f3f3;text-align:left}
.foot{margin-top:24px;font-size:11px;color:#666}
@media print{.no-print{display:none}}
</style></head><body>
<h1>ADB Ticaret Beko — Toplu Servis / Montaj Fişi</h1>
<div class="meta">${new Date().toLocaleString("tr-TR")} · ${filtered.length} sipariş · Filtre: ${filter}</div>
<table>
<thead><tr><th>Sipariş</th><th>Müşteri</th><th>Ürün</th><th>İlçe</th><th>Durum</th><th>Servis Ref</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="foot">Yetkili servis sahada bu fişi kullanır. İmza / teslim notu için boş alan bırakın.</p>
<button class="no-print" onclick="window.print()">Yazdır</button>
</body></html>`;
              const w = window.open("", "_blank");
              if (!w) {
                setMsg("Popup engellendi — yazdırma penceresi açılamadı");
                return;
              }
              w.document.write(html);
              w.document.close();
              setMsg("Servis fişi açıldı");
            }}
          >
            Toplu Servis Fişi
          </Button>
          <Button type="button" style={{ height: 40 }} onClick={() => setMsg("Yeni sipariş storefront checkout ile oluşur")}>
            Yeni Sipariş
          </Button>
        </div>
      </div>

      <div className="adb-stagger" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 16 }}>
        {pipelines.map((p) => {
          const value = p.key === "ALL" ? totalAll : counts[p.key] || 0;
          const pct = Math.round((value / maxCount) * 100);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              className="adb-card"
              style={{
                padding: 14,
                textAlign: "left",
                cursor: "pointer",
                borderColor: filter === p.key ? "var(--adb-primary-container)" : undefined,
                boxShadow: filter === p.key ? "0 0 0 2px rgba(0,86,179,0.12)" : undefined,
              }}
            >
              <div className="adb-label-sm" style={{ color: "var(--adb-muted)" }}>
                {p.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{value}</div>
              <ProgressBar value={pct} className="adb-animate-fade" style={{ marginTop: 10 }} />
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: p.accent }}>{p.hint}</div>
            </button>
          );
        })}
      </div>

      <div
        className="adb-card"
        style={{
          padding: 12,
          marginBottom: 16,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "minmax(180px, 1.4fr) repeat(auto-fit, minmax(140px, 0.7fr))",
          alignItems: "end",
        }}
      >
        <Field label="Ara">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sipariş, müşteri, model…" />
        </Field>
        <Field label="İlçe">
          <SearchableSelect
            options={[
              { value: "ALL", label: "Tümü" },
              ...districts.map((d) => ({ value: d, label: d })),
            ]}
            value={district}
            onChange={setDistrict}
            searchPlaceholder="İlçe ara…"
          />
        </Field>
        <Field label="Montaj türü">
          <SearchableSelect
            options={[
              { value: "ALL", label: "Tümü" },
              { value: "FREE", label: "Ücretsiz montaj" },
              { value: "DISCOVERY", label: "Keşif gerekli" },
            ]}
            value={montageType}
            onChange={setMontageType}
          />
        </Field>
      </div>

      <div className="admin-split-wide">
        <div className="adb-card admin-table-wrap">
          {filtered.length === 0 ? (
            <EmptyState title="Kayıt yok" description="Filtreleri temizleyin veya storefront’tan checkout ile sipariş oluşturun." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
              <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>Sipariş</th>
                  <th style={{ padding: 12 }}>Müşteri</th>
                  <th style={{ padding: 12 }}>Ürün</th>
                  <th style={{ padding: 12 }}>Tutar</th>
                  <th style={{ padding: 12 }}>Montaj</th>
                  <th style={{ padding: 12 }}>İlçe</th>
                  <th style={{ padding: 12 }}>Eylemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800, color: "var(--adb-primary)" }}>#{o.id.slice(0, 8)}</div>
                      <div style={{ color: "var(--adb-muted)", fontSize: 12 }}>{o.createdAt}</div>
                      <div style={{ marginTop: 6 }}>
                        {o.status.includes("MONTAJ") ? (
                          <StatusChip status="montage">{o.status}</StatusChip>
                        ) : o.status === "DELIVERED" || o.status === "MONTAJ_TAMAMLANDI" ? (
                          <StatusChip status="delivered">{o.status}</StatusChip>
                        ) : (
                          <StatusChip status="preparing">{o.status}</StatusChip>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>{o.customerName || "—"}</div>
                      <div style={{ color: "var(--adb-muted)" }}>{maskPhone(o.customerPhone)}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{o.productName || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>{o.deliveryType || "Standart"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 800, fontFeatureSettings: '"tnum" 1' }}>{formatTRY(o.total)}</div>
                      <div style={{ color: "var(--adb-muted)", fontSize: 11 }}>{o.paymentMethod || "—"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div>{o.montageStatus || "—"}</div>
                      <div style={{ color: "var(--adb-muted)", fontSize: 11 }}>{o.serviceRef || "Ekip atanmadı"}</div>
                    </td>
                    <td style={{ padding: 12 }}>{o.district || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Button
                          type="button"
                          variant="secondary"
                          style={{ height: 34, fontSize: 12 }}
                          onClick={() => {
                            setSelectedId(o.id);
                            setSmsOrderId(o.id);
                          }}
                        >
                          Detay
                        </Button>
                        {o.status === "PAYMENT_PENDING" ? (
                          <Button type="button" variant="tertiary" disabled={busy === o.id} onClick={() => markPaidDev(o.id)} style={{ height: 34, fontSize: 12 }}>
                            Ödemeyi Simüle Et
                          </Button>
                        ) : null}
                        {o.status === "PAID" ? (
                          <Button type="button" style={{ height: 34, fontSize: 12 }} disabled={busy === o.id} onClick={() => setStatus(o.id, "PROCESSING")}>
                            İşleme Al
                          </Button>
                        ) : null}
                        {o.status === "PROCESSING" || o.status === "PACKED" ? (
                          <Button
                            type="button"
                            style={{ height: 34, fontSize: 12 }}
                            disabled={busy === o.id}
                            onClick={() => setStatus(o.id, "MONTAJ_BEKLIYOR", { montageStatus: "Montaj Bekliyor" })}
                          >
                            Montaja Aktar
                          </Button>
                        ) : null}
                        {o.status === "MONTAJ_BEKLIYOR" || o.status === "KESIF_BEKLIYOR" ? (
                          <Button
                            type="button"
                            style={{ height: 34, fontSize: 12 }}
                            disabled={busy === o.id}
                            onClick={() =>
                              setStatus(o.id, "MONTAJ_RANDEVU", {
                                montageStatus: "Randevu Verildi",
                                serviceRef: `SRV-${o.id.slice(0, 4).toUpperCase()}`,
                              })
                            }
                          >
                            Randevu Ver
                          </Button>
                        ) : null}
                        {o.status === "MONTAJ_RANDEVU" ? (
                          <Button type="button" style={{ height: 34, fontSize: 12 }} disabled={busy === o.id} onClick={() => setStatus(o.id, "MONTAJ_YOLDA", { montageStatus: "Yolda" })}>
                            Yola Çıktı
                          </Button>
                        ) : null}
                        {o.status === "MONTAJ_YOLDA" ? (
                          <Button
                            type="button"
                            style={{ height: 34, fontSize: 12 }}
                            disabled={busy === o.id}
                            onClick={() => setStatus(o.id, "MONTAJ_TAMAMLANDI", { montageStatus: "Tamamlandı" })}
                          >
                            Montaj Tamam
                          </Button>
                        ) : null}
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => sendSMS(o.id, "order.montage_scheduled")}>
                          SMS: Randevu
                        </Button>
                        {shipments[o.id] ? (
                          (() => {
                            const ship = shipments[o.id]!;
                            return (
                          <>
                            <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>
                              {ship.trackingNumber} · {ship.status}
                            </div>
                            {ship.status === "CREATED" ? (
                              <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} disabled={busy === o.id} onClick={() => advanceShipment(o.id, "IN_TRANSIT")}>
                                Kargo: Yolda
                              </Button>
                            ) : null}
                            {ship.status === "IN_TRANSIT" ? (
                              <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} disabled={busy === o.id} onClick={() => advanceShipment(o.id, "DELIVERED")}>
                                Kargo: Teslim
                              </Button>
                            ) : null}
                          </>
                            );
                          })()
                        ) : o.status !== "PAYMENT_PENDING" ? (
                          <Button type="button" variant="secondary" style={{ height: 34, fontSize: 12 }} disabled={busy === o.id} onClick={() => createShipment(o.id)}>
                            Kargo oluştur
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="admin-tools-aside">
          <div className="adb-card" style={{ padding: 14 }}>
            <SectionHeader
              icon="alt_route"
              title="Aktif servis rotaları"
              action={
                <span className="adb-badge adb-badge-service" style={{ textTransform: "none", letterSpacing: 0 }}>
                  {branch?.name || branchCode}
                </span>
              }
            />
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--adb-muted)" }}>
              {teamCount} ekip · yönetim ayrı modüllerde
            </p>
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {routes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>Bu şubede aktif rota yok.</p>
              ) : (
                routes.map((r) => (
                  <RouteCard
                    key={r.id}
                    title={r.title}
                    progress={`${r.doneStops}/${r.plannedStops || 0} Montaj`}
                    tech={`Teknisyen: ${r.technician || r.teamName || "—"}${r.vehiclePlate ? ` (${r.vehiclePlate})` : ""}`}
                    nextStop={r.nextStop ? `Sıradaki: ${r.nextStop}` : r.districtHint || "Durak yok"}
                    tone={r.tone || "success"}
                  />
                ))
              )}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <Link href="/servis-ekipleri" className="adb-btn adb-btn-tertiary" style={{ height: 36, justifyContent: "center" }}>
                Servis ekipleri
              </Link>
              <Link href="/servis-rotalari" className="adb-btn adb-btn-primary" style={{ height: 36, justifyContent: "center" }}>
                Servis rotaları
              </Link>
            </div>
          </div>

          <div className="adb-card" style={{ padding: 14 }}>
            <SectionHeader icon="sms" title="Bildirim gönder" />
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Sipariş seç">
                <SearchableSelect
                  options={[
                    { value: "", label: "Listeden seçin…" },
                    ...filtered.map((o) => ({
                      value: o.id,
                      label: `${o.id.slice(0, 8)} · ${o.customerName || "Müşteri"} · ${o.productName || "Ürün"}`,
                      searchText: `${o.id} ${o.customerName} ${o.productName} ${o.customerPhone}`,
                    })),
                  ]}
                  value={smsOrderId}
                  onChange={setSmsOrderId}
                  searchPlaceholder="Sipariş ara…"
                  clearable
                />
              </Field>
              <Field label="veya ara / yapıştır">
                <Input
                  value={smsOrderId}
                  onChange={(e) => setSmsOrderId(e.target.value)}
                  placeholder="Sipariş, müşteri, ürün…"
                  list="admin-order-suggestions"
                />
                <datalist id="admin-order-suggestions">
                  {filtered.map((o) => (
                    <option key={`dl-${o.id}`} value={o.id}>
                      {o.customerName} {o.productName}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Şablon">
                <SearchableSelect
                  options={(templates.length
                    ? templates
                    : [
                        { id: "order.montage_scheduled", title: "Montaj randevusu", body: "" },
                        { id: "order.shipped", title: "Kargoya verildi", body: "" },
                      ]
                  ).map((t) => ({
                    value: t.id,
                    label: (t as { title?: string }).title || t.id,
                    searchText: `${t.id} ${(t as { title?: string }).title || ""} ${t.body || ""}`,
                  }))}
                  value={smsTemplate}
                  onChange={setSmsTemplate}
                  searchPlaceholder="Şablon ara…"
                />
              </Field>
              <Button
                type="button"
                onClick={() => smsOrderId && sendSMS(smsOrderId, smsTemplate)}
                disabled={!smsOrderId}
              >
                Gönder
              </Button>
            </div>
          </div>

          {msg ? (
            <Alert tone="info">{msg}</Alert>
          ) : null}
        </aside>
      </div>

      {selectedId && typeof document !== "undefined"
        ? createPortal(
            <div className="admin-order-drawer-root" role="dialog" aria-modal="true" aria-label="Sipariş detayı">
              <button type="button" className="admin-order-drawer-backdrop" aria-label="Kapat" onClick={() => setSelectedId(null)} />
              <aside className="admin-order-drawer-panel adb-animate-fade">
                <div className="admin-order-drawer-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="adb-label-sm" style={{ color: "var(--adb-primary)" }}>
                      Sipariş detayı
                    </div>
                    <h2 style={{ margin: "4px 0 0", fontSize: 20, overflowWrap: "anywhere" }}>
                      #{String(detail?.id || selectedId).slice(0, 8)}
                    </h2>
                  </div>
                  <Button type="button" variant="tertiary" onClick={() => setSelectedId(null)} style={{ flexShrink: 0 }}>
                    Kapat
                  </Button>
                </div>

                {detailLoading ? (
                  <div className="admin-order-drawer-body">
                    <EmptyState title="Yükleniyor…" />
                  </div>
                ) : !detail ? (
                  <div className="admin-order-drawer-body">
                    <EmptyState title="Detay alınamadı" />
                  </div>
                ) : (
                  <div className="admin-order-drawer-body">
                    {(() => {
                      const ship = (detail.shippingAddress || {}) as Record<string, unknown>;
                      const bill = (detail.billing || {}) as Record<string, unknown>;
                      const history = Array.isArray(detail.history) ? (detail.history as Array<Record<string, unknown>>) : [];
                      const items = Array.isArray(detail.items) ? (detail.items as Array<Record<string, unknown>>) : [];
                      return (
                        <>
                          <section className="admin-order-section">
                            <h3>Özet</h3>
                            <div className="admin-order-grid">
                              <div>
                                <span>Durum</span>
                                <strong>{String(detail.status || "—")}</strong>
                              </div>
                              <div>
                                <span>Tutar</span>
                                <strong>{formatTRY(Number(detail.total || 0))}</strong>
                              </div>
                              <div>
                                <span>Ödeme</span>
                                <strong>{String(detail.paymentMethod || "—")}</strong>
                              </div>
                              <div>
                                <span>Teslimat</span>
                                <strong>{String(detail.deliveryType || "—")}</strong>
                              </div>
                              <div>
                                <span>Montaj</span>
                                <strong>{String(detail.montageStatus || "—")}</strong>
                              </div>
                              <div>
                                <span>Tarih</span>
                                <strong>{String(detail.createdAt || "—")}</strong>
                              </div>
                            </div>
                            {detail.serviceRef ? <p style={{ margin: "8px 0 0", fontSize: 13 }}>Servis ref: {String(detail.serviceRef)}</p> : null}
                            {detail.montageNote ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>Not: {String(detail.montageNote)}</p> : null}
                          </section>

                          <section className="admin-order-section">
                            <h3>Müşteri & teslimat adresi</h3>
                            <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{String(detail.customerName || ship.name || "—")}</p>
                            <p style={{ margin: "0 0 4px", fontSize: 13 }}>{String(detail.customerPhone || ship.phone || "—")}</p>
                            <p style={{ margin: "0 0 4px", fontSize: 13 }}>{String(detail.customerEmail || ship.email || "—")}</p>
                            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5 }}>
                              {String(ship.line1 || detail.addressLine || "Adres satırı kayıtlı değil")}
                              <br />
                              {[ship.district || detail.district, ship.city || detail.city].filter(Boolean).join(" / ") || "—"}
                            </p>
                            {detail.customerId ? (
                              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--adb-muted)" }}>Müşteri ID: {String(detail.customerId)}</p>
                            ) : null}
                          </section>

                          <section className="admin-order-section">
                            <h3>Fatura bilgileri</h3>
                            <p style={{ margin: "0 0 4px", fontSize: 13 }}>
                              Ünvan: <strong>{String(bill.name || detail.customerName || "—")}</strong>
                            </p>
                            <p style={{ margin: "0 0 4px", fontSize: 13 }}>
                              VKN/TCKN: <strong>{String(bill.taxNo || detailInvoice?.taxNo || "—")}</strong>
                            </p>
                            <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.5 }}>
                              Fatura adresi: {String(bill.address || "—")}
                            </p>
                            {detailInvoice ? (
                              <div style={{ padding: 10, borderRadius: 8, background: "var(--adb-surface-low)", fontSize: 13 }}>
                                <div>
                                  Fatura no: <strong>{String(detailInvoice.number)}</strong>
                                </div>
                                <div>Durum: {String(detailInvoice.status)} · e-Fatura: {String(detailInvoice.eInvoiceStatus || "—")}</div>
                                <div>Tutar: {formatTRY(Number(detailInvoice.amount || 0))}</div>
                                {detailInvoice.pdfUrl ? (
                                  <a href={String(detailInvoice.pdfUrl)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--adb-primary)" }}>
                                    PDF / önizleme aç →
                                  </a>
                                ) : null}
                              </div>
                            ) : (
                              <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
                                Bu siparişe bağlı muhasebe faturası henüz yok. Muhasebe ekranından oluşturulabilir.
                              </p>
                            )}
                          </section>

                          <section className="admin-order-section">
                            <h3>Ödeme & kargo</h3>
                            <div className="admin-order-grid">
                              <div>
                                <span>Ödeme kaydı</span>
                                <strong>
                                  {detailPayment
                                    ? `${String(detailPayment.status || "—")} · ${formatTRY(Number(detailPayment.amount || 0))}`
                                    : "Yok"}
                                </strong>
                              </div>
                              <div>
                                <span>Kargo</span>
                                <strong>
                                  {detailShipment
                                    ? `${String(detailShipment.trackingNumber || "—")} · ${String(detailShipment.status || "")}`
                                    : "Oluşturulmamış"}
                                </strong>
                              </div>
                            </div>
                          </section>

                          <section className="admin-order-section">
                            <h3>Kalemler</h3>
                            <div style={{ display: "grid", gap: 8 }}>
                              {items.length === 0 ? (
                                <span style={{ color: "var(--adb-muted)", fontSize: 13 }}>Kalem yok</span>
                              ) : (
                                items.map((it) => (
                                  <div key={String(it.id)} className="admin-order-line">
                                    <div style={{ fontWeight: 650 }}>{String(it.name || "Ürün")}</div>
                                    <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>
                                      {String(it.sku || "")} · x{Number(it.qty || 1)} · {formatTRY(Number(it.unitPrice || 0))}
                                      {it.serialNo ? ` · Seri: ${String(it.serialNo)}` : ""}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </section>

                          {history.length > 0 ? (
                            <section className="admin-order-section">
                              <h3>Durum geçmişi</h3>
                              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--adb-muted)", lineHeight: 1.7 }}>
                                {history.map((h, i) => (
                                  <li key={`${h.at}-${i}`}>
                                    {String(h.from || "—")} → <strong>{String(h.to)}</strong>
                                    {h.note ? ` (${String(h.note)})` : ""} · {String(h.at || "")}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                )}
              </aside>
            </div>,
            document.body,
          )
        : null}
    </AdminShell>
  );
}
