"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, EmptyState, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
};

const ROLE_OPTIONS = [
  { value: "CUSTOMER", label: "CUSTOMER" },
  { value: "ADMIN", label: "ADMIN" },
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
  { value: "CATALOG_MANAGER", label: "CATALOG_MANAGER" },
  { value: "ORDER_MANAGER", label: "ORDER_MANAGER" },
];

export default function MusterilerPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", role: "CUSTOMER" });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const api = useMemo(() => createAdminApi(), []);

  async function load() {
    const r = await api.auth.listUsers();
    setItems(r.items);
  }

  useEffect(() => {
    load()
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return (
        name.includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.id || "").toLowerCase().includes(term) ||
        (u.roles || []).some((r) => r.toLowerCase().includes(term))
      );
    });
  }, [items, q]);

  function startEdit(u: UserRow) {
    setEditing(u);
    setForm({
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      role: u.roles?.[0] || "CUSTOMER",
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMsg("");
    try {
      await api.auth.updateUser(editing.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        roles: [form.role],
      });
      setTone("success");
      setMsg("Kullanıcı güncellendi");
      setEditing(null);
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.auth.deleteUser(deleteTarget.id);
      setTone("success");
      setMsg(`Silindi: ${deleteTarget.email}`);
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) setEditing(null);
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell title="Müşteriler">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Auth kullanıcıları — ad/soyad ve rol düzenleme, silme
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <div className="admin-split-wide">
        <div className="adb-card adb-animate-in" style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)" }}>
            <Field label="Ara">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, e-posta, rol…" />
            </Field>
          </div>
          <div className="admin-table-wrap">
            {loading ? (
              <EmptyState title="Yükleniyor…" />
            ) : filtered.length === 0 ? (
              <EmptyState title="Kayıt bulunamadı" description="Aramayı temizleyin veya yeni kayıt oluşturun." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
                <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Ad</th>
                    <th style={{ padding: 12 }}>E-posta</th>
                    <th style={{ padding: 12 }}>Roller</th>
                    <th style={{ padding: 12 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                      <td style={{ padding: 12 }}>
                        {u.firstName} {u.lastName}
                      </td>
                      <td style={{ padding: 12 }}>{u.email}</td>
                      <td style={{ padding: 12 }}>{(u.roles || []).join(", ")}</td>
                      <td style={{ padding: 12 }}>
                        <div className="admin-actions-row">
                          <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => startEdit(u)}>
                            Düzenle
                          </Button>
                          <Button
                            type="button"
                            variant="promo"
                            className="adb-btn-danger"
                            style={{ height: 34, fontSize: 12 }}
                            onClick={() => setDeleteTarget(u)}
                          >
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {editing ? (
          <form className="adb-card" onSubmit={onSave} style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Kullanıcıyı düzenle</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>{editing.email}</p>
            <Field label="Ad">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Field>
            <Field label="Soyad">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="Rol">
              <SearchableSelect
                options={ROLE_OPTIONS}
                value={form.role}
                onChange={(role) => setForm({ ...form, role })}
                placeholder="Rol seçin"
              />
            </Field>
            <div className="admin-actions-row">
              <Button type="submit" disabled={busy}>
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setEditing(null)}>
                İptal
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Kullanıcıyı sil?"
        description={deleteTarget ? <>{deleteTarget.email} kalıcı olarak silinecek.</> : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
