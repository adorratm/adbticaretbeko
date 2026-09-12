"use client";

import { useState } from "react";
import { Button } from "@adb/ui";
import { createStoreApi, getCartId, setCartId } from "../lib/store-api";

export function AddToCartButton({
  productId,
  sku,
  name,
  unitPrice,
  variantId,
}: {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  variantId?: string;
}) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setMsg("");
    try {
      const api = createStoreApi();
      let cartId = getCartId();
      if (!cartId) {
        const cart = await api.cart.create();
        cartId = cart.id;
        setCartId(cartId);
      }
      const vid = variantId || productId;
      await api.cart.addItem(cartId, {
        variantId: vid,
        productId,
        name,
        sku,
        qty: 1,
        unitPrice,
      });
      setMsg("Sepete eklendi");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Button onClick={onClick} disabled={loading || unitPrice <= 0} style={{ width: "100%" }}>
        {loading ? "Ekleniyor..." : "Sepete Ekle"}
      </Button>
      {unitPrice <= 0 ? (
        <span style={{ fontSize: 12, color: "var(--adb-muted)" }}>Fiyat henüz tanımlanmamış</span>
      ) : null}
      {msg ? <span style={{ fontSize: 13, color: "var(--adb-primary)" }}>{msg}</span> : null}
    </div>
  );
}
