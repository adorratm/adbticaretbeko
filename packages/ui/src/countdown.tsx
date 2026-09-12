"use client";

import { useEffect, useState } from "react";
import { cn } from "./cn";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function Countdown({
  endsAt,
  label = "Kampanya bitiş",
  className,
}: {
  endsAt: string | Date;
  label?: string;
  className?: string;
}) {
  const end = typeof endsAt === "string" ? new Date(endsAt).getTime() : endsAt.getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = Math.max(0, end - now);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  return (
    <div className={cn("adb-countdown", className)}>
      <span className="adb-label-sm" style={{ color: "var(--adb-muted)" }}>
        {label}
      </span>
      <span className="adb-countdown-unit">{pad(hours)}</span>
      <span style={{ fontWeight: 800, color: "var(--adb-primary)" }}>:</span>
      <span className="adb-countdown-unit">{pad(minutes)}</span>
      <span style={{ fontWeight: 800, color: "var(--adb-primary)" }}>:</span>
      <span className="adb-countdown-unit">{pad(seconds)}</span>
    </div>
  );
}
