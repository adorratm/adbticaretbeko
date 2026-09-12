import {
  clearAdminSession,
  createApiClient,
  getAdminAccessToken,
  getAdminRefreshToken,
  getAdminUser,
  saveAdminSession,
} from "@adb/api-client";

export function createAdminApi() {
  return createApiClient({
    baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
    getAccessToken: () => getAdminAccessToken(),
    getRefreshToken: () => getAdminRefreshToken(),
    onTokensRefreshed: (tokens) => {
      saveAdminSession({
        ...tokens,
        ...getAdminUser(),
        email: tokens.email ?? getAdminUser()?.email,
        roles: tokens.roles ?? getAdminUser()?.roles,
        userId: tokens.userId ?? getAdminUser()?.userId,
      });
    },
    onUnauthorized: () => {
      clearAdminSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    },
  });
}
