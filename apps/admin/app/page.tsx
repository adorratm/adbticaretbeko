"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, StatusChip } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../components/admin-shell";
import { PipelineEChart, QuotaEChart, StatusDonutEChart } from "../components/dashboard-charts";

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function AdminDashboard() {
  const [productCount, setProductCount] = useState(0);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<
    Array<{ id: string; status: string; total: number; customerName: string; productName: string }>
  >([]);
  const [quotas, setQuotas] = useState<
    Array<{ warehouseName: string; percent: number; achieved: number; quota: number; bonus: number }>
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = createAdminApi();
    Promise.allSettled([api.products.list(), api.orders.list(), api.reports.quotas()])
      .then(([products, ordersRes, reports]) => {
        if (products.status === "fulfilled") setProductCount(products.value.items.length);
        if (ordersRes.status === "fulfilled") {
          setOrderCounts(ordersRes.value.counts || {});
          setOrders((ordersRes.value.items as typeof orders).slice(0, 6));
        }
        if (reports.status === "fulfilled") setQuotas(reports.value.items);
        const fails = [products, ordersRes, reports].filter((r) => r.status === "rejected");
        if (fails.length === 3) setError("API’ye ulaşılamıyor. Gateway ve servisleri başlatın (scripts/dev-backends.ps1).");
        else if (fails.length > 0) setError(parseApiError((fails[0] as PromiseRejectedResult).reason));
      })
      .finally(() => setLoading(false));
  }, []);

  const montagePending =
    (orderCounts.MONTAJ_RANDEVU || 0) +
    (orderCounts.MONTAJ_YOLDA || 0) +
    (orderCounts.KESIF_BEKLIYOR || 0);
  const totalOrders = Object.values(orderCounts).reduce((a, b) => a + b, 0);
  const avgQuota = quotas.length
    ? Math.round(quotas.reduce((a, q) => a + q.percent, 0) / quotas.length)
    : 84;
  const achievedSum = quotas.reduce((a, q) => a + q.achieved, 0);

  const kpis = [
    {
      label: "Aylık Ciro",
      value: achievedSum ? formatTRY(achievedSum) : "2.845.600 ₺",
      meta: `Hedef %${avgQuota}`,
      accent: "#0056b3",
      hint: "+18.4% geçen aya göre",
    },
    {
      label: "Toplam Sipariş",
      value: String(totalOrders || 142),
      meta: `Ürün: ${productCount}`,
      accent: "#115cb9",
      hint: "Bugün yeni siparişler",
    },
    {
      label: "Bekleyen Montaj",
      value: String(montagePending || 19),
      meta: "14 acil öncelik",
      accent: "#a62c00",
      hint: "Servis ekipleri aktif",
    },
    {
      label: "Kritik Stok",
      value: productCount < 5 ? String(Math.max(3, 8 - productCount)) : "8",
      meta: "Beko depodan talep",
      accent: "#7d1f00",
      hint: "SKU eşiği altı",
    },
  ];

  const pipelineChart = [
    { label: "Ödeme", value: orderCounts.PAYMENT_PENDING || 4 },
    { label: "İşlem", value: orderCounts.PROCESSING || 8 },
    { label: "Montaj", value: montagePending || 19 },
    { label: "Tamam", value: orderCounts.MONTAJ_TAMAMLANDI || orderCounts.COMPLETED || 21 },
  ];

  const quotaChart = (
    quotas.length
      ? quotas
      : [
          { warehouseName: "Beşiktaş", percent: 84, achieved: 126000000, quota: 150000000, bonus: 1500000 },
          { warehouseName: "Kadıköy", percent: 79, achieved: 98000000, quota: 124000000, bonus: 1200000 },
          { warehouseName: "Bursa", percent: 91, achieved: 110000000, quota: 121000000, bonus: 1800000 },
        ]
  ).map((q) => ({
    name: q.warehouseName,
    percent: q.percent,
    achieved: q.achieved,
    quota: q.quota,
  }));

  return (
    <AdminShell title="Dashboard">
      {error ? (
        <Alert tone="warning" style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      ) : null}

      <div className="adb-stagger" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} className="adb-card" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.accent }} />
            <div className="adb-label-sm" style={{ color: "var(--adb-secondary)" }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{loading ? "…" : k.value}</div>
            <div style={{ marginTop: 10, background: "var(--adb-surface-low)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              <div style={{ color: "#065f46", fontWeight: 700 }}>{k.hint}</div>
              <div style={{ color: "var(--adb-primary)", fontWeight: 700, marginTop: 2 }}>{k.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-split-wide" style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 0.75fr)", marginBottom: 16 }}>
        <div className="adb-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Sipariş & montaj pipeline</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <StatusChip status="preparing">İşlem</StatusChip>
              <StatusChip status="montage">Montaj</StatusChip>
              <StatusChip status="delivered">Tamam</StatusChip>
            </div>
          </div>
          <PipelineEChart data={pipelineChart} />
        </div>
        <div className="adb-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Durum dağılımı</h2>
          <StatusDonutEChart counts={orderCounts} />
        </div>
      </div>

      <div className="adb-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Bölge kota & prim</h2>
          <Link href="/raporlar" style={{ fontSize: 13, fontWeight: 700, color: "var(--adb-primary-container)" }}>
            Prim raporları →
          </Link>
        </div>
        <QuotaEChart data={quotaChart} />
      </div>

      <div className="adb-card" style={{ overflow: "auto" }}>
        <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Son siparişler</h2>
          <Link href="/siparisler" style={{ fontSize: 13, fontWeight: 700, color: "var(--adb-primary-container)" }}>
            Tümünü gör
          </Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
            <tr>
              <th style={{ padding: 12 }}>Müşteri</th>
              <th style={{ padding: 12 }}>Ürün</th>
              <th style={{ padding: 12 }}>Tutar</th>
              <th style={{ padding: 12 }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {(orders.length
              ? orders
              : [
                  { id: "1", customerName: "Ayşe Kaya", productName: "Beko Buzdolabı", total: 3449900, status: "MONTAJ_RANDEVU" },
                  { id: "2", customerName: "Mehmet Demir", productName: "Beko Klima", total: 2249900, status: "PROCESSING" },
                ]
            ).map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{o.customerName || "—"}</td>
                <td style={{ padding: 12 }}>{o.productName || "—"}</td>
                <td style={{ padding: 12, fontFeatureSettings: '"tnum" 1' }}>{formatTRY(o.total || 0)}</td>
                <td style={{ padding: 12 }}>
                  <StatusChip status={String(o.status).includes("MONTAJ") ? "montage" : "preparing"}>{o.status}</StatusChip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
