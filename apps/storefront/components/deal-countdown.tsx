"use client";

import { Countdown } from "@adb/ui";

export function DealCountdown() {
  const ends = new Date();
  ends.setHours(ends.getHours() + 2, ends.getMinutes() + 47, ends.getSeconds() + 19, 0);
  return <Countdown endsAt={ends} label="Kampanya bitiş" />;
}
