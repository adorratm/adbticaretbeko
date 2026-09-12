"use client";

import type { ReactNode } from "react";
import { AdminBranchProvider } from "../components/admin-branch";

export function AdminProviders({ children }: { children: ReactNode }) {
  return <AdminBranchProvider>{children}</AdminBranchProvider>;
}
