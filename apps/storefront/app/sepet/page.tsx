"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@adb/ui";
import { parseApiError, type Cart } from "@adb/api-client";
import { StorefrontShell } from "../../components/site-shell";
import {
  clearCartId,
  createStoreApi,
  formatTRY,
  getCartId,
} from "../../lib/store-api";
import { emitCartChanged } from "../../lib/cart-events";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [preview, setPreview] = useState<{
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    couponTitle?: string;
  } | null>(null);
  const [coupon, setCoupon] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const api = createStoreApi();
    const id = getCartId();
    if (!id) {
      setCart(null);
      setPreview(null);
      setLoading(false);
      return;
    }
    try {
      const [c, p] = await Promise.all([
        api.cart.get(id),
        api.checkout.preview(id).catch(() => null),
      ]);
      const items = await Promise.all(
        (c.items || []).map(async (it) => {
          if (it.productSlug) return it;
          try {
            const res = await api.products.list({ q: it.sku || it.productId });
            const match =
              res.items?.find((p) => p.id === it.productId || p.sku === it.sku) ||
              res.items?.[0];
            if (match?.slug) return { ...it, productSlug: match.slug };
          } catch {
            /* ignore */
          }
          return it;
        }),
      );
      setCart({ ...c, items });
      if (c.couponCode) setCoupon(c.couponCode);
      if (p) {
        setPreview({
          subtotal: p.subtotal,
          shipping: p.shipping,
          discount: p.discount,
          total: p.total,
          couponTitle: p.couponTitle,
        });
      }
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function changeQty(variantId: string, qty: number) {
    const id = getCartId();
    if (!id) return;
    setBusy(variantId);
    setMsg("");
    try {
      const api = createStoreApi();
      const next = await api.cart.setItemQty(id, variantId, qty);
      const merged = {
        ...next,
        items: next.items.map((it) => {
          const prev = cart?.items.find((p) => p.variantId === it.variantId);
          if (it.productSlug || !prev?.productSlug) return it;
          return { ...it, productSlug: prev.productSlug };
        }),
      };
      setCart(merged);
      emitCartChanged({ count: merged.items.reduce((a, i) => a + i.qty, 0) });
      const p = await api.checkout.preview(id);
      setPreview({
        subtotal: p.subtotal,
        shipping: p.shipping,
        discount: p.discount,
        total: p.total,
      });
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function removeItem(variantId: string) {
    await changeQty(variantId, 0);
  }

  async function applyCoupon() {
    const id = getCartId();
    if (!id) return;
    setBusy("coupon");
    setMsg("");
    try {
      const api = createStoreApi();
      await api.cart.setCoupon(id, coupon);
      const p = await api.checkout.preview(id, coupon);
      setPreview({
        subtotal: p.subtotal,
        shipping: p.shipping,
        discount: p.discount,
        total: p.total,
        couponTitle: p.couponTitle,
      });
      if (!p.discount) setMsg("Kupon uygulanamadı veya indirim 0");
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function clearCart() {
    const id = getCartId();
    if (!id || !cart?.items.length) return;
    setBusy("clear");
    try {
      const api = createStoreApi();
      for (const it of cart.items) {
        await api.cart.removeItem(id, it.variantId);
      }
      clearCartId();
      setCart({ id, items: [] });
      setPreview(null);
      emitCartChanged({ count: 0 });
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  const empty = !loading && (!cart || cart.items.length === 0);
  const itemCount = cart?.items.reduce((a, i) => a + i.qty, 0) ?? 0;

  return (
    <StorefrontShell cartCount={itemCount}>
      <main className="adb-container" style={{ padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
              Alışveriş
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>Sepetim</h1>
          </div>
          {!empty ? (
            <button
              type="button"
              className="adb-btn adb-btn-tertiary"
              disabled={busy === "clear"}
              onClick={clearCart}
            >
              Sepeti temizle
            </button>
          ) : null}
        </div>

        {msg ? (
          <Alert tone="error" style={{ marginBottom: 16 }}>
            {msg}
          </Alert>
        ) : null}

        {loading ? (
          <p style={{ color: "var(--adb-muted)" }}>Sepet yükleniyor…</p>
        ) : empty ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background:
                "linear-gradient(160deg, rgba(0,63,135,0.06), transparent 60%), var(--adb-surface-low)",
              borderRadius: 16,
              border: "1px solid var(--adb-border-subtle)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--adb-primary)", opacity: 0.7 }}>
              shopping_cart
            </span>
            <h2 style={{ marginTop: 12 }}>Sepetiniz boş</h2>
            <p style={{ color: "var(--adb-muted)", maxWidth: 420, margin: "0 auto 20px" }}>
              Beko ürünlerini keşfedin, sepete ekleyin ve yetkili servis montajıyla teslim alın.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/arama" className="adb-btn adb-btn-primary" style={{ textDecoration: "none" }}>
                Ürün ara
              </Link>
              <Link href="/kategori" className="adb-btn adb-btn-tertiary" style={{ textDecoration: "none" }}>
                Ürün grupları
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.7fr)",
              alignItems: "start",
            }}
            className="adb-cart-grid"
          >
            <div className="adb-card adb-stagger" style={{ padding: 0, overflow: "hidden" }}>
              {cart!.items.map((it) => {
                const href = it.productSlug ? `/urun/${it.productSlug}` : null;
                return (
                <div
                  key={it.variantId}
                  className="adb-animate-in adb-cart-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px minmax(0, 1fr) auto",
                    gap: 16,
                    padding: "18px 20px",
                    borderBottom: "1px solid var(--adb-border-subtle)",
                    alignItems: "center",
                  }}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="adb-cart-row-thumb"
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 8,
                        background: "linear-gradient(180deg,#f7fafc,#eef3f7)",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--adb-border-subtle)",
                        textDecoration: "none",
                      }}
                      aria-label={`${it.name} ürün sayfası`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--adb-primary)" }}>
                        kitchen
                      </span>
                    </Link>
                  ) : (
                    <div
                      className="adb-cart-row-thumb"
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 8,
                        background: "linear-gradient(180deg,#f7fafc,#eef3f7)",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--adb-border-subtle)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--adb-primary)" }}>
                        kitchen
                      </span>
                    </div>
                  )}
                  <div>
                    {href ? (
                      <Link
                        href={href}
                        style={{
                          fontWeight: 700,
                          fontFamily: "var(--adb-font-display)",
                          fontSize: 16,
                          color: "inherit",
                          textDecoration: "none",
                        }}
                      >
                        {it.name}
                      </Link>
                    ) : (
                      <div style={{ fontWeight: 700, fontFamily: "var(--adb-font-display)", fontSize: 16 }}>{it.name}</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--adb-muted)", marginTop: 4, letterSpacing: "0.03em" }}>
                      SKU {it.sku} · Ücretsiz yetkili servis montajı
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="adb-pdp-chip adb-pdp-chip-muted" style={{ fontSize: 10 }}>
                        Orijinal Beko
                      </span>
                      <span className="adb-pdp-chip adb-pdp-chip-muted" style={{ fontSize: 10 }}>
                        3+4 garanti
                      </span>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: "1px solid var(--adb-border-subtle)",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          className="adb-btn adb-btn-tertiary"
                          style={{ height: 36, borderRadius: 0, border: "none" }}
                          disabled={busy === it.variantId || it.qty <= 1}
                          onClick={() => changeQty(it.variantId, it.qty - 1)}
                          aria-label="Azalt"
                        >
                          −
                        </button>
                        <span style={{ minWidth: 36, textAlign: "center", fontWeight: 700 }}>{it.qty}</span>
                        <button
                          type="button"
                          className="adb-btn adb-btn-tertiary"
                          style={{ height: 36, borderRadius: 0, border: "none" }}
                          disabled={busy === it.variantId}
                          onClick={() => changeQty(it.variantId, it.qty + 1)}
                          aria-label="Artır"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.variantId)}
                        disabled={busy === it.variantId}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--adb-tertiary)",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                  <div className="adb-cart-row-price" style={{ textAlign: "right", minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontFeatureSettings: '"tnum" 1', fontFamily: "var(--adb-font-display)", fontSize: 18, color: "var(--adb-primary-deep)" }}>
                      {formatTRY(it.unitPrice * it.qty)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--adb-muted)", marginTop: 4 }}>
                      {formatTRY(it.unitPrice)} / adet
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            <aside className="adb-card" style={{ padding: 20, position: "sticky", top: 96 }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Sipariş özeti</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  className="adb-input"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Kupon kodu"
                  style={{ flex: 1, height: 40 }}
                />
                <button
                  type="button"
                  className="adb-btn adb-btn-tertiary"
                  disabled={busy === "coupon"}
                  onClick={applyCoupon}
                  style={{ height: 40 }}
                >
                  Uygula
                </button>
              </div>
              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--adb-muted)" }}>Ara toplam</span>
                  <strong>{formatTRY(preview?.subtotal ?? 0)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--adb-muted)" }}>Kargo / montaj</span>
                  <strong>{preview?.shipping ? formatTRY(preview.shipping) : "Ücretsiz"}</strong>
                </div>
                {preview?.discount ? (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#065f46" }}>
                    <span>İndirim{preview.couponTitle ? ` (${preview.couponTitle})` : ""}</span>
                    <strong>-{formatTRY(preview.discount)}</strong>
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 10,
                    borderTop: "1px solid var(--adb-border-subtle)",
                    fontSize: 16,
                  }}
                >
                  <span>Toplam</span>
                  <strong>{formatTRY(preview?.total ?? 0)}</strong>
                </div>
              </div>
              <Button
                style={{ width: "100%", marginTop: 16 }}
                onClick={() => router.push("/odeme")}
              >
                Ödemeye geç
              </Button>
              <Link
                href="/"
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--adb-primary)",
                }}
              >
                Alışverişe devam et
              </Link>
              <p style={{ fontSize: 12, color: "var(--adb-muted)", marginBottom: 0, marginTop: 14 }}>
                Yetkili servis montajı ve resmi garanti dahildir.
              </p>
            </aside>
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}
