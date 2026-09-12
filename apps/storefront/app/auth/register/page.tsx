"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createApiClient, parseApiError, saveStoreSession } from "@adb/api-client";
import { Alert, Button, Field, Input } from "@adb/ui";
import { StorefrontShell } from "../../../components/site-shell";
import { mergeGuestCartAfterLogin } from "../../../lib/store-api";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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
      const tokens = await api.auth.register({ email, password, firstName, lastName });
      saveStoreSession(tokens);
      await mergeGuestCartAfterLogin(tokens.userId);
      setTone("success");
      setMsg("Kayıt tamam — yönlendiriliyorsunuz");
      router.replace("/");
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
          <h1 style={{ marginTop: 0 }}>Hesap Oluştur</h1>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Ad">
                <Input placeholder="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Soyad">
                <Input placeholder="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
            </div>
            <Field label="E-posta">
              <Input type="email" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Şifre" hint="En az 8 karakter">
              <Input type="password" placeholder="••••••••" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Kayıt ol"}
            </Button>
          </form>
          {msg ? (
            <Alert tone={tone} style={{ marginTop: 12 }}>
              {msg}
            </Alert>
          ) : null}
          <p style={{ fontSize: 13 }}>
            Zaten hesabınız var mı?{" "}
            <Link href="/auth/login" style={{ color: "var(--adb-primary)", fontWeight: 600 }}>
              Giriş yap
            </Link>
          </p>
        </div>
      </main>
    </StorefrontShell>
  );
}
