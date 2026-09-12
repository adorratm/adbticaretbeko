"use client";

/** Sepet güncellemelerini header ve diğer bileşenlere yayınlar. */
export const CART_CHANGED_EVENT = "adb:cart-changed";

export function emitCartChanged(detail?: { count?: number }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: detail || {} }));
}

export async function fetchCartItemCount(): Promise<number> {
  if (typeof window === "undefined") return 0;
  try {
    const { createStoreApi, getCartId } = await import("../lib/store-api");
    const id = getCartId();
    if (!id) return 0;
    const cart = await createStoreApi().cart.get(id);
    return (cart.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  } catch {
    return 0;
  }
}
