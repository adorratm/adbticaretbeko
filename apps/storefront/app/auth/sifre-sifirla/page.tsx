"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createApiClient, parseApiError } from "@adb/api-client";
import { Alert, Button, Field, Input } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"),
      });
      const res = await api.auth.resetPassword(token, password);
      setTone("success");
      setMsg(res.message);
      setTimeout(() => router.replace("/auth/login"), 1200);
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adb-card adb-animate-in" style={{ padding: 28 }}>
      <h1 style={{ marginTop: 0 }}>Yeni Şifre</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <Field label="Sıfırlama token">
          <Input placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} required />
        </Field>
        <Field label="Yeni şifre" hint="En az 8 karakter">
          <Input type="password" placeholder="••••••••" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Şifreyi güncelle"}
        </Button>
      </form>
      {msg ? (
        <Alert tone={tone} style={{ marginTop: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <p style={{ fontSize: 13 }}>
        <Link href="/auth/login">Girişe dön</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <StorefrontShell>
      <main style={{ maxWidth: 440, margin: "48px auto", padding: "0 24px 64px" }}>
        <Suspense fallback={<div className="adb-card" style={{ padding: 28 }}>Yükleniyor…</div>}>
          <ResetForm />
        </Suspense>
      </main>
    </StorefrontShell>
  );
}
