"use client";

import { useEffect, useState } from "react";
import { Alert, Button, ConfirmDialog, EmptyState, Field, Input } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Review = {
  id: string;
  productId: string;
  customerName?: string;
  rating: number;
  title?: string;
  body: string;
  createdAt?: string;
};

export default function YorumlarPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await createAdminApi().reviews.list();
    setItems(res.items);
  }

  useEffect(() => {
    load()
      .catch((e) => {
        setTone("error");
        setMsg(parseApiError(e));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((r) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return `${r.customerName} ${r.title} ${r.body} ${r.productId}`.toLowerCase().includes(term);
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await createAdminApi().reviews.remove(deleteTarget.id);
      setTone("success");
      setMsg("Yorum silindi");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell title="Yorum Moderasyonu">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Ürün sayfalarındaki müşteri yorumlarını listeleyin ve uygunsuz olanları silin
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div className="adb-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)" }}>
          <Field label="Ara">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, ürün, metin…" />
          </Field>
        </div>
        <div className="admin-table-wrap">
          {loading ? (
            <EmptyState title="Yükleniyor…" />
          ) : filtered.length === 0 ? (
            <EmptyState title="Yorum yok" description="Storefront ürün sayfasından yorum eklenebilir." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
              <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: 12 }}>Puan</th>
                  <th style={{ padding: 12 }}>Müşteri</th>
                  <th style={{ padding: 12 }}>Yorum</th>
                  <th style={{ padding: 12 }}>Ürün</th>
                  <th style={{ padding: 12 }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                    <td style={{ padding: 12, whiteSpace: "nowrap", color: "#d97706", fontWeight: 700 }}>
                      {"★".repeat(r.rating)}
                    </td>
                    <td style={{ padding: 12 }}>{r.customerName || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{r.title || "—"}</div>
                      <div style={{ color: "var(--adb-muted)", fontSize: 12 }}>{r.body}</div>
                    </td>
                    <td style={{ padding: 12, fontSize: 11 }}>{r.productId.slice(0, 8)}…</td>
                    <td style={{ padding: 12 }}>
                      <Button
                        type="button"
                        variant="promo"
                        className="adb-btn-danger"
                        style={{ height: 34, fontSize: 12 }}
                        onClick={() => setDeleteTarget(r)}
                      >
                        Sil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Yorumu sil?"
        description={deleteTarget ? `"${deleteTarget.title || deleteTarget.body.slice(0, 60)}" kalıcı olarak silinecek.` : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
