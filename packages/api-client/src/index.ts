import type { AuthTokens, ProductSummary } from "@adb/api-types";

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
  getRefreshToken?: () => string | null | undefined;
  onTokensRefreshed?: (tokens: AuthTokens) => void;
  onUnauthorized?: () => void;
};

/** Browser: same-origin (Next rewrite). Server: gateway URL. */
export function getDefaultApiBaseUrl(): string {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
}

export {
  ADMIN_ACCESS_KEY,
  ADMIN_REFRESH_KEY,
  ADMIN_USER_KEY,
  STORE_ACCESS_KEY,
  STORE_REFRESH_KEY,
  STORE_USER_KEY,
  saveAdminSession,
  clearAdminSession,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminUser,
  saveStoreSession,
  clearStoreSession,
  getStoreAccessToken,
  getStoreRefreshToken,
  getStoreUser,
  isAdminRole,
  parseApiError,
} from "./session";
export type { SessionUser, SessionBundle } from "./session";

export type HomeCMS = {
  announcement: string;
  hero: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    imageUrl?: string;
    active: boolean;
  };
  banners: Array<{
    id: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    imageUrl?: string;
    active: boolean;
  }>;
  categoryIds: string[];
  store: {
    dealerCode: string;
    phone: string;
    whatsapp: string;
    address: string;
    branches: string;
  };
};

export type Cart = {
  id: string;
  customerId?: string;
  couponCode?: string;
  items: Array<{
    variantId: string;
    productId?: string;
    name: string;
    sku: string;
    qty: number;
    unitPrice: number;
  }>;
};

export type CustomerProfile = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  title: string;
  line1: string;
  line2?: string;
  city: string;
  district: string;
  postalCode?: string;
  country: string;
  isDefault: boolean;
};

