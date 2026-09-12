import type { ReactNode } from "react";
import { cn } from "./cn";

type Status = "preparing" | "delivered" | "montage";

const map: Record<Status, string> = {
  preparing: "adb-status adb-status-preparing",
  delivered: "adb-status adb-status-delivered",
  montage: "adb-status adb-status-montage",
};

export function StatusChip({
  status,
  children,
  className,
}: {
  status: Status;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(map[status], className)}>{children}</span>;
}
