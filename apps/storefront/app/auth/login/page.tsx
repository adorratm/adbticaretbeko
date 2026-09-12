"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createApiClient,
  getStoreAccessToken,
  parseApiError,
  saveStoreSession,
} from "@adb/api-client";
import { Alert, Button, Field, Input } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";
import { Suspense } from "react";
import { mergeGuestCartAfterLogin } from "../../../lib/store-api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [cfgLoaded, setCfgLoaded] = useState(false);
  // Same-origin by default; /api/v1/* proxied to gateway via next.config rewrite
  const [baseUrl, setBaseUrl] = useState("");
  const baseUrlRef = useRef(baseUrl);
  const googleBtn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  useEffect(() => {
    if (getStoreAccessToken()) router.replace(nextPath);
  }, [router, nextPath]);

  useEffect(() => {
    fetch("/api/public-config")
      .then((r) => r.json())
      .then((cfg: { googleClientId?: string; apiBaseUrl?: string }) => {
        if (cfg.googleClientId) setClientId(String(cfg.googleClientId).trim());
        if (typeof cfg.apiBaseUrl === "string") setBaseUrl(cfg.apiBaseUrl);
      })
      .catch(() => undefined)
      .finally(() => setCfgLoaded(true));
  }, []);

  useEffect(() => {
    if (!clientId || !googleBtn.current) return;
    let cancelled = false;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (cancelled || !googleBtn.current) return;
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential: string }) => {
          try {
            const api = createApiClient({ baseUrl: baseUrlRef.current });
            const tokens = await api.auth.google({
              idToken: resp.credential,
              audience: "customer",
            });
            saveStoreSession(tokens);
            await mergeGuestCartAfterLogin(tokens.userId);
            setTone("success");
            setMsg("Google ile giriş başarılı");
            router.replace(nextPath);
          } catch (e) {
            setTone("error");
            setMsg(parseApiError(e));
          }
        },
      });
      googleBtn.current.innerHTML = "";
      window.google?.accounts.id.renderButton(googleBtn.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [clientId, router, nextPath]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createApiClient({ baseUrl: baseUrlRef.current });
      const tokens = await api.auth.login({ email, password, audience: "customer" });
      saveStoreSession(tokens);
      await mergeGuestCartAfterLogin(tokens.userId);
      setTone("success");
      setMsg("Giriş başarılı");
      router.replace(nextPath);
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StorefrontShell>
      <main style={{ maxWidth: 440, margin: "48px auto", padding: "0 24px 64px" }}>
        <div className="adb-card adb-animate-in" style={{ padding: 28 }}>
          <h1 style={{ marginTop: 0 }}>Giriş Yap</h1>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <Field label="E-posta">
              <Input type="email" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Şifre">
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Giriş…" : "Giriş"}
            </Button>
          </form>
          <p style={{ fontSize: 13, margin: "10px 0 0" }}>
            <Link href="/auth/sifremi-unuttum" style={{ color: "var(--adb-primary)", fontWeight: 600 }}>
              Şifremi unuttum
            </Link>
          </p>
          <div style={{ margin: "16px 0", textAlign: "center", color: "var(--adb-muted)", fontSize: 13 }}>veya</div>
          <div ref={googleBtn} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />
          {!cfgLoaded ? (
            <p style={{ fontSize: 11, color: "var(--adb-outline)", marginTop: 8 }}>Google yapılandırması yükleniyor…</p>
          ) : !clientId ? (
            <Alert tone="warning" style={{ marginTop: 12 }}>
              Google Client ID yüklenemedi. Dev sunucusunu yeniden başlatın; Google Cloud’da Authorized JavaScript origins’a
              http://localhost:3000 ekleyin.
            </Alert>
          ) : (
            <p style={{ fontSize: 11, color: "var(--adb-outline)", marginTop: 8 }}>
              Google OAuth aktif · origins: localhost:3000 · API: same-origin proxy
            </p>
          )}
          {msg ? (
            <Alert tone={tone} style={{ marginTop: 12 }}>
              {msg}
            </Alert>
          ) : null}
          <p style={{ fontSize: 13, marginBottom: 0 }}>
            Hesabınız yok mu?{" "}
            <Link href="/auth/register" style={{ color: "var(--adb-primary)", fontWeight: 600 }}>
              Kayıt ol
            </Link>
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
