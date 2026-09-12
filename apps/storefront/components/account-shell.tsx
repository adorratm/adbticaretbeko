"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getStoreAccessToken } from "@adb/api-client";
import { StorefrontShell } from "./site-shell";

const tabs = [
  { href: "/hesabim", label: "Profil", icon: "person" },
  { href: "/hesabim/adresler", label: "Adreslerim", icon: "home_pin" },
  { href: "/hesabim/siparisler", label: "Siparişlerim", icon: "package_2" },
  { href: "/hesabim/favoriler", label: "Favoriler", icon: "favorite" },
];

export function AccountShell({
  title,
  children,
  cartCount,
}: {
  title: string;
  children: ReactNode;
  cartCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getStoreAccessToken()) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  return (
    <StorefrontShell cartCount={cartCount}>
      <main className="adb-container" style={{ padding: "32px 24px 64px" }}>
        <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
          Hesabım
        </p>
        <h1 style={{ margin: "6px 0 20px", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>{title}</h1>
        <div
          className="adb-account-grid"
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "220px minmax(0, 1fr)",
            alignItems: "start",
          }}
        >
          <nav className="adb-card" style={{ padding: 10, display: "grid", gap: 4 }}>
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    background: active ? "var(--adb-primary-container)" : "transparent",
                    color: active ? "#fff" : "var(--adb-muted)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {t.icon}
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div>{children}</div>
        </div>
      </main>
    </StorefrontShell>
  );
}
