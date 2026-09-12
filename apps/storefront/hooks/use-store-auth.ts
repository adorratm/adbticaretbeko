"use client";

import { useEffect, useState } from "react";
import { getStoreAccessToken, getStoreUser } from "@adb/api-client";

export type StoreAuthState = {
  ready: boolean;
  loggedIn: boolean;
  email: string | null;
  userId: string | null;
};

function readAuth(): Omit<StoreAuthState, "ready"> {
  const user = getStoreUser();
  const token = getStoreAccessToken();
  const loggedIn = !!(token || user);
  return {
    loggedIn,
    email: user?.email ?? (token ? "Hesabım" : null),
    userId: user?.userId ?? null,
  };
}

/** Stable auth snapshot — avoids Giriş/Hesabım flicker on route changes. */
export function useStoreAuth(): StoreAuthState {
  const [state, setState] = useState<StoreAuthState>(() => ({
    ready: false,
    loggedIn: false,
    email: null,
    userId: null,
  }));

  useEffect(() => {
    function sync() {
      setState({ ready: true, ...readAuth() });
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("adb-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("adb-auth-change", sync);
    };
  }, []);

  return state;
}
