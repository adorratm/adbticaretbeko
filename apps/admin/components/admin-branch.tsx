"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createAdminApi } from "../lib/admin-api";

export type AdminWarehouse = {
  id: string;
  name: string;
  code: string;
  city: string;
};

type AdminBranchContextValue = {
  warehouses: AdminWarehouse[];
  branchCode: string;
  branch: AdminWarehouse | null;
  setBranchCode: (code: string) => void;
  ready: boolean;
  matchesOrder: (order: { city?: string; district?: string }) => boolean;
};

const STORAGE_KEY = "adb_admin_branch";

const BRANCH_DISTRICTS: Record<string, string[]> = {
  BESIKTAS: ["besiktas", "sisli", "sariyer", "levent", "eyup", "beyoglu"],
  KADIKOY: ["kadikoy", "uskudar", "atasehir", "maltepe", "moda", "acibadem", "beylerbeyi"],
  BURSA: ["nilufer", "osmangazi", "yildirim", "mudanya"],
  MAIN: [],
};

function normalizeTr(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

const AdminBranchContext = createContext<AdminBranchContextValue | null>(null);

export function AdminBranchProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<AdminWarehouse[]>([]);
  const [branchCode, setBranchCodeState] = useState("BESIKTAS");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setBranchCodeState(saved);
    const api = createAdminApi();
    api.warehouses
      .list()
      .then((res) => {
        const items = (res.items || []) as AdminWarehouse[];
        setWarehouses(items);
        const codes = new Set(items.map((w) => w.code));
        const next = saved && codes.has(saved) ? saved : items.find((w) => w.code === "BESIKTAS")?.code || items[0]?.code || "BESIKTAS";
        setBranchCodeState(next);
        window.localStorage.setItem(STORAGE_KEY, next);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setBranchCode = useCallback((code: string) => {
    setBranchCodeState(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, code);
      window.dispatchEvent(new CustomEvent("adb-admin-branch", { detail: code }));
    }
  }, []);

  const branch = useMemo(
    () => warehouses.find((w) => w.code === branchCode) || null,
    [warehouses, branchCode],
  );

  const matchesOrder = useCallback(
    (order: { city?: string; district?: string }) => {
      if (!branchCode || branchCode === "MAIN") return true;
      const city = normalizeTr(order.city || "");
      const district = normalizeTr(order.district || "");
      const branchCity = normalizeTr(branch?.city || "");

      if (branchCity && city) {
        const sameCity = city.includes(branchCity) || branchCity.includes(city);
        if (!sameCity) return false;
      }

      const hints = BRANCH_DISTRICTS[branchCode] || [];
      if (hints.length === 0) return true;
      if (!district) return true;
      return hints.some((h) => district.includes(h) || h.includes(district));
    },
    [branch?.city, branchCode],
  );

  const value = useMemo(
    () => ({ warehouses, branchCode, branch, setBranchCode, ready, matchesOrder }),
    [warehouses, branchCode, branch, setBranchCode, ready, matchesOrder],
  );

  return <AdminBranchContext.Provider value={value}>{children}</AdminBranchContext.Provider>;
}

export function useAdminBranch() {
  const ctx = useContext(AdminBranchContext);
  if (!ctx) {
    return {
      warehouses: [] as AdminWarehouse[],
      branchCode: "BESIKTAS",
      branch: null as AdminWarehouse | null,
      setBranchCode: (_code: string) => undefined,
      ready: false,
      matchesOrder: () => true,
    };
  }
  return ctx;
}
