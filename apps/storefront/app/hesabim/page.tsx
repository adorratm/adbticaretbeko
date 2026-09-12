"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@adb/ui";
import { getStoreUser, parseApiError, type CustomerProfile } from "@adb/api-client";
import { AccountShell } from "../../components/account-shell";
import { createStoreApi, formatTRY } from "../../lib/store-api";

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ orders: 0, open: 0, spent: 0, wishlist: 0 });

  useEffect(() => {
    const api = createStoreApi();
    const user = getStoreUser();
    api.customers
      .me()
      .catch(() =>
        api.customers.ensure({
          email: user?.email,
          firstName: "Müşteri",
          lastName: "-",
        }),
      )
      .then(async (p) => {
        setProfile(p);
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setPhone(p.phone || "");
        const [orders, wish] = await Promise.all([
          api.orders.list({ customerId: p.id }).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
          api.wishlist.list(p.id).catch(() => ({ items: [] as unknown[] })),
        ]);
        const items = orders.items || [];
        const spent = items.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const open = items.filter((o) => !["DELIVERED", "MONTAJ_TAMAMLANDI", "CANCELLED"].includes(String(o.status))).length;
        setStats({ orders: items.length, open, spent, wishlist: wish.items?.length || 0 });
      })
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createStoreApi();
      const p = await api.customers.updateMe({ firstName, lastName, phone });
      setProfile(p);
      setTone("success");
      setMsg("Profil güncellendi");
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    { href: "/hesabim/siparisler", icon: "package_2", title: "Siparişlerim", body: `${stats.open} aktif · ${stats.orders} toplam` },
    { href: "/hesabim/favoriler", icon: "favorite", title: "Favoriler", body: `${stats.wishlist} ürün` },
    { href: "/hesabim/adresler", icon: "home", title: "Adreslerim", body: "Teslimat & fatura" },
    { href: "/hesabim/bildirimler", icon: "notifications", title: "Bildirimler", body: "Kampanya ve servis" },
    { href: "/kargo-takip", icon: "local_shipping", title: "Kargo takip", body: "Takip numarası ile" },
    { href: "/takas", icon: "published_with_changes", title: "Takas teklifi", body: "Eski cihazınıza değer" },
  ];

  return (
    <AccountShell title="Hesabım">
      <div className="adb-stagger" style={{ display: "grid", gap: 20 }}>
        <div
          className="adb-animate-in"
          style={{
            padding: "22px 24px",
            background: "linear-gradient(120deg, #005f8a, #0083be)",
            color: "#fff",
            borderRadius: 10,
          }}
        >
          <div className="adb-label-sm" style={{ color: "#b3e5fc" }}>
            Hoş geldiniz
          </div>
          <h2 style={{ margin: "6px 0 4px", fontFamily: "var(--adb-font-display)", fontSize: 26 }}>
            {firstName || "Müşteri"} {lastName}
          </h2>
          <p style={{ margin: 0, opacity: 0.9 }}>{profile?.email || getStoreUser()?.email || "—"}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.orders}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Sipariş</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{stats.open}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Aktif</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{formatTRY(stats.spent)}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Toplam alışveriş</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="adb-animate-in"
              style={{
                padding: 16,
                background: "#fff",
                border: "1px solid var(--adb-border-subtle)",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                transition: "transform .2s ease, box-shadow .2s ease",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)", fontSize: 28 }}>
                {q.icon}
              </span>
              <div style={{ fontWeight: 700, marginTop: 8 }}>{q.title}</div>
              <div style={{ fontSize: 12, color: "var(--adb-muted)", marginTop: 4 }}>{q.body}</div>
            </Link>
          ))}
        </div>

        <div className="adb-card adb-animate-in" style={{ padding: 24, maxWidth: 560 }}>
          <h3 style={{ marginTop: 0, fontFamily: "var(--adb-font-display)" }}>Profil bilgileri</h3>
          <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 14 }}>
            {profile?.email || getStoreUser()?.email || "—"}
          </p>
          <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
            <Field label="Ad">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Field>
            <Field label="Soyad">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Field>
            <Field label="Telefon">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </form>
          {msg ? (
            <Alert tone={tone} style={{ marginTop: 14 }}>
              {msg}
            </Alert>
          ) : null}
        </div>
      </div>
    </AccountShell>
  );
}
