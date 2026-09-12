"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@adb/ui";
import { getStoreUser, parseApiError, type CustomerProfile } from "@adb/api-client";
import { AccountShell } from "../../components/account-shell";
import { createStoreApi } from "../../lib/store-api";

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const api = createStoreApi();
    const user = getStoreUser();
    api.customers
      .me()
      .catch(() =>
        api.customers.ensure({
          email: user?.email,
          firstName: "Müşteri",
          lastName: "-",
        }),
      )
      .then((p) => {
        setProfile(p);
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setPhone(p.phone || "");
      })
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createStoreApi();
      const p = await api.customers.updateMe({ firstName, lastName, phone });
      setProfile(p);
      setTone("success");
      setMsg("Profil güncellendi");
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Profil bilgileri">
      <div className="adb-card" style={{ padding: 24, maxWidth: 520 }}>
        <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 14 }}>
          {profile?.email || getStoreUser()?.email || "—"}
        </p>
        <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
          <Field label="Ad">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field label="Soyad">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
          <Field label="Telefon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </form>
        {msg ? (
          <Alert tone={tone} style={{ marginTop: 14 }}>
            {msg}
          </Alert>
        ) : null}
      </div>
    </AccountShell>
  );
}
