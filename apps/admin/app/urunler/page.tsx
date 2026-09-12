"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  status: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string;
};

const emptyForm = {
  sku: "",
  name: "",
  status: "ACTIVE",
  shortDescription: "",
  description: "",
  categoryId: "",
  price: "129999",
  stock: "10",
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [backend, setBackend] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Product | null>(null);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<Array<{ id: string; url: string; alt?: string }>>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [variants, setVariants] = useState<Array<{ id: string; sku: string; name: string }>>([]);
  const [variantForm, setVariantForm] = useState({ sku: "", name: "" });
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  const api = useMemo(() => createAdminApi(), []);

  async function load(term = q) {
    const query = term.trim();
    try {
      if (query) {
        try {
          const res = await api.search.query({ q: query });
          setItems(
            (res.items || []).map((i) => ({
              id: i.id,
              sku: i.sku,
              name: i.name,
              slug: i.slug,
              status: i.status || "ACTIVE",
              shortDescription: i.shortDescription,
            })),
          );
          setBackend(res.backend || "search");
          return;
        } catch {
          /* catalog fallback */
        }
      }
      const res = await api.products.list(query ? { q: query } : undefined);
      setItems(res.items as Product[]);
      setBackend(query ? "catalog" : "");
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  useEffect(() => {
    load("");
    api.categories
      .list()
      .then((r) => setCategories(r.items))
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => load(q), 280);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (editing) {
        await api.products.update(editing.id, {
          sku: form.sku,
          name: form.name,
          status: form.status,
          shortDescription: form.shortDescription,
          description: form.description,
          categoryId: form.categoryId || undefined,
        });
        if (form.price) await api.pricing.set(editing.id, Number(form.price));
        if (form.stock !== "") await api.inventory.adjust(editing.id, Number(form.stock));
        setTone("success");
        setMsg(`Güncellendi: ${form.name}`);
        setEditing(null);
        setForm(emptyForm);
      } else {
        const created = await api.products.create({
          sku: form.sku,
          name: form.name,
          status: form.status,
          shortDescription: form.shortDescription,
          description: form.description,
          categoryId: form.categoryId || undefined,
        });
        await api.pricing.set(created.id, Number(form.price || 0));
        await api.inventory.adjust(created.id, Number(form.stock || 0));
        setTone("success");
        setMsg(`Ürün oluşturuldu: ${created.slug}`);
        setForm(emptyForm);
      }
      await load(q);
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      status: p.status || "ACTIVE",
      shortDescription: p.shortDescription || "",
      description: p.description || "",
      categoryId: p.categoryId || "",
      price: "",
      stock: "",
    });
    api.products
      .listImages(p.id)
      .then((r) => setImages(r.items))
      .catch(() => setImages([]));
    api.products
      .listVariants(p.id)
      .then((r) => setVariants(r.items))
      .catch(() => setVariants([]));
    setVariantForm({ sku: `${p.sku}-V2`, name: `${p.name} · Alternatif` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addImageUrl() {
    if (!editing || !imageUrl.trim()) return;
    try {
      await api.products.addImage(editing.id, { url: imageUrl.trim() });
      setImageUrl("");
      const r = await api.products.listImages(editing.id);
      setImages(r.items);
      setTone("success");
      setMsg("Görsel eklendi");
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  async function uploadImageFile(file: File) {
    if (!editing) return;
    try {
      await api.products.uploadImage(editing.id, file);
      const r = await api.products.listImages(editing.id);
      setImages(r.items);
      setTone("success");
      setMsg("Dosya yüklendi (MinIO)");
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  async function removeImage(imageId: string) {
    if (!editing) return;
    try {
      await api.products.deleteImage(editing.id, imageId);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  async function addVariant() {
    if (!editing || !variantForm.sku.trim() || !variantForm.name.trim()) return;
    try {
      await api.products.upsertVariant(editing.id, {
        sku: variantForm.sku.trim(),
        name: variantForm.name.trim(),
      });
      const r = await api.products.listVariants(editing.id);
      setVariants(r.items);
      setTone("success");
      setMsg("Varyant eklendi");
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  async function removeVariant(variantId: string) {
    if (!editing) return;
    try {
      await api.products.deleteVariant(editing.id, variantId);
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.products.delete(deleteTarget.id);
      setTone("success");
      setMsg(`Silindi: ${deleteTarget.name}`);
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) {
        setEditing(null);
        setForm(emptyForm);
      }
      await load(q);
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell title="Ürünler">
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <div className="admin-split">
        <form className="adb-card" style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }} onSubmit={onSubmit}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{editing ? "Ürünü düzenle" : "Yeni ürün"}</h2>
          {editing ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
              ID: {editing.id.slice(0, 8)}… · {editing.slug}
            </p>
          ) : null}
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </Field>
          <Field label="Ürün adı">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Kısa açıklama">
            <Input
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            />
          </Field>
          <Field label="Kategori">
            <SearchableSelect
              options={[
                { value: "", label: "— Seçin —" },
                ...categories.map((c) => ({ value: c.id, label: c.name, searchText: `${c.name} ${c.slug}` })),
              ]}
              value={form.categoryId}
              onChange={(categoryId) => setForm({ ...form, categoryId })}
              placeholder="Kategori seçin"
              searchPlaceholder="Kategori ara…"
              clearable
            />
          </Field>
          <Field label="Durum">
            <SearchableSelect
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "ARCHIVED", label: "ARCHIVED" },
              ]}
              value={form.status}
              onChange={(status) => setForm({ ...form, status })}
            />
          </Field>
          <Field label={editing ? "Fiyat (kuruş, boş=değiştirme)" : "Fiyat (kuruş)"}>
            <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label={editing ? "Stok (boş=değiştirme)" : "Stok"}>
            <Input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
          {editing ? (
            <div style={{ display: "grid", gap: 8, paddingTop: 4, borderTop: "1px solid var(--adb-border-subtle)" }}>
              <strong style={{ fontSize: 13 }}>Görseller</strong>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {images.map((img) => (
                  <div key={img.id} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt || ""} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        border: "none",
                        background: "var(--adb-error)",
                        color: "#fff",
                        borderRadius: 999,
                        width: 20,
                        height: 20,
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… görsel URL" />
              <div className="admin-actions-row">
                <Button type="button" variant="tertiary" onClick={addImageUrl}>
                  URL ekle
                </Button>
                <label className="adb-btn adb-btn-tertiary" style={{ height: 34, cursor: "pointer", fontSize: 12 }}>
                  Dosya yükle
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImageFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}
          {editing ? (
            <div style={{ display: "grid", gap: 8, paddingTop: 4, borderTop: "1px solid var(--adb-border-subtle)" }}>
              <strong style={{ fontSize: 13 }}>Varyantlar</strong>
              {variants.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--adb-muted)" }}>Henüz varyant yok</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  {variants.map((v) => (
                    <li key={v.id} style={{ marginBottom: 4 }}>
                      {v.name} · <code>{v.sku}</code>{" "}
                      <button type="button" onClick={() => removeVariant(v.id)} style={{ fontSize: 11, cursor: "pointer" }}>
                        sil
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                value={variantForm.sku}
                onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                placeholder="Varyant SKU"
              />
              <Input
                value={variantForm.name}
                onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                placeholder="Varyant adı (örn. 9000 BTU)"
              />
              <Button type="button" variant="tertiary" onClick={addVariant}>
                Varyant ekle
              </Button>
            </div>
          ) : null}
          <div className="admin-actions-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Kaydediliyor…" : editing ? "Güncelle" : "Kaydet"}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  setImages([]);
                  setVariants([]);
                }}
              >
                İptal
              </Button>
            ) : null}
          </div>
        </form>

        <div className="adb-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)", display: "grid", gap: 8 }}>
            <Field label="Ara (Elasticsearch / katalog)">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ad, SKU, slug veya ID…"
              />
            </Field>
            {backend ? (
              <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>Arama motoru: {backend}</div>
            ) : null}
          </div>
          <div className="admin-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 560 }}>
              <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>SKU</th>
                  <th style={{ padding: 12 }}>Ad</th>
                  <th style={{ padding: 12 }}>Durum</th>
                  <th style={{ padding: 12 }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{p.sku}</div>
                      <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>{p.slug}</div>
                    </td>
                    <td style={{ padding: 12 }}>{p.name}</td>
                    <td style={{ padding: 12 }}>{p.status}</td>
                    <td style={{ padding: 12 }}>
                      <div className="admin-actions-row">
                        <Button type="button" variant="tertiary" onClick={() => startEdit(p)}>
                          Düzenle
                        </Button>
                        <Button type="button" variant="promo" className="adb-btn-danger" onClick={() => setDeleteTarget(p)}>
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, color: "var(--adb-muted)" }}>
                      Ürün bulunamadı.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Ürünü sil?"
        description={
          deleteTarget ? (
            <>
              <strong>{deleteTarget.name}</strong> ({deleteTarget.sku}) kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </>
          ) : null
        }
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