async function request<T>(
  options: ApiClientOptions,
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!headers.has("Content-Type") && init?.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  const token = options.getAccessToken?.();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    const err = new Error("Failed to fetch") as Error & {
      status?: number;
      apiMessage?: string;
    };
    err.status = 0;
    err.apiMessage =
      "API’ye ulaşılamıyor. Gateway (8080) ve ilgili servislerin çalıştığını kontrol edin.";
    throw err;
  }

  if (res.status === 401 && !retried && options.getRefreshToken) {
    const refreshToken = options.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await request<AuthTokens>(
          { ...options, getRefreshToken: undefined },
          "/api/v1/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          },
          true,
        );
        options.onTokensRefreshed?.(refreshed);
        return request<T>(options, path, init, true);
      } catch {
        options.onUnauthorized?.();
      }
    } else {
      options.onUnauthorized?.();
    }
  }

  if (!res.ok) {
    const body = await res.text();
    let apiMessage = body;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(body) as {
        message?: string;
        error?: string;
      };
      apiMessage = parsed.message || parsed.error || body;
      code = parsed.error;
    } catch {
      /* plain text */
    }
    const err = new Error(apiMessage || `API ${res.status}`) as Error & {
      status?: number;
      code?: string;
      apiMessage?: string;
    };
    err.status = res.status;
    err.code = code;
    err.apiMessage = apiMessage;
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function createApiClient(options: ApiClientOptions) {
  return {
    auth: {
      register(body: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
      }) {
        return request<AuthTokens>(options, "/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      login(body: {
        email: string;
        password: string;
        audience?: "customer" | "admin";
      }) {
        return request<AuthTokens>(options, "/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      google(body: { idToken: string; audience: "customer" | "admin" }) {
        return request<AuthTokens>(options, "/api/v1/auth/google", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      refresh(refreshToken: string) {
        return request<AuthTokens>(options, "/api/v1/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      },
      logout(refreshToken?: string) {
        return request<{ ok: boolean }>(options, "/api/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      },
      forgotPassword(email: string) {
        return request<{
          ok: boolean;
          message: string;
          devResetToken?: string;
          devHint?: string;
        }>(options, "/api/v1/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
      },
      resetPassword(token: string, newPassword: string) {
        return request<{ ok: boolean; message: string }>(
          options,
          "/api/v1/auth/reset-password",
          {
            method: "POST",
            body: JSON.stringify({ token, newPassword }),
          },
        );
      },
      me() {
        return request<{
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          roles: string[];
        }>(options, "/api/v1/auth/me");
      },
      listUsers() {
        return request<{
          items: Array<{
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            roles: string[];
          }>;
        }>(options, "/api/v1/admin/users");
      },
      updateUser(id: string, body: { firstName: string; lastName?: string; roles?: string[] }) {
        return request<{
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          roles: string[];
        }>(options, `/api/v1/admin/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      deleteUser(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/admin/users/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
    },
    cms: {
      home() {
        return request<HomeCMS>(options, "/api/v1/cms/home");
      },
      saveHome(body: HomeCMS) {
        return request<HomeCMS>(options, "/api/v1/admin/cms/home", {
          method: "PUT",
          body: JSON.stringify(body),
        });
      },
    },
    products: {
      list(params?: { q?: string; category?: string }) {
        const qs = new URLSearchParams();
        if (params?.q) qs.set("q", params.q);
        if (params?.category) qs.set("category", params.category);
        const q = qs.toString();
        return request<{ items: ProductSummary[]; q?: string; category?: string }>(
          options,
          `/api/v1/products${q ? `?${q}` : ""}`,
        );
      },
      getBySlug(slug: string) {
        return request<ProductSummary>(options, `/api/v1/products/${slug}`);
      },
      create(body: Partial<ProductSummary> & { sku: string; name: string }) {
        return request<ProductSummary>(options, "/api/v1/admin/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      update(id: string, body: Partial<ProductSummary>) {
        return request<ProductSummary>(options, `/api/v1/admin/products/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      delete(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
      listImages(id: string) {
        return request<{
          items: Array<{ id: string; productId: string; url: string; alt?: string; sortOrder: number }>;
        }>(options, `/api/v1/admin/products/${encodeURIComponent(id)}/images`);
      },
      addImage(id: string, body: { url: string; alt?: string; sortOrder?: number }) {
        return request<{ id: string; url: string }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(id)}/images`,
          { method: "POST", body: JSON.stringify(body) },
        );
      },
      uploadImage(id: string, file: File | Blob, alt?: string) {
        const form = new FormData();
        form.append("file", file);
        if (alt) form.append("alt", alt);
        return request<{ id: string; url: string }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(id)}/images`,
          { method: "POST", body: form },
        );
      },
      deleteImage(productId: string, imageId: string) {
        return request<{ ok: boolean }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
          { method: "DELETE" },
        );
      },
      listVariants(id: string) {
        return request<{
          items: Array<{ id: string; productId: string; sku: string; name: string; barcode?: string }>;
        }>(options, `/api/v1/admin/products/${encodeURIComponent(id)}/variants`);
      },
      upsertVariant(
        id: string,
        body: { id?: string; sku: string; name: string; barcode?: string; weightGrams?: number },
      ) {
        return request<{ id: string; sku: string; name: string }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(id)}/variants`,
          { method: "POST", body: JSON.stringify(body) },
        );
      },
      deleteVariant(productId: string, variantId: string) {
        return request<{ ok: boolean }>(
          options,
          `/api/v1/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
          { method: "DELETE" },
        );
      },
    },
    categories: {
      list(params?: { all?: boolean }) {
        const q = params?.all ? "?all=1" : "";
        return request<{
          items: Array<{
            id: string;
            name: string;
            slug: string;
            tech?: string;
            icon?: string;
            sortOrder?: number;
            active?: boolean;
            countHint?: string;
          }>;
        }>(options, `/api/v1/categories${q}`);
      },
      create(body: {
        name: string;
        slug?: string;
        tech?: string;
        icon?: string;
        sortOrder?: number;
        countHint?: string;
      }) {
        return request(options, "/api/v1/admin/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      update(
        id: string,
        body: {
          name: string;
          tech?: string;
          icon?: string;
          sortOrder?: number;
          active?: boolean;
          countHint?: string;
        },
      ) {
        return request(options, `/api/v1/admin/categories/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      delete(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/admin/categories/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
    },
    search: {
      query(params: { q?: string; category?: string }) {
        const qs = new URLSearchParams();
        if (params.q) qs.set("q", params.q);
        if (params.category) qs.set("category", params.category);
        const q = qs.toString();
        return request<{
          items: Array<{
            id: string;
            sku: string;
            name: string;
            slug: string;
            shortDescription?: string;
            status?: string;
            href?: string;
            categoryName?: string;
          }>;
          total: number;
          q: string;
          category: string;
          backend: string;
          categories?: Array<{ id: string; name: string; slug: string }>;
        }>(options, `/api/v1/search${q ? `?${q}` : ""}`);
      },
    },
    pricing: {
      get(variantId: string) {
        return request<{ variantId: string; amount: number; currency: string }>(
          options,
          `/api/v1/pricing/${variantId}`,
        );
      },
      set(variantId: string, amount: number) {
        return request(options, `/api/v1/pricing/${variantId}`, {
          method: "PUT",
          body: JSON.stringify({ amount }),
        });
      },
    },
    inventory: {
      get(variantId: string, warehouse?: string) {
        const q = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : "";
        return request<{
          variantId: string;
          available: number;
          reserved: number;
          saleable: number;
          byWarehouse?: Array<{
            warehouseCode: string;
            warehouseName: string;
            available: number;
            reserved: number;
            saleable: number;
          }>;
        }>(options, `/api/v1/inventory/${variantId}${q}`);
      },
      adjust(variantId: string, available: number, warehouseCode?: string) {
        return request(options, "/api/v1/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({
            variantId,
            available,
            warehouseCode: warehouseCode || "MAIN",
          }),
        });
      },
      transfer(body: {
        variantId: string;
        fromWarehouse: string;
        toWarehouse: string;
        qty: number;
      }) {
        return request(options, "/api/v1/inventory/transfer", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
    },
    cart: {
      create(customerId?: string) {
        return request<Cart>(options, "/api/v1/cart", {
          method: "POST",
          body: JSON.stringify({ customerId }),
        });
      },
      get(cartId: string) {
        return request<Cart>(options, `/api/v1/cart/${cartId}`);
      },
      addItem(
        cartId: string,
        item: {
          variantId: string;
          productId?: string;
          name: string;
          sku: string;
          qty: number;
          unitPrice: number;
        },
      ) {
        return request<Cart>(options, `/api/v1/cart/${cartId}/items`, {
          method: "POST",
          body: JSON.stringify(item),
        });
      },
      setItemQty(cartId: string, variantId: string, qty: number) {
        return request<Cart>(
          options,
          `/api/v1/cart/${cartId}/items/${encodeURIComponent(variantId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ qty }),
          },
        );
      },
      removeItem(cartId: string, variantId: string) {
        return request<Cart>(
          options,
          `/api/v1/cart/${cartId}/items/${encodeURIComponent(variantId)}`,
          { method: "DELETE" },
        );
      },
      setCoupon(cartId: string, code: string) {
        return request<Cart>(options, `/api/v1/cart/${cartId}/coupon`, {
          method: "PUT",
          body: JSON.stringify({ code }),
        });
      },
      merge(guestCartId: string, customerId: string) {
        return request<Cart>(options, "/api/v1/cart/merge", {
          method: "POST",
          body: JSON.stringify({ guestCartId, customerId }),
        });
      },
    },
    customers: {
      ensure(body?: { email?: string; firstName?: string; lastName?: string }) {
        return request<CustomerProfile>(options, "/api/v1/customers/ensure", {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
      },
      me() {
        return request<CustomerProfile>(options, "/api/v1/customers/me");
      },
      updateMe(body: { firstName: string; lastName: string; phone?: string }) {
        return request<CustomerProfile>(options, "/api/v1/customers/me", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      listAddresses() {
        return request<{ items: CustomerAddress[] }>(
          options,
          "/api/v1/customers/me/addresses",
        );
      },
      createAddress(body: {
        title: string;
        line1: string;
        line2?: string;
        city: string;
        district: string;
        postalCode?: string;
        country?: string;
        isDefault?: boolean;
      }) {
        return request<CustomerAddress>(
          options,
          "/api/v1/customers/me/addresses",
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
      },
      updateAddress(
        addressId: string,
        body: {
          title: string;
          line1: string;
          line2?: string;
          city: string;
          district: string;
          postalCode?: string;
          country?: string;
          isDefault?: boolean;
        },
      ) {
        return request<CustomerAddress>(
          options,
          `/api/v1/customers/me/addresses/${encodeURIComponent(addressId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        );
      },
      deleteAddress(addressId: string) {
        return request<{ ok: boolean }>(
          options,
          `/api/v1/customers/me/addresses/${encodeURIComponent(addressId)}`,
          { method: "DELETE" },
        );
      },
    },
    checkout: {
      preview(cartId: string, code?: string) {
        return request<{
          cartId: string;
          subtotal: number;
          shipping: number;
          discount: number;
          total: number;
          currency: string;
          couponCode?: string;
          couponTitle?: string;
        }>(options, "/api/v1/checkout/preview", {
          method: "POST",
          body: JSON.stringify({ cartId, code }),
        });
      },
      create(
        cartId: string,
        body?: {
          customerId?: string;
          customerName?: string;
          customerPhone?: string;
          customerEmail?: string;
          district?: string;
          addressLine?: string;
          city?: string;
          billingName?: string;
          taxNo?: string;
          billingAddress?: string;
          paymentMethod?: string;
          couponCode?: string;
        },
      ) {
        return request<{
          id: string;
          status: string;
          total: number;
          discount?: number;
          couponCode?: string;
          payment?: {
            id: string;
            checkoutUrl?: string;
            status?: string;
          };
        }>(options, "/api/v1/checkout/create", {
          method: "POST",
          body: JSON.stringify({ cartId, ...body }),
        });
      },
    },
    promotions: {
      listCoupons(activeOnly = false) {
        const q = activeOnly ? "?active=1" : "";
        return request<{
          items: Array<{
            id: string;
            code: string;
            title: string;
            description?: string;
            type: string;
            value: number;
            minSubtotal: number;
            maxDiscount: number;
            usageLimit: number;
            usedCount: number;
            active: boolean;
          }>;
        }>(options, `/api/v1/promotions/coupons${q}`);
      },
      createCoupon(body: {
        code: string;
        title: string;
        description?: string;
        type: "percent" | "fixed";
        value: number;
        minSubtotal?: number;
        maxDiscount?: number;
        usageLimit?: number;
      }) {
        return request(options, "/api/v1/promotions/coupons", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      updateCoupon(
        id: string,
        body: {
          code: string;
          title: string;
          description?: string;
          type: "percent" | "fixed";
          value: number;
          minSubtotal?: number;
          maxDiscount?: number;
          usageLimit?: number;
          active?: boolean;
        },
      ) {
        return request(options, `/api/v1/promotions/coupons/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      deleteCoupon(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/promotions/coupons/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
      listCampaigns(activeOnly = false) {
        const q = activeOnly ? "?active=1" : "";
        return request<{
          items: Array<{
            id: string;
            title: string;
            subtitle?: string;
            body: string;
            imageUrl?: string;
            ctaLabel?: string;
            ctaHref?: string;
            productIds?: string[];
            showModal?: boolean;
            active?: boolean;
          }>;
        }>(options, `/api/v1/promotions/campaigns${q}`);
      },
      createCampaign(body: {
        title: string;
        subtitle?: string;
        body?: string;
        imageUrl?: string;
        ctaLabel?: string;
        ctaHref?: string;
        productIds?: string[];
        showModal?: boolean;
      }) {
        return request(options, "/api/v1/promotions/campaigns", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      updateCampaign(
        id: string,
        body: {
          title: string;
          subtitle?: string;
          body?: string;
          imageUrl?: string;
          ctaLabel?: string;
          ctaHref?: string;
          productIds?: string[];
          showModal?: boolean;
          active?: boolean;
        },
      ) {
        return request(options, `/api/v1/promotions/campaigns/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      deleteCampaign(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/promotions/campaigns/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
      validate(code: string, subtotal: number) {
        return request<{
          ok: boolean;
          code: string;
          title: string;
          discount: number;
          total: number;
        }>(options, "/api/v1/promotions/validate", {
          method: "POST",
          body: JSON.stringify({ code, subtotal }),
        });
      },
    },
    wishlist: {
      list(customerId: string) {
        return request<{
          items: Array<{
            id: string;
            productId: string;
            productName: string;
            sku?: string;
            productSlug?: string;
          }>;
        }>(options, `/api/v1/wishlist/${encodeURIComponent(customerId)}`);
      },
      add(
        customerId: string,
        body: { productId: string; productName: string; sku?: string; productSlug?: string },
      ) {
        return request(options, `/api/v1/wishlist/${encodeURIComponent(customerId)}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      remove(customerId: string, productId: string) {
        return request(
          options,
          `/api/v1/wishlist/${encodeURIComponent(customerId)}/${encodeURIComponent(productId)}`,
          { method: "DELETE" },
        );
      },
    },
    reviews: {
      list(productId?: string) {
        const q = productId ? `?productId=${encodeURIComponent(productId)}` : "";
        return request<{
          items: Array<{
            id: string;
            productId: string;
            customerName?: string;
            rating: number;
            title?: string;
            body: string;
            createdAt?: string;
          }>;
          average: number;
          count: number;
        }>(options, `/api/v1/reviews${q}`);
      },
      create(body: {
        productId: string;
        customerId?: string;
        customerName?: string;
        rating: number;
        title?: string;
        body: string;
      }) {
        return request(options, "/api/v1/reviews", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      remove(id: string) {
        return request<{ ok: boolean }>(
          options,
          `/api/v1/reviews/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
    },
    shipments: {
      create(body: { orderId: string; provider?: string }) {
        return request<{
          id: string;
          orderId: string;
          provider: string;
          trackingNumber: string;
          status: string;
        }>(options, "/api/v1/shipments", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      byOrder(orderId: string) {
        return request<{
          id: string;
          orderId: string;
          trackingNumber: string;
          status: string;
          events?: Array<{ status: string; note: string; at: string }>;
        }>(options, `/api/v1/shipments/by-order/${encodeURIComponent(orderId)}`);
      },
      track(trackingNumber: string) {
        return request<{
          id: string;
          orderId: string;
          trackingNumber: string;
          status: string;
          events?: Array<{ status: string; note: string; at: string }>;
        }>(
          options,
          `/api/v1/shipments/track/${encodeURIComponent(trackingNumber)}`,
        );
      },
      updateStatus(id: string, status: string, note?: string) {
        return request(options, `/api/v1/shipments/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status, note }),
        });
      },
    },
    orders: {
      list(params?: { status?: string; customerId?: string }) {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.customerId) qs.set("customerId", params.customerId);
        const q = qs.toString();
        return request<{
          items: Array<Record<string, unknown>>;
          counts: Record<string, number>;
        }>(options, `/api/v1/orders${q ? `?${q}` : ""}`);
      },
      get(id: string) {
        return request<Record<string, unknown>>(options, `/api/v1/orders/${id}`);
      },
      updateStatus(
        id: string,
        body: {
          status: string;
          montageStatus?: string;
          montageNote?: string;
          serviceRef?: string;
          note?: string;
        },
      ) {
        return request(options, `/api/v1/orders/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
    },
    serviceTeams: {
      list(warehouse?: string) {
        const q = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : "";
        return request<{
          items: Array<{
            id: string;
            warehouseCode: string;
            name: string;
            technician: string;
            vehiclePlate: string;
            active: boolean;
          }>;
        }>(options, `/api/v1/service-teams${q}`);
      },
      create(body: {
        warehouseCode: string;
        name: string;
        technician?: string;
        vehiclePlate?: string;
      }) {
        return request<{
          id: string;
          warehouseCode: string;
          name: string;
          technician: string;
          vehiclePlate: string;
          active: boolean;
        }>(options, "/api/v1/service-teams", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      update(
        id: string,
        body: { name?: string; technician?: string; vehiclePlate?: string; active?: boolean },
      ) {
        return request(options, `/api/v1/service-teams/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      remove(id: string) {
        return request(options, `/api/v1/service-teams/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      },
    },
    serviceRoutes: {
      list(warehouse?: string) {
        const q = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : "";
        return request<{
          items: Array<{
            id: string;
            teamId: string;
            warehouseCode: string;
            title: string;
            districtHint: string;
            plannedStops: number;
            doneStops: number;
            nextStop: string;
            routeDate: string;
            status: string;
            teamName: string;
            technician: string;
            vehiclePlate: string;
            tone: "success" | "warn" | "danger";
          }>;
        }>(options, `/api/v1/service-routes${q}`);
      },
      create(body: {
        teamId?: string;
        warehouseCode: string;
        title: string;
        districtHint?: string;
        plannedStops?: number;
        doneStops?: number;
        nextStop?: string;
      }) {
        return request(options, "/api/v1/service-routes", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      update(
        id: string,
        body: {
          title?: string;
          districtHint?: string;
          plannedStops?: number;
          doneStops?: number;
          nextStop?: string;
          status?: string;
          teamId?: string;
        },
      ) {
        return request(options, `/api/v1/service-routes/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      remove(id: string) {
        return request(options, `/api/v1/service-routes/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      },
    },
    payments: {
      provider() {
        return request<{
          provider: string;
          configured: boolean;
          mode: string;
          webhookSecretConfigured?: boolean;
          callbackUrl?: string;
        }>(options, "/api/v1/payments/provider");
      },
      simulateSuccess(paymentId: string) {
        return request(options, `/api/v1/payments/${paymentId}/simulate-success`, {
          method: "POST",
          body: "{}",
        });
      },
      refund(paymentId: string, body?: { amount?: number; reason?: string }) {
        return request<{
          ok: boolean;
          refunded: number;
          status: string;
          orderId: string;
        }>(options, `/api/v1/payments/${paymentId}/refund`, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
      },
      byOrder(orderId: string) {
        return request<{
          id: string;
          status: string;
          checkoutUrl?: string;
          amount: number;
        }>(options, `/api/v1/payments/by-order/${orderId}`);
      },
    },
    notifications: {
      templates() {
        return request<{ items: Array<{ id: string; body: string; title?: string; name?: string }> }>(
          options,
          "/api/v1/notifications/templates",
        );
      },
      inbox(params?: { userId?: string }) {
        const qs = new URLSearchParams();
        if (params?.userId) qs.set("userId", params.userId);
        const q = qs.toString();
        return request<{
          items: Array<{
            id: string;
            userId?: string;
            title: string;
            body: string;
            template?: string;
            read: boolean;
            createdAt: string;
          }>;
        }>(options, `/api/v1/notifications/inbox${q ? `?${q}` : ""}`);
      },
      markRead(id: string) {
        return request<{ ok: boolean }>(options, `/api/v1/notifications/inbox/${encodeURIComponent(id)}/read`, {
          method: "POST",
        });
      },
      send(body: {
        template: string;
        channel?: string;
        recipient?: string;
        userId?: string;
        title?: string;
        data?: Record<string, unknown>;
      }) {
        return request(options, "/api/v1/notifications/send", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
    },
    retail: {
      createTradeIn(body: {
        customerName: string;
        phone: string;
        oldBrand: string;
        oldModel: string;
        oldCondition: string;
        desiredProductSku?: string;
        note?: string;
      }) {
        return request<{
          id: string;
          offeredAmount: number;
          status: string;
          message: string;
        }>(options, "/api/v1/trade-ins", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      listTradeIns() {
        return request<{ items: Array<Record<string, unknown>> }>(
          options,
          "/api/v1/trade-ins",
        );
      },
      updateTradeIn(
        id: string,
        body: { status: string; offeredAmount?: number; note?: string },
      ) {
        return request(options, `/api/v1/trade-ins/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      deleteTradeIn(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/trade-ins/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
      bundles() {
        return request<{
          items: Array<{
            id: string;
            code: string;
            name: string;
            description: string;
            price: number;
            items: Array<{ sku: string; name: string; qty: number }>;
          }>;
        }>(options, "/api/v1/bundles");
      },
      reserveStorage(body: {
        customerName: string;
        phone: string;
        packageId?: string;
        startDate: string;
        endDate: string;
        note?: string;
      }) {
        return request(options, "/api/v1/storage-reservations", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      listStorage() {
        return request<{ items: Array<Record<string, unknown>> }>(
          options,
          "/api/v1/storage-reservations",
        );
      },
      updateStorage(id: string, body: { status: string; note?: string }) {
        return request(options, `/api/v1/storage-reservations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      deleteStorage(id: string) {
        return request<{ ok: boolean; id: string }>(
          options,
          `/api/v1/storage-reservations/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
      },
    },
    warehouses: {
      list() {
        return request<{
          items: Array<{
            id: string;
            name: string;
            code: string;
            city: string;
          }>;
        }>(options, "/api/v1/warehouses");
      },
    },
    marketplace: {
      status(provider?: string) {
        const q = provider ? `?provider=${encodeURIComponent(provider)}` : "";
        return request<{
          provider: string;
          status: string;
          dealerCode: string;
          configured: boolean;
          lastSyncOp: string;
          defaultProvider?: string;
          providers?: Array<{
            provider: string;
            status: string;
            configured: boolean;
            lastSyncOp: string;
          }>;
        }>(options, `/api/v1/marketplace/status${q}`);
      },
      sync(type: string, provider?: string, extra?: { sku?: string; name?: string }) {
        return request<{
          jobId: string;
          type: string;
          status: string;
          provider?: string;
          externalId?: string;
        }>(options, "/api/v1/marketplace/sync", {
          method: "POST",
          body: JSON.stringify({ type, provider, ...extra }),
        });
      },
      jobs() {
        return request<{ items: Array<Record<string, unknown>> }>(
          options,
          "/api/v1/marketplace/sync-jobs",
        );
      },
      mappings() {
        return request<{
          items: Array<{
            id: string;
            sku: string;
            provider: string;
            externalId: string;
          }>;
        }>(options, "/api/v1/marketplace/mappings");
      },
    },
    accounting: {
      createInvoice(body: {
        orderId: string;
        amount: number;
        customerName?: string;
        currency?: string;
      }) {
        return request<{
          id: string;
          orderId: string;
          number: string;
          amount: number;
          status: string;
          pdfUrl: string;
        }>(options, "/api/v1/accounting/invoices", {
          method: "POST",
          body: JSON.stringify(body),
        });
      },
      listInvoices() {
        return request<{
          items: Array<{
            id: string;
            orderId: string;
            number: string;
            customerName?: string;
            taxNo?: string;
            amount: number;
            taxRate?: number;
            taxAmount?: number;
            netAmount?: number;
            status: string;
            eInvoiceStatus?: string;
            eInvoiceUUID?: string;
            pdfUrl: string;
          }>;
        }>(options, "/api/v1/accounting/invoices");
      },
      getInvoice(id: string) {
        return request<{
          id: string;
          orderId: string;
          number: string;
          customerName?: string;
          taxNo?: string;
          amount: number;
          taxRate?: number;
          taxAmount?: number;
          netAmount?: number;
          status: string;
          eInvoiceStatus?: string;
          eInvoiceUUID?: string;
          pdfUrl: string;
        }>(options, `/api/v1/accounting/invoices/${encodeURIComponent(id)}`);
      },
    },
    reports: {
      quotas() {
        return request<{
          items: Array<{
            warehouseCode: string;
            warehouseName: string;
            quota: number;
            achieved: number;
            bonus: number;
            percent: number;
          }>;
          period: string;
        }>(options, "/api/v1/reports/quotas");
      },
      incentives() {
        return request<{
          items: Array<{
            code: string;
            title: string;
            description: string;
            bonus: number;
            active: boolean;
          }>;
        }>(options, "/api/v1/reports/incentives");
      },
    },
    worker: {
      listAbandonedCarts(idleHours?: number) {
        const q = idleHours ? `?idleHours=${idleHours}` : "";
        return request<{
          items: Array<{
            cartId: string;
            customerId?: string;
            itemCount: number;
            updatedAt: string;
            idleHours: number;
          }>;
          count: number;
          idleHours: number;
        }>(options, `/api/v1/worker/abandoned-carts${q}`);
      },
      runAbandonedCarts() {
        return request<{
          ok: boolean;
          checked: number;
          reminded: number;
          idleHours: number;
        }>(options, "/api/v1/worker/abandoned-carts/run", {
          method: "POST",
          body: "{}",
        });
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
