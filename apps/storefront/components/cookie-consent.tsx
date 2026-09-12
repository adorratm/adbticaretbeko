"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "adb_cookie_consent_v1";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function accept(all: boolean) {
    try {
      localStorage.setItem(KEY, all ? "all" : "necessary");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="adb-cookie-banner adb-animate-fade"
      role="dialog"
      aria-label="Çerez bildirimi"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 90,
        maxWidth: 560,
        margin: "0 auto",
        background: "#0f172a",
        color: "#f8fafc",
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "0 18px 40px rgba(15,23,42,.35)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>
        Deneyimi iyileştirmek için zorunlu ve analitik çerezler kullanıyoruz. Detaylar için{" "}
        <Link href="/cerez-politikasi" style={{ color: "#93c5fd", fontWeight: 700 }}>
          Çerez Politikası
        </Link>{" "}
        ve{" "}
        <Link href="/kvkk" style={{ color: "#93c5fd", fontWeight: 700 }}>
          KVKK
        </Link>
        .
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="adb-btn adb-btn-primary" style={{ height: 40 }} onClick={() => accept(true)}>
          Tümünü kabul et
        </button>
        <button
          type="button"
          className="adb-btn"
          style={{ height: 40, background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}
          onClick={() => accept(false)}
        >
          Yalnızca zorunlu
        </button>
      </div>
    </div>
  );
}
