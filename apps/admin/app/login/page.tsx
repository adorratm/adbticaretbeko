"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createApiClient,
  getAdminAccessToken,
  isAdminRole,
  parseApiError,
  saveAdminSession,
} from "@adb/api-client";
import { Alert, Button, Field, Input } from "@adb/ui";

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

export default function AdminLoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const baseUrlRef = useRef(baseUrl);
  const googleBtn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  useEffect(() => {
    if (getAdminAccessToken()) router.replace("/");
  }, [router]);

  useEffect(() => {
    fetch("/api/public-config")
      .then((r) => r.json())
      .then((cfg: { googleClientId?: string; apiBaseUrl?: string }) => {
        if (cfg.googleClientId) setClientId(cfg.googleClientId.trim());
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
              audience: "admin",
            });
            if (!isAdminRole(tokens.roles)) {
              setTone("error");
              setMsg("Bu Google hesabı admin listesinde değil.");
              return;
            }
            saveAdminSession(tokens);
            setTone("success");
            setMsg("Giriş başarılı");
            router.replace("/");
          } catch (e) {
            setTone("error");
            setMsg(parseApiError(e));
          }
        },
      });
      googleBtn.current.innerHTML = "";
      window.google?.accounts.id.renderButton(googleBtn.current, {
        theme: "filled_blue",
        size: "large",
        width: 320,
      });
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createApiClient({ baseUrl: baseUrlRef.current });
      const tokens = await api.auth.login({ email, password, audience: "admin" });
      if (!isAdminRole(tokens.roles)) {
        setTone("error");
        setMsg("Bu hesap admin paneline yetkili değil.");
        return;
      }
      saveAdminSession(tokens);
      setTone("success");
      setMsg("Giriş başarılı");
      router.replace("/");
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 500px at 10% -10%, rgba(0,86,179,0.18), transparent), var(--adb-surface)",
      }}
    >
      <div className="adb-card adb-animate-in" style={{ width: "100%", maxWidth: 420, padding: 28 }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: "var(--adb-secondary-navy, var(--adb-primary))" }}>ADB Admin</div>
        <p style={{ fontSize: 13, color: "var(--adb-muted)", marginTop: 6 }}>
          Beko bayi paneli — Google allowlist veya yetkili e-posta/şifre
        </p>
        <div ref={googleBtn} style={{ display: "flex", justifyContent: "center", minHeight: 44, margin: "16px 0" }} />
        {!cfgLoaded ? (
          <p style={{ fontSize: 11, color: "var(--adb-outline)", marginBottom: 12 }}>Google yapılandırması yükleniyor…</p>
        ) : !clientId ? (
          <Alert tone="warning" style={{ marginBottom: 12 }}>
            Google Client ID yüklenemedi. Dev sunucusunu yeniden başlatın; Google Cloud origins’a http://localhost:3001 ekleyin.
          </Alert>
        ) : (
          <p style={{ fontSize: 11, color: "var(--adb-outline)", marginBottom: 12 }}>
            Google OAuth aktif · origins: localhost:3001 · API: same-origin proxy
          </p>
        )}
        <form onSubmit={passwordLogin} style={{ display: "grid", gap: 12 }}>
          <Field label="E-posta">
            <Input type="email" placeholder="admin@adbticaret.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Şifre">
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "E-posta ile giriş"}
          </Button>
        </form>
        {msg ? (
          <Alert tone={tone} style={{ marginTop: 14 }}>
            {msg}
          </Alert>
        ) : null}
      </div>
    </main>
  );
}
