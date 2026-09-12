"use client";

import { useEffect, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Category = {
  id: string;
  name: string;
  slug: string;
  tech?: string;
  icon?: string;
  sortOrder?: number;
  active?: boolean;
  countHint?: string;
};

export default function KategorilerPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    tech: "",
    icon: "category",
    countHint: "",
    sortOrder: 100,
  });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const api = createAdminApi();
    const res = await api.categories.list({ all: true });
    setItems(res.items);
  }

  useEffect(() => {
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
  }, []);

  async function save(c: Category) {
    setBusy(c.id);
    setMsg("");
    try {
      const api = createAdminApi();
      await api.categories.update(c.id, {
        name: c.name,
        tech: c.tech || "",
        icon: c.icon || "category",
        sortOrder: c.sortOrder ?? 100,
        active: c.active !== false,
        countHint: c.countHint || "",
      });
      setTone("success");
      setMsg(`Kaydedildi: ${c.name}`);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg("");
    try {
      const api = createAdminApi();
      await api.categories.create({
        name: createForm.name,
        slug: createForm.slug || undefined,
        tech: createForm.tech,
        icon: createForm.icon,
        countHint: createForm.countHint,
        sortOrder: createForm.sortOrder,
      });
      setCreateForm({ name: "", slug: "", tech: "", icon: "category", countHint: "", sortOrder: 100 });
      setTone("success");
      setMsg("Kategori eklendi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const api = createAdminApi();
      await api.categories.delete(deleteTarget.id);
      setTone("success");
      setMsg(`Silindi: ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  }

  function patch(id: string, partial: Partial<Category>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  }

  return (
    <AdminShell title="Kategoriler">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Storefront “Popüler Kategoriler” ile aynı set — ekle, düzenle, sil
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <form className="adb-card" onSubmit={onCreate} style={{ padding: 16, display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Yeni kategori</h2>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <Field label="Ad">
            <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </Field>
          <Field label="Slug (opsiyonel)">
            <Input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} placeholder="otomatik" />
          </Field>
          <Field label="Teknoloji">
            <Input value={createForm.tech} onChange={(e) => setCreateForm({ ...createForm, tech: e.target.value })} />
          </Field>
          <Field label="İkon">
            <Input value={createForm.icon} onChange={(e) => setCreateForm({ ...createForm, icon: e.target.value })} />
          </Field>
        </div>
        <Button type="submit" disabled={creating} style={{ width: "fit-content" }}>
          {creating ? "Ekleniyor…" : "Kategori ekle"}
        </Button>
      </form>

      <div style={{ display: "grid", gap: 12 }}>
        {items.length === 0 ? (
          <div className="adb-card" style={{ padding: 20, color: "var(--adb-muted)" }}>
            Kategori yok — yukarıdan ekleyin veya catalog seed çalıştırın.
          </div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="adb-card" style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="material-symbols-outlined" style={{ color: "var(--adb-primary)" }}>
                    {c.icon || "category"}
                  </span>
                  <div>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <code style={{ fontSize: 11, color: "var(--adb-muted)" }}>/kategori/{c.slug}</code>
                  </div>
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={c.active !== false}
                    onChange={(e) => patch(c.id, { active: e.target.checked })}
                  />
                  Aktif
                </label>
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <Field label="Ad">
                  <Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
                </Field>
                <Field label="Teknoloji etiketi">
                  <Input value={c.tech || ""} onChange={(e) => patch(c.id, { tech: e.target.value })} />
                </Field>
                <Field label="Model sayısı metni">
                  <Input value={c.countHint || ""} onChange={(e) => patch(c.id, { countHint: e.target.value })} />
                </Field>
                <Field label="İkon">
                  <Input value={c.icon || ""} onChange={(e) => patch(c.id, { icon: e.target.value })} />
                </Field>
                <Field label="Sıra">
                  <Input
                    value={String(c.sortOrder ?? 100)}
                    onChange={(e) => patch(c.id, { sortOrder: Number(e.target.value) || 100 })}
                  />
                </Field>
              </div>
              <div className="admin-actions-row">
                <Button type="button" disabled={busy === c.id} onClick={() => save(c)}>
                  {busy === c.id ? "Kaydediliyor…" : "Kaydet"}
                </Button>
                <Button
                  type="button"
                  variant="promo"
                  className="adb-btn-danger"
                  onClick={() => setDeleteTarget(c)}
                >
                  Sil
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Kategoriyi sil?"
        description={
          deleteTarget ? (
            <>
              <strong>{deleteTarget.name}</strong> silinecek. Bağlı ürün varsa işlem reddedilir.
            </>
          ) : null
        }
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
