import type { ReactNode } from "react";
import { cn } from "./cn";

type BadgeTone = "dealer" | "service" | "energy-a" | "energy-b" | "energy-c" | "energy-d";

const toneClass: Record<BadgeTone, string> = {
  dealer: "adb-badge adb-badge-dealer",
  service: "adb-badge adb-badge-service",
  "energy-a": "adb-badge adb-badge-energy-a",
  "energy-b": "adb-badge adb-badge-energy-b",
  "energy-c": "adb-badge adb-badge-energy-c",
  "energy-d": "adb-badge adb-badge-energy-d",
};

export function Badge({
  tone = "service",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(toneClass[tone], className)}>{children}</span>;
}
