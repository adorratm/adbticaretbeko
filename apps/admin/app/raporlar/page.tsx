"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { parseApiError } from "@adb/api-client";
import { Alert, EmptyState } from "@adb/ui";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Quota = {
  warehouseCode: string;
  warehouseName: string;
  quota: number;
  achieved: number;
  bonus: number;
  percent: number;
};

type Incentive = {
  code: string;
  title: string;
  description: string;
  bonus: number;
  active: boolean;
};

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function RaporlarPage() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [period, setPeriod] = useState("");
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const api = createAdminApi();
    Promise.all([api.reports.quotas(), api.reports.incentives()])
      .then(([q, i]) => {
        setQuotas(q.items);
        setPeriod(q.period);
        setIncentives(i.items);
      })
      .catch((e) => setMsg(parseApiError(e)));
  }, []);

  return (
    <AdminShell title="Prim & Kota">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Şube kotası ve teşvik kampanyaları {period ? `(${period})` : ""}
      </p>
      {msg ? (
        <Alert tone="error" style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <h2 style={{ fontSize: 16 }}>Şube gerçekleşme</h2>
      {quotas.length ? (
        <div className="adb-card adb-animate-in" style={{ padding: 16, marginBottom: 24 }}>
          <ReactECharts
            style={{ height: 260, width: "100%" }}
            opts={{ renderer: "canvas" }}
            option={{
              color: ["#ff5722", "#0056b3"],
              tooltip: { trigger: "axis" },
              legend: { top: 0 },
              grid: { left: 48, right: 24, top: 40, bottom: 40 },
              xAxis: {
                type: "category",
                data: quotas.map((q) => q.warehouseName),
                axisTick: { show: false },
              },
              yAxis: [
                { type: "value", name: "%", max: 120 },
                { type: "value", name: "₺", show: false },
              ],
              series: [
                {
                  name: "Kota %",
                  type: "bar",
                  barWidth: 28,
                  itemStyle: { borderRadius: [8, 8, 0, 0] },
                  data: quotas.map((q) => Math.round(q.percent)),
                },
                {
                  name: "Gerçekleşen",
                  type: "line",
                  smooth: true,
                  yAxisIndex: 1,
                  data: quotas.map((q) => q.achieved),
                },
              ],
            }}
          />
        </div>
      ) : null}

      <div className="adb-card" style={{ overflow: "auto", marginBottom: 24 }}>
        {quotas.length === 0 && !msg ? (
          <EmptyState title="Kota verisi yok" description="Reporting servisini başlatın." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>Şube</th>
                <th style={{ padding: 12 }}>Kota</th>
                <th style={{ padding: 12 }}>Gerçekleşen</th>
                <th style={{ padding: 12 }}>%</th>
                <th style={{ padding: 12 }}>Prim</th>
              </tr>
            </thead>
            <tbody>
              {quotas.map((q) => (
                <tr key={q.warehouseCode} style={{ borderTop: "1px solid var(--adb-border)" }}>
                  <td style={{ padding: 12 }}>{q.warehouseName}</td>
                  <td style={{ padding: 12 }}>{formatTRY(q.quota)}</td>
                  <td style={{ padding: 12 }}>{formatTRY(q.achieved)}</td>
                  <td style={{ padding: 12 }}>{q.percent.toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{formatTRY(q.bonus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={{ fontSize: 16 }}>Teşvik kampanyaları</h2>
      <div
        className="adb-stagger"
        style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
      >
        {incentives.map((inc) => (
          <div key={inc.code} className="adb-card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{inc.code}</div>
            <div style={{ fontWeight: 700 }}>{inc.title}</div>
            <p style={{ fontSize: 13, color: "var(--adb-muted)" }}>{inc.description}</p>
            <div style={{ fontWeight: 800, color: "var(--adb-primary)" }}>{formatTRY(inc.bonus)}</div>
            <div style={{ fontSize: 12 }}>{inc.active ? "Aktif" : "Pasif"}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
