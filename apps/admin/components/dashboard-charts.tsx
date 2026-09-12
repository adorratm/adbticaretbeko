"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

const navy = "#003f87";
const blue = "#0056b3";
const orange = "#a62c00";
const teal = "#0f766e";
const muted = "#64748b";

type PipelinePoint = { label: string; value: number };
type QuotaPoint = { name: string; percent: number; achieved: number; quota: number };

export function PipelineEChart({ data }: { data: PipelinePoint[] }) {
  const option = useMemo(
    () => ({
      color: [blue],
      grid: { left: 48, right: 16, top: 28, bottom: 36 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        textStyle: { color: "#0f172a" },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisLabel: { color: muted, fontWeight: 600 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: muted },
      },
      series: [
        {
          type: "bar",
          barWidth: 36,
          data: data.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color: [blue, navy, orange, teal][i % 4],
              borderRadius: [8, 8, 0, 0],
            },
          })),
          label: { show: true, position: "top", color: muted, fontWeight: 700 },
        },
      ],
    }),
    [data],
  );

  return <ReactECharts option={option} style={{ height: 220, width: "100%" }} opts={{ renderer: "canvas" }} />;
}

export function QuotaEChart({ data }: { data: QuotaPoint[] }) {
  const option = useMemo(
    () => ({
      color: [orange, blue],
      grid: { left: 48, right: 16, top: 36, bottom: 36 },
      legend: { top: 0, textStyle: { color: muted } },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        textStyle: { color: "#0f172a" },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisLabel: { color: muted, fontWeight: 600 },
      },
      yAxis: [
        {
          type: "value",
          name: "%",
          max: 120,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLabel: { color: muted },
        },
        {
          type: "value",
          name: "₺",
          splitLine: { show: false },
          axisLabel: { show: false },
        },
      ],
      series: [
        {
          name: "Kota %",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 8,
          areaStyle: { color: "rgba(166,44,0,0.12)" },
          data: data.map((d) => Math.round(d.percent)),
        },
        {
          name: "Gerçekleşen",
          type: "bar",
          yAxisIndex: 1,
          barWidth: 18,
          itemStyle: { color: "rgba(0,86,179,0.35)", borderRadius: [6, 6, 0, 0] },
          data: data.map((d) => d.achieved),
        },
      ],
    }),
    [data],
  );

  return <ReactECharts option={option} style={{ height: 220, width: "100%" }} opts={{ renderer: "canvas" }} />;
}

export function StatusDonutEChart({ counts }: { counts: Record<string, number> }) {
  const slices = useMemo(() => {
    const map: Array<{ name: string; value: number; color: string }> = [
      { name: "Ödeme", value: counts.PAYMENT_PENDING || 0, color: orange },
      { name: "İşlem", value: counts.PROCESSING || 0, color: blue },
      {
        name: "Montaj",
        value: (counts.MONTAJ_RANDEVU || 0) + (counts.MONTAJ_YOLDA || 0) + (counts.KESIF_BEKLIYOR || 0),
        color: navy,
      },
      { name: "Tamam", value: (counts.MONTAJ_TAMAMLANDI || 0) + (counts.COMPLETED || 0), color: teal },
    ];
    return map.filter((s) => s.value > 0);
  }, [counts]);

  const option = useMemo(
    () => ({
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: muted } },
      series: [
        {
          type: "pie",
          radius: ["48%", "72%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
          label: { color: muted, formatter: "{b}\n{c}" },
          data: (slices.length
            ? slices
            : [
                { name: "Ödeme", value: 4, color: orange },
                { name: "İşlem", value: 8, color: blue },
                { name: "Montaj", value: 19, color: navy },
                { name: "Tamam", value: 21, color: teal },
              ]
          ).map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
        },
      ],
    }),
    [slices],
  );

  return <ReactECharts option={option} style={{ height: 240, width: "100%" }} opts={{ renderer: "canvas" }} />;
}
