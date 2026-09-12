import type { AuthTokens } from "@adb/api-types";

export const ADMIN_ACCESS_KEY = "adb_admin_token";
export const ADMIN_REFRESH_KEY = "adb_admin_refresh";
export const ADMIN_USER_KEY = "adb_admin_user";
export const STORE_ACCESS_KEY = "adb_access_token";
export const STORE_REFRESH_KEY = "adb_refresh_token";
export const STORE_USER_KEY = "adb_user";

export type SessionUser = {
  userId?: string;
  email?: string;
  roles?: string[];
};

export type SessionBundle = AuthTokens & SessionUser;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function saveAdminSession(tokens: SessionBundle) {
  if (!canUseStorage()) return;
  localStorage.setItem(ADMIN_ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(ADMIN_REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(
    ADMIN_USER_KEY,
    JSON.stringify({
      userId: tokens.userId,
      email: tokens.email,
      roles: tokens.roles,
    } satisfies SessionUser),
  );
  window.dispatchEvent(new Event("adb-auth-change"));
}

export function clearAdminSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(ADMIN_ACCESS_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  window.dispatchEvent(new Event("adb-auth-change"));
}

export function getAdminAccessToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ADMIN_ACCESS_KEY);
}

export function getAdminRefreshToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ADMIN_REFRESH_KEY);
}

export function getAdminUser(): SessionUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveStoreSession(tokens: SessionBundle) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORE_ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(STORE_REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(
    STORE_USER_KEY,
    JSON.stringify({
      userId: tokens.userId,
      email: tokens.email,
      roles: tokens.roles,
    } satisfies SessionUser),
  );
  window.dispatchEvent(new Event("adb-auth-change"));
}

export function clearStoreSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(STORE_ACCESS_KEY);
  localStorage.removeItem(STORE_REFRESH_KEY);
  localStorage.removeItem(STORE_USER_KEY);
  window.dispatchEvent(new Event("adb-auth-change"));
}

export function getStoreAccessToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(STORE_ACCESS_KEY);
}

export function getStoreRefreshToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(STORE_REFRESH_KEY);
}

export function getStoreUser(): SessionUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(STORE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function isAdminRole(roles?: string[]) {
  return Boolean(roles?.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"));
}

export function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return "Beklenmeyen bir hata oluştu";
  const withStatus = err as Error & { status?: number; code?: string; apiMessage?: string };
  if (withStatus.apiMessage) return withStatus.apiMessage;
  const m = err.message;
  const jsonStart = m.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(m.slice(jsonStart)) as {
        message?: string;
        error?: string;
      };
      if (parsed.message) return parsed.message;
      if (parsed.error) return parsed.error;
    } catch {
      /* ignore */
    }
  }
  if (withStatus.status === 0 || m.includes("Failed to fetch")) {
    return "API’ye ulaşılamıyor. Gateway (8080) ve ilgili servislerin çalıştığını kontrol edin.";
  }
  return m.replace(/^API \d+:\s*/, "") || "İşlem başarısız";
}
