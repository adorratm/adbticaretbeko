"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  clearStoreSession,
  createApiClient,
  getStoreAccessToken,
  getStoreRefreshToken,
} from "@adb/api-client";
import { SearchableSelect } from "@adb/ui";
import { CookieConsent } from "./cookie-consent";
import { NotificationBell } from "./notification-bell";
import { CampaignModalHost } from "./campaign-modal";
import { useStoreAuth } from "../hooks/use-store-auth";

const nav = [
  { href: "/kategori", label: "Ürün Grupları" },
  { href: "/kategori/buzdolaplari", label: "Buzdolapları" },
  { href: "/kategori/camasir-makineleri", label: "Çamaşır" },
  { href: "/kategori/bulasik-makineleri", label: "Bulaşık" },
  { href: "/kategori/klimalar", label: "Klimalar" },
  { href: "/kategori/ankastre-setler", label: "Ankastre" },
  { href: "/kategori/kucuk-ev-robot", label: "Küçük Ev" },
  { href: "/ceyiz", label: "Çeyiz & Fırsat" },
  { href: "/kampanyalar", label: "Kampanyalar" },
  { href: "/takas", label: "Takas" },
];

const categoryOptions = [
  { value: "", label: "Tüm Kategoriler" },
  { value: "buzdolaplari", label: "Buzdolapları" },
  { value: "camasir-makineleri", label: "Çamaşır Makineleri" },
  { value: "bulasik-makineleri", label: "Bulaşık Makineleri" },
  { value: "klimalar", label: "Klimalar" },
  { value: "ankastre-setler", label: "Ankastre Setler" },
  { value: "kucuk-ev-robot", label: "Küçük Ev & Robot" },
];

