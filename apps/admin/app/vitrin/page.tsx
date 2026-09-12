"use client";

import { useEffect, useState } from "react";
import { Button } from "@adb/ui";
import { createApiClient, type HomeCMS } from "@adb/api-client";
import { AdminShell } from "../../components/admin-shell";

export default function VitrinPage() {
  const [home, setHome] = useState<HomeCMS | null>(null);
  const [msg, setMsg] = useState("");

  const api = () =>
    createApiClient({
      baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
      getAccessToken: () => localStorage.getItem("adb_admin_token"),
    });

  useEffect(() => {
    api()
      .cms.home()
      .then(setHome)
      .catch((e) => setMsg(e instanceof Error ? e.message : "CMS yüklenemedi"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!home) return;
    try {
      const headers: HeadersInit = {};
      if (!localStorage.getItem("adb_admin_token")) {
        (headers as Record<string, string>)["X-Dev-Admin"] = "1";
      }
      const res = await fetch(
        `${typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080")}/api/v1/admin/cms/home`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(localStorage.getItem("adb_admin_token")
              ? { Authorization: `Bearer ${localStorage.getItem("adb_admin_token")}` }
              : { "X-Dev-Admin": "1" }),
          },
          body: JSON.stringify(home),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setMsg("Vitrin kaydedildi");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Kayıt hatası");
    }
  }

  if (!home) {
    return (
      <AdminShell title="Vitrin / Mağaza">
        <p>{msg || "Yükleniyor..."}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Vitrin / Mağaza">
      <form className="adb-card" style={{ padding: 20, display: "grid", gap: 12, maxWidth: 720 }} onSubmit={save}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Duyuru şeridi</h2>
        <input
          className="adb-input"
          value={home.announcement}
          onChange={(e) => setHome({ ...home, announcement: e.target.value })}
        />
        <h2 style={{ margin: "12px 0 0", fontSize: 16 }}>Hero</h2>
        <input className="adb-input" placeholder="Başlık" value={home.hero.title} onChange={(e) => setHome({ ...home, hero: { ...home.hero, title: e.target.value } })} />
        <textarea
          className="adb-input"
          style={{ height: 80, paddingTop: 10 }}
          value={home.hero.subtitle}
          onChange={(e) => setHome({ ...home, hero: { ...home.hero, subtitle: e.target.value } })}
        />
        <input className="adb-input" placeholder="CTA label" value={home.hero.ctaLabel} onChange={(e) => setHome({ ...home, hero: { ...home.hero, ctaLabel: e.target.value } })} />
        <input className="adb-input" placeholder="CTA href" value={home.hero.ctaHref} onChange={(e) => setHome({ ...home, hero: { ...home.hero, ctaHref: e.target.value } })} />
        <h2 style={{ margin: "12px 0 0", fontSize: 16 }}>Mağaza iletişimi</h2>
        <input className="adb-input" placeholder="Bayi no" value={home.store.dealerCode} onChange={(e) => setHome({ ...home, store: { ...home.store, dealerCode: e.target.value } })} />
        <input className="adb-input" placeholder="Telefon" value={home.store.phone} onChange={(e) => setHome({ ...home, store: { ...home.store, phone: e.target.value } })} />
        <input className="adb-input" placeholder="WhatsApp" value={home.store.whatsapp} onChange={(e) => setHome({ ...home, store: { ...home.store, whatsapp: e.target.value } })} />
        <input className="adb-input" placeholder="Adres" value={home.store.address} onChange={(e) => setHome({ ...home, store: { ...home.store, address: e.target.value } })} />
        <input className="adb-input" placeholder="Şubeler" value={home.store.branches} onChange={(e) => setHome({ ...home, store: { ...home.store, branches: e.target.value } })} />
        <Button type="submit">Kaydet</Button>
        {msg ? <p style={{ color: "var(--adb-primary)", fontSize: 13 }}>{msg}</p> : null}
      </form>
    </AdminShell>
  );
}
