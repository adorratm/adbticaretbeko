import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Alert({
  tone = "info",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "info" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  return (
    <div className={cn(`adb-alert adb-alert-${tone}`, className)} {...props}>
      {children}
    </div>
  );
}
