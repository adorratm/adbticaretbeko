"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@adb/ui";
import { getStoreUser, parseApiError } from "@adb/api-client";
import { AccountShell } from "../../../components/account-shell";
import { createStoreApi } from "../../../lib/store-api";

type WishItem = {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  productSlug?: string;
};

export default function FavoritesPage() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const api = createStoreApi();
    const user = getStoreUser();
    const profile = await api.customers.me().catch(() =>
      api.customers.ensure({ email: user?.email, firstName: "Müşteri", lastName: "-" }),
    );
    const res = await api.wishlist.list(profile.id);
    setItems(res.items);
  }

  useEffect(() => {
    load()
      .catch((e) => setMsg(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  async function remove(productId: string) {
    try {
      const api = createStoreApi();
      const user = getStoreUser();
      const profile = await api.customers.me().catch(() =>
        api.customers.ensure({ email: user?.email, firstName: "Müşteri", lastName: "-" }),
      );
      await api.wishlist.remove(profile.id, productId);
      await load();
    } catch (e) {
      setMsg(parseApiError(e));
    }
  }

  return (
    <AccountShell title="Favorilerim">
      {msg ? (
        <Alert tone="error" style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      {loading ? (
        <p style={{ color: "var(--adb-muted)" }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="adb-card" style={{ padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--adb-muted)" }}>Favori listeniz boş.</p>
          <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
            Ürünlere göz at
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it) => {
            const href = it.productSlug ? `/urun/${it.productSlug}` : `/arama?q=${encodeURIComponent(it.sku || it.productName)}`;
            return (
              <div key={it.id} className="adb-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.productName}</div>
                  <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{it.sku}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={href} className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                    Gör
                  </Link>
                  <Button type="button" onClick={() => remove(it.productId)}>
                    Kaldır
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