export function StorefrontHeader({
  announcement,
  cartCount = 0,
  phone = "0850 300 23 56",
  dealerCode = "340982",
}: {
  announcement?: string;
  cartCount?: number;
  phone?: string;
  dealerCode?: string;
}) {
  const router = useRouter();
  const auth = useStoreAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function logout() {
    try {
      const api = createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
        getAccessToken: () => getStoreAccessToken(),
      });
      await api.auth.logout(getStoreRefreshToken() || undefined);
    } catch {
      /* ignore */
    }
    clearStoreSession();
    window.location.href = "/";
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (query.trim()) qs.set("q", query.trim());
    if (category) qs.set("category", category);
    setMenuOpen(false);
    router.push(`/arama${qs.toString() ? `?${qs}` : ""}`);
  }

  const accountSlot = !auth.ready ? (
    <div className="adb-hide-mobile adb-auth-skel" aria-hidden style={{ display: "flex", gap: 14, minWidth: 140, height: 40 }} />
  ) : auth.loggedIn ? (
    <>
      <Link
        href="/hesabim"
        className="adb-hide-mobile"
        style={{ fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", color: "var(--adb-muted)" }}
      >
        <span className="material-symbols-outlined" style={{ display: "block", fontSize: 20 }}>
          person
        </span>
        Hesabım
      </Link>
      <Link
        href="/hesabim/siparisler"
        className="adb-hide-mobile"
        style={{ fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", color: "var(--adb-muted)" }}
      >
        <span className="material-symbols-outlined" style={{ display: "block", fontSize: 20 }}>
          package_2
        </span>
        Siparişler
      </Link>
      <button type="button" onClick={logout} className="adb-btn adb-btn-tertiary adb-hide-mobile" style={{ height: 36 }}>
        Çıkış
      </button>
    </>
  ) : (
    <>
      <Link href="/auth/login" className="adb-hide-mobile" style={{ fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", color: "var(--adb-muted)" }}>
        <span className="material-symbols-outlined" style={{ display: "block", fontSize: 20 }}>
          person
        </span>
        Giriş
      </Link>
      <Link href="/auth/register" className="adb-hide-mobile" style={{ fontSize: 12, fontWeight: 600, textAlign: "center", textDecoration: "none", color: "var(--adb-muted)" }}>
        <span className="material-symbols-outlined" style={{ display: "block", fontSize: 20 }}>
          person_add
        </span>
        Kayıt
      </Link>
    </>
  );

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--adb-surface-lowest)",
        boxShadow: "var(--adb-shadow-sm)",
      }}
    >
      <div className="adb-topbar" style={{ background: "var(--adb-surface-low)", borderBottom: "1px solid var(--adb-border-subtle)" }}>
        <div
          className="adb-container"
          style={{
            minHeight: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 6,
            paddingBottom: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--adb-muted)",
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "var(--adb-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                verified
              </span>
              Beko Yetkili Satıcısı Güvencesi
            </span>
            <span className="adb-hide-mobile" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                build_circle
              </span>
              Yetkili Servis Ücretsiz Montaj
            </span>
          </div>
          <div className="adb-hide-mobile" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <a
              href={`https://wa.me/90${phone.replace(/\D/g, "").replace(/^0/, "")}`}
              style={{ color: "var(--adb-on-surface)", textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--adb-primary)" }}>
                chat
              </span>
              {phone} / WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="adb-container adb-header-main" style={{ minHeight: 72, display: "flex", alignItems: "center", gap: 12, paddingTop: 10, paddingBottom: 10 }}>
        <button
          type="button"
          className="adb-menu-toggle"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "none",
            border: "1px solid var(--adb-border-subtle)",
            background: "#fff",
            borderRadius: 8,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
        </button>

        <Link href="/" className="adb-header-brand" style={{ textDecoration: "none", flexShrink: 0, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--adb-primary)", letterSpacing: "-0.02em" }}>ADB TİCARET</div>
          <div className="adb-label-sm adb-hide-mobile" style={{ color: "var(--adb-secondary)", marginTop: 2 }}>
            Beko Yetkili Satıcısı
          </div>
        </Link>

        <form
          onSubmit={onSearch}
          className="adb-search-form"
          style={{
            flex: 1,
            maxWidth: 560,
            display: "flex",
            alignItems: "center",
            background: "var(--adb-surface-low)",
            borderRadius: 8,
            padding: 4,
            gap: 4,
            minWidth: 0,
          }}
        >
          <label className="adb-sr-only" htmlFor="header-category">
            Kategori
          </label>
          <div style={{ minWidth: 150, maxWidth: 180, flexShrink: 0 }}>
            <SearchableSelect
              id="header-category"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              placeholder="Tüm Kategoriler"
              searchPlaceholder="Kategori ara…"
            />
          </div>
          <input
            className="adb-input"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Model, kod veya kategori ara..."
            aria-label="Ara"
            style={{ border: "none", background: "transparent", height: 36, flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="adb-btn adb-btn-primary" style={{ height: 36, padding: "0 12px", flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              search
            </span>
            <span className="adb-hide-mobile">Ara</span>
          </button>
        </form>

        <nav className="adb-header-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: "auto" }}>
          {accountSlot}
          <NotificationBell compact />
          <Link
            href="/sepet"
            className="adb-header-cart"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--adb-primary-container)",
              color: "#fff",
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              shopping_bag
            </span>
            <span className="adb-hide-mobile">Sepetim</span>
            <span
              style={{
                background: "var(--adb-tertiary-container)",
                borderRadius: 999,
                padding: "0 6px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {cartCount}
            </span>
          </Link>
        </nav>
      </div>

      <div className="adb-desktop-nav" style={{ borderTop: "1px solid var(--adb-border-subtle)", background: "#fff" }}>
        <div className="adb-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, flexWrap: "wrap" }}>
          <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 14, fontWeight: 600 }}>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ padding: "8px 10px", color: "var(--adb-muted)", textDecoration: "none", borderRadius: 8 }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--adb-tertiary)", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              local_shipping
            </span>
            24 Saatte Hızlı Sevk
          </div>
        </div>
      </div>

      <div className="adb-dealer-strip" style={{ background: "var(--adb-surface-high)" }}>
        <div
          className="adb-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 8,
            paddingBottom: 8,
            fontSize: 13,
            color: "var(--adb-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="adb-badge adb-badge-dealer">Resmi Bayi</span>
            <span>{announcement || `ADB Ticaret · Beko Bayi Kodu #${dealerCode}`}</span>
          </div>
          <div className="adb-hide-mobile" style={{ display: "flex", gap: 16, flexWrap: "wrap", fontWeight: 600 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--adb-tertiary)" }}>
                fire_truck
              </span>
              14:00’e kadar aynı gün sevk
            </span>
            <span style={{ color: "var(--adb-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                call
              </span>
              {phone}
            </span>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="adb-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobil menü">
          <div className="adb-mobile-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="adb-mobile-drawer-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ color: "var(--adb-primary)" }}>Menü</strong>
              <button type="button" className="adb-btn adb-btn-tertiary" onClick={() => setMenuOpen(false)} aria-label="Kapat">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={onSearch} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <SearchableSelect
                options={categoryOptions}
                value={category}
                onChange={setCategory}
                placeholder="Tüm Kategoriler"
                searchPlaceholder="Kategori ara…"
              />
              <input
                className="adb-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ürün ara..."
                style={{ height: 40 }}
              />
              <button type="submit" className="adb-btn adb-btn-primary">
                Ara
              </button>
            </form>
            <nav style={{ display: "grid", gap: 4 }}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "12px 10px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                    background: "var(--adb-surface-low)",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              {!auth.ready ? (
                <div className="adb-auth-skel" style={{ height: 44, borderRadius: 8 }} />
              ) : auth.loggedIn ? (
                <>
                  <Link href="/hesabim" className="adb-btn adb-btn-primary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Hesabım
                  </Link>
                  <Link href="/hesabim/bildirimler" className="adb-btn adb-btn-tertiary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Bildirimler
                  </Link>
                  <Link href="/hesabim/adresler" className="adb-btn adb-btn-tertiary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Adreslerim
                  </Link>
                  <Link href="/hesabim/siparisler" className="adb-btn adb-btn-tertiary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Siparişlerim
                  </Link>
                  <button type="button" className="adb-btn adb-btn-tertiary" onClick={logout}>
                    Çıkış {auth.email ? `(${auth.email})` : ""}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="adb-btn adb-btn-primary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Giriş Yap
                  </Link>
                  <Link href="/auth/register" className="adb-btn adb-btn-tertiary" onClick={() => setMenuOpen(false)} style={{ textAlign: "center", textDecoration: "none" }}>
                    Kayıt Ol
                  </Link>
                </>
              )}
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="adb-btn adb-btn-tertiary" style={{ textAlign: "center", textDecoration: "none" }}>
                Ara: {phone}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function StorefrontFooter({
  phone = "0850 300 23 56",
  whatsapp,
  address = "Beşiktaş · Kadıköy · Bursa Nilüfer",
  dealerCode = "340982",
}: {
  phone?: string;
  whatsapp?: string;
  address?: string;
  dealerCode?: string;
}) {
  const wa = whatsapp || phone;
  const auth = useStoreAuth();

  async function logout() {
    try {
      const api = createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
        getAccessToken: () => getStoreAccessToken(),
      });
      await api.auth.logout(getStoreRefreshToken() || undefined);
    } catch {
      /* ignore */
    }
    clearStoreSession();
    window.location.href = "/";
  }

  return (
    <footer style={{ background: "var(--adb-surface-low)", marginTop: 48, borderTop: "1px solid var(--adb-border-subtle)" }}>
      <div
        className="adb-container"
        style={{
          padding: "40px 24px",
          display: "grid",
          gap: 28,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--adb-primary)" }}>ADB Ticaret</div>
          <p style={{ color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.6 }}>
            Beko Türkiye yetkili satıcısı. Orijinal ürün, ücretsiz yetkili servis montajı ve resmi garanti.
          </p>
          <p style={{ fontSize: 12, color: "var(--adb-outline)" }}>Bayi No: #{dealerCode}</p>
        </div>
        <div>
          <div className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 10 }}>
            Alışveriş
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <Link href="/kampanyalar">Kampanyalar</Link>
            <Link href="/takas">Takas Teklifi</Link>
            <Link href="/ceyiz">Çeyiz Paketleri</Link>
            <Link href="/arama">Ürün Ara</Link>
            <Link href="/sepet">Sepetim</Link>
            <Link href="/kargo-takip">Kargo takip</Link>
          </div>
        </div>
        <div>
          <div className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 10 }}>
            Hesap
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            {!auth.ready ? (
              <span style={{ color: "var(--adb-muted)" }}>…</span>
            ) : auth.loggedIn ? (
              <>
                <Link href="/hesabim">Hesabım</Link>
                <Link href="/hesabim/siparisler">Siparişlerim</Link>
                <Link href="/hesabim/bildirimler">Bildirimler</Link>
                <Link href="/hesabim/adresler">Adreslerim</Link>
                <Link href="/hesabim/favoriler">Favorilerim</Link>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    font: "inherit",
                    color: "inherit",
                  }}
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login">Giriş Yap</Link>
                <Link href="/auth/register">Kayıt Ol</Link>
                <Link href="/auth/sifremi-unuttum">Şifremi Unuttum</Link>
              </>
            )}
          </div>
        </div>
        <div>
          <div className="adb-label-sm" style={{ color: "var(--adb-primary)", marginBottom: 10 }}>
            Yasal & Destek
          </div>
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <Link href="/kvkk">KVKK Aydınlatma</Link>
            <Link href="/cerez-politikasi">Çerez Politikası</Link>
            <Link href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</Link>
            <Link href="/iade-iptal">İade & İptal</Link>
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>Tel: {phone}</p>
            <a href={`https://wa.me/${wa.replace(/\D/g, "")}`} style={{ color: "var(--adb-primary-container)", fontWeight: 600 }}>
              WhatsApp Destek
            </a>
            <p style={{ margin: 0, fontSize: 14, color: "var(--adb-muted)" }}>{address}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function StorefrontShell({
  children,
  announcement,
  cartCount,
  footer,
}: {
  children: ReactNode;
  announcement?: string;
  cartCount?: number;
  footer?: {
    phone?: string;
    whatsapp?: string;
    address?: string;
    dealerCode?: string;
  };
}) {
  return (
    <>
      <StorefrontHeader
        announcement={announcement}
        cartCount={cartCount}
        phone={footer?.phone}
        dealerCode={footer?.dealerCode}
      />
      <div className="adb-animate-in">{children}</div>
      <StorefrontFooter {...footer} />
      <CookieConsent />
      <CampaignModalHost />
    </>
  );
}
