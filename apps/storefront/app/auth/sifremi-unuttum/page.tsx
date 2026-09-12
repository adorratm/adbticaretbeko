"use client";

import { useState } from "react";
import Link from "next/link";
import { createApiClient, parseApiError } from "@adb/api-client";
import { Alert, Button, Field, Input } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [devToken, setDevToken] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setDevToken("");
    try {
      const api = createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
      });
      const res = await api.auth.forgotPassword(email);
      setTone("success");
      setMsg(res.message);
      if (res.devResetToken) setDevToken(res.devResetToken);
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
          <h1 style={{ marginTop: 0 }}>Şifremi Unuttum</h1>
          <p style={{ fontSize: 14, color: "var(--adb-muted)" }}>
            E-posta adresinize sıfırlama bağlantısı hazırlanır. Geliştirmede token ekranda gösterilir.
          </p>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <Field label="E-posta" hint="Hesabınız varsa sıfırlama bağlantısı hazırlanır">
              <Input type="email" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Gönderiliyor…" : "Sıfırlama iste"}
            </Button>
          </form>
          {msg ? (
            <Alert tone={tone} style={{ marginTop: 12 }}>
              {msg}
            </Alert>
          ) : null}
          {devToken ? (
            <Alert tone="info" style={{ marginTop: 12, wordBreak: "break-all" }}>
              Dev token: {devToken}
              <div style={{ marginTop: 8 }}>
                <Link
                  href={`/auth/sifre-sifirla?token=${encodeURIComponent(devToken)}`}
                  style={{ color: "var(--adb-primary)", fontWeight: 700 }}
                >
                  Şifreyi sıfırla →
                </Link>
              </div>
            </Alert>
          ) : null}
          <p style={{ fontSize: 13 }}>
            <Link href="/auth/login">Girişe dön</Link>
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
