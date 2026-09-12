"use client";

import { useEffect, useState } from "react";
import { Countdown } from "@adb/ui";

/** Client-only countdown — avoids SSR/client hydration mismatch. */
export function DealCountdown() {
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  useEffect(() => {
    const ends = new Date();
    ends.setHours(ends.getHours() + 2, ends.getMinutes() + 47, ends.getSeconds() + 19, 0);
    setEndsAt(ends);
  }, []);
  if (!endsAt) {
    return (
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adb-muted)", padding: "8px 12px" }}>Kampanya süresi…</div>
    );
  }
  return <Countdown endsAt={endsAt} label="Kampanya bitiş" />;
}
