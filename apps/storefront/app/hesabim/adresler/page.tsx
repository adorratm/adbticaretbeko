"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@adb/ui";
import { getStoreUser, parseApiError, type CustomerAddress } from "@adb/api-client";
import { AccountShell } from "../../../components/account-shell";
import { createStoreApi } from "../../../lib/store-api";

const emptyForm = {
  title: "Ev",
  line1: "",
  line2: "",
  city: "İstanbul",
  district: "",
  postalCode: "",
  isDefault: true,
};

export default function AccountAddressesPage() {
  const [items, setItems] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  async function load() {
    const api = createStoreApi();
    const user = getStoreUser();
    await api.customers.me().catch(() =>
      api.customers.ensure({ email: user?.email, firstName: "Müşteri", lastName: "-" }),
    );
    const res = await api.customers.listAddresses();
    setItems(res.items);
  }

  useEffect(() => {
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
  }, []);

  function startEdit(a: CustomerAddress) {
    setEditId(a.id);
    setForm({
      title: a.title,
      line1: a.line1,
      line2: a.line2 || "",
      city: a.city,
      district: a.district,
      postalCode: a.postalCode || "",
      isDefault: !!a.isDefault,
    });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const api = createStoreApi();
      if (editId) {
        await api.customers.updateAddress(editId, form);
        setTone("success");
        setMsg("Adres güncellendi");
      } else {
        await api.customers.createAddress(form);
        setTone("success");
        setMsg("Adres eklendi");
      }
      cancelEdit();
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      const api = createStoreApi();
      await api.customers.deleteAddress(id);
      if (editId === id) cancelEdit();
      await load();
      setTone("success");
      setMsg("Adres silindi");
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Adreslerim">
      <div style={{ display: "grid", gap: 16 }}>
        {msg ? <Alert tone={tone}>{msg}</Alert> : null}

        <div style={{ display: "grid", gap: 12 }}>
          {items.length === 0 ? (
            <div className="adb-card" style={{ padding: 20, color: "var(--adb-muted)" }}>
              Kayıtlı adres yok. Teslimat için bir adres ekleyin.
            </div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="adb-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {a.title}
                    {a.isDefault ? (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--adb-primary)" }}>Varsayılan</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--adb-muted)", marginTop: 4 }}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {a.district} / {a.city}
                    {a.postalCode ? ` · ${a.postalCode}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button type="button" className="adb-btn adb-btn-tertiary" disabled={busy} onClick={() => startEdit(a)}>
                    Düzenle
                  </button>
                  <button type="button" className="adb-btn adb-btn-tertiary" disabled={busy} onClick={() => onDelete(a.id)}>
                    Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="adb-card" onSubmit={onSubmit} style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{editId ? "Adresi düzenle" : "Yeni adres"}</h2>
          <Field label="Başlık">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <Field label="Adres satırı">
            <Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
          </Field>
          <Field label="Adres satırı 2">
            <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          </Field>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <Field label="İlçe">
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
            </Field>
            <Field label="İl">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </Field>
          </div>
          <Field label="Posta kodu">
            <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </Field>
          <label className="adb-check">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            <span className="adb-check-box" aria-hidden />
            <span>Varsayılan teslimat adresi</span>
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="submit" disabled={busy}>
              {busy ? "Kaydediliyor…" : editId ? "Güncelle" : "Adres ekle"}
            </Button>
            {editId ? (
              <Button type="button" variant="tertiary" disabled={busy} onClick={cancelEdit}>
                İptal
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </AccountShell>
  );
}
