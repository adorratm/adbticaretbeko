"use client";

import {
  createApiClient,
  getDefaultApiBaseUrl,
  getStoreAccessToken,
  getStoreRefreshToken,
  saveStoreSession,
  type ApiClientOptions,
} from "@adb/api-client";

export function createStoreApi(extra?: Partial<ApiClientOptions>) {
  return createApiClient({
    baseUrl: getDefaultApiBaseUrl(),
    getAccessToken: () => getStoreAccessToken(),
    getRefreshToken: () => getStoreRefreshToken(),
    onTokensRefreshed: (tokens) => saveStoreSession(tokens),
    ...extra,
  });
}

export function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format((kurus || 0) / 100);
}

export const CART_ID_KEY = "adb_cart_id";

export function getCartId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_ID_KEY);
}

export function setCartId(id: string) {
  localStorage.setItem(CART_ID_KEY, id);
}

export function clearCartId() {
  localStorage.removeItem(CART_ID_KEY);
}

/** Misafir sepetini üye sepetine birleştirir; başarılıysa local cart id güncellenir. */
export async function mergeGuestCartAfterLogin(customerId?: string | null) {
  if (typeof window === "undefined" || !customerId) return null;
  const guestId = getCartId();
  if (!guestId || !guestId.startsWith("guest:")) {
    if (!guestId) {
      const created = await createStoreApi().cart.create(customerId);
      setCartId(created.id);
      return created;
    }
    return null;
  }
  try {
    const merged = await createStoreApi().cart.merge(guestId, customerId);
    setCartId(merged.id);
    return merged;
  } catch {
    // Merge başarısızsa üye sepetine geç; misafir sepeti kaybolmasın diye id'yi tutma
    try {
      const created = await createStoreApi().cart.create(customerId);
      setCartId(created.id);
      return created;
    } catch {
      return null;
    }
  }
}

