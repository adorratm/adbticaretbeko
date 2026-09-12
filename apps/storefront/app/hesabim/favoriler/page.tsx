"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, ProductCard } from "@adb/ui";
import { getStoreUser, parseApiError } from "@adb/api-client";
import { AccountShell } from "../../../components/account-shell";
import { createStoreApi, formatTRY } from "../../../lib/store-api";

type WishItem = {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  productSlug?: string;
  imageUrl?: string;
  price?: number;
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
    const base = (res.items || []) as WishItem[];
    const enriched = await Promise.all(
      base.map(async (it) => {
        if (!it.productSlug) return it;
        try {
          const p = await api.products.getBySlug(it.productSlug);
          const img = Array.isArray(p.images) && p.images[0] ? String((p.images[0] as { url?: string }).url || "") : "";
          let price = it.price;
          try {
            price = (await api.pricing.get(p.id)).amount;
          } catch {
            /* keep wishlist price */
          }
          return {
            ...it,
            imageUrl: img || it.imageUrl,
            price,
            productName: p.name || it.productName,
            sku: p.sku || it.sku,
          };
        } catch {
          return it;
        }
      }),
    );
    setItems(enriched);
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
        <div className="adb-card adb-animate-in" style={{ padding: 36, textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)" }}>
            favorite
          </span>
          <h3 style={{ fontFamily: "var(--adb-font-display)", marginBottom: 8 }}>Favori listeniz boş</h3>
          <p style={{ color: "var(--adb-muted)", maxWidth: 400, margin: "0 auto 18px" }}>
            Beğendiğiniz Beko ürünlerini favorilere ekleyin; fiyat ve stok değişiminde hızlıca ulaşın.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
              Ürün ara
            </Link>
            <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
              Kampanyalar
            </Link>
          </div>
        </div>
      ) : (
        <div className="adb-stagger" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {items.map((it) => {
            const href = it.productSlug
              ? `/urun/${it.productSlug}`
              : `/arama?q=${encodeURIComponent(it.sku || it.productName)}`;
            return (
              <ProductCard
                key={it.id}
                href={href}
                sku={it.sku || it.productId.slice(0, 8)}
                title={it.productName}
                imageUrl={it.imageUrl}
                priceLabel={typeof it.price === "number" ? formatTRY(it.price) : undefined}
                promoLabel="Favori"
                action={
                  <Button type="button" variant="tertiary" style={{ height: 36, width: "100%" }} onClick={() => remove(it.productId)}>
                    Kaldır
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}
