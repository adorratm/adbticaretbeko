"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearAdminSession,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminUser,
  parseApiError,
  saveAdminSession,
} from "@adb/api-client";
import { Alert, Button, SearchableSelect } from "@adb/ui";
import { createAdminApi } from "../lib/admin-api";
import { useAdminBranch } from "./admin-branch";

export { createAdminApi } from "../lib/admin-api";

const nav = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" },
  { href: "/urunler", label: "Ürün Yönetimi", icon: "inventory_2" },
  { href: "/kategoriler", label: "Kategoriler", icon: "category" },
  { href: "/siparisler", label: "Siparişler & Sevkiyat", icon: "local_shipping" },
  { href: "/servis-ekipleri", label: "Servis Ekipleri", icon: "groups" },
  { href: "/servis-rotalari", label: "Servis Rotaları", icon: "alt_route" },
  { href: "/takas", label: "Takas", icon: "published_with_changes" },
  { href: "/depolama", label: "Depolama", icon: "warehouse" },
  { href: "/stok", label: "Şube Stok", icon: "store" },
  { href: "/beko-sync", label: "Pazaryeri Sync", icon: "sync" },
  { href: "/musteriler", label: "Müşteriler", icon: "group" },
  { href: "/kampanyalar", label: "Kampanyalar", icon: "campaign" },
  { href: "/bildirimler", label: "Bildirimler", icon: "notifications" },
  { href: "/yorumlar", label: "Yorumlar", icon: "rate_review" },
  { href: "/terk-sepet", label: "Terk Sepet", icon: "shopping_cart_off" },
  { href: "/muhasebe", label: "Muhasebe", icon: "receipt_long" },
  { href: "/vitrin", label: "Mağaza / Vitrin", icon: "settings" },
  { href: "/raporlar", label: "Raporlar & Gelir", icon: "monitoring" },
];

function AdminShellInner({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { warehouses, branchCode, branch, setBranchCode } = useAdminBranch();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token = getAdminAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setEmail(getAdminUser()?.email ?? null);
    setReady(true);
    createAdminApi()
      .auth.me()
      .then((me) => {
        setEmail(me.email);
        saveAdminSession({
          accessToken: getAdminAccessToken() || "",
          refreshToken: getAdminRefreshToken() || "",
          expiresIn: 900,
          userId: me.id,
          email: me.email,
          roles: me.roles,
        });
      })
      .catch((e) => setApiHint(parseApiError(e)));
  }, [router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  async function logout() {
    try {
      await createAdminApi().auth.logout(getAdminRefreshToken() || undefined);
    } catch {
      /* ignore */
    }
    clearAdminSession();
    router.replace("/login");
  }

  const navItems = useMemo(() => nav, []);
  const today = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--adb-muted)" }}>
        Oturum kontrol ediliyor…
      </div>
    );
  }

  const sidebar = (
    <>
      <div>
        <div style={{ padding: "0 10px 18px" }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>ADB PANEL</div>
          <div className="adb-label-sm" style={{ color: "#b6c6f1", marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#115cb9" }} />
            Beko Yetkili Bayi Portalı
          </div>
        </div>
        <div className="adb-label-sm" style={{ color: "#b6c6f1", padding: "0 12px 8px" }}>
          Modüller
        </div>
        <nav style={{ display: "grid", gap: 4 }}>
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  background: active ? "var(--adb-primary-container)" : "transparent",
                  color: active ? "#fff" : "#b6c6f1",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div style={{ padding: 10, background: "rgba(236,241,255,0.08)", borderRadius: 8, margin: 4 }}>
        <div className="adb-label-sm" style={{ color: "#b6c6f1" }}>
          Beko Bayi Hattı
        </div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>444 0 888</div>
      </div>
    </>
  );

  return (
    <div className="admin-shell adb-animate-fade" style={{ display: "flex", minHeight: "100vh", background: "var(--adb-surface)" }}>
      {menuOpen ? (
        <button
          type="button"
          className="admin-drawer-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`admin-sidebar${menuOpen ? " is-open" : ""}`}>{sidebar}</aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-btn"
              aria-label="Menüyü aç"
              onClick={() => setMenuOpen(true)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="admin-branch-picker">
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--adb-primary)" }}>
                store
              </span>
              <SearchableSelect
                className="admin-branch-select"
                value={branchCode}
                onChange={setBranchCode}
                searchPlaceholder="Şube ara…"
                placeholder="Şube seçin…"
                options={
                  warehouses.length > 0
                    ? warehouses.map((w) => ({
                        value: w.code,
                        label: w.city ? `${w.name} — ${w.city}` : w.name,
                        searchText: `${w.code} ${w.name} ${w.city}`,
                      }))
                    : [
                        { value: "BESIKTAS", label: "Merkez Şube — Beşiktaş" },
                        { value: "KADIKOY", label: "Kadıköy Konsept" },
                        { value: "BURSA", label: "Bursa Nilüfer" },
                        { value: "MAIN", label: "Merkez Depo" },
                      ]
                }
              />
            </div>
            <div className="admin-sync-pill">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981" }} />
              Beko Entegrasyon: Aktif
            </div>
          </div>
          <div className="admin-topbar-right">
            <strong className="admin-page-title">{title}</strong>
            <span className="admin-user-email">{email || "Oturum"}</span>
            <Button type="button" variant="tertiary" onClick={logout} style={{ height: 36 }}>
              Çıkış
            </Button>
          </div>
        </header>

        <div className="admin-content">
          <div className="adb-card adb-animate-in admin-hero-banner">
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <div className="admin-hero-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  verified
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 700 }}>
                    ADB Ticaret Beko Yetkili Satıcısı
                  </h1>
                  <span className="adb-badge" style={{ background: "var(--adb-primary-container)", color: "#fff" }}>
                    {branch?.name || branchCode}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--adb-muted)" }}>
                  Bugün: {today} · Aktif şube: {branch?.name || branchCode}
                  {branch?.city ? ` (${branch.city})` : ""}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/beko-sync" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  sync
                </span>
                Stok Eşitle
              </Link>
              <Link href="/siparisler" className="adb-btn adb-btn-primary" style={{ height: 40 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  add_circle
                </span>
                Hızlı Satış
              </Link>
            </div>
          </div>

          {apiHint ? (
            <Alert tone="warning" style={{ marginBottom: 16 }}>
              {apiHint}
            </Alert>
          ) : null}
          <div className="adb-animate-fade">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return <AdminShellInner title={title}>{children}</AdminShellInner>;
}
