import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function ProgressBar({
  value,
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  value: number;
  tone?: "default" | "success" | "warn" | "danger";
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "adb-progress",
        tone === "success" && "adb-progress-success",
        tone === "warn" && "adb-progress-warn",
        tone === "danger" && "adb-progress-danger",
        className,
      )}
      {...props}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RouteCard({
  title,
  progress,
  tech,
  nextStop,
  tone = "success",
}: {
  title: string;
  progress: string;
  tech: string;
  nextStop: string;
  tone?: "success" | "warn" | "danger";
}) {
  const pct = Number(progress.split("/")[0]) / Number(progress.split("/")[1] || 1) * 100;
  const dot =
    tone === "success" ? "#10b981" : tone === "warn" ? "#f59e0b" : "#a62c00";
  return (
    <div style={{ padding: 12, background: "var(--adb-surface-low)", borderRadius: 8, minWidth: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: dot, flexShrink: 0 }} />
          <strong style={{ fontSize: 13, overflowWrap: "anywhere" }}>{title}</strong>
        </div>
        <span style={{ fontSize: 12, color: "var(--adb-muted)", fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>{progress}</span>
      </div>
      <ProgressBar value={pct} tone={tone} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 8,
          fontSize: 11,
          color: "var(--adb-muted)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{tech}</span>
        <span style={{ color: "var(--adb-primary)", fontWeight: 700, overflowWrap: "anywhere" }}>{nextStop}</span>
      </div>
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon ? (
          <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)", fontSize: 20 }}>
            {icon}
          </span>
        ) : null}
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
      </div>
      {action}
    </div>
  );
}
