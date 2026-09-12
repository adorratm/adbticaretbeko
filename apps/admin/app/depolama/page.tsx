"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input, SearchableSelect, StatusChip } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Reservation = {
  id: string;
  customerName: string;
  phone: string;
  packageId: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { value: "RESERVED", label: "RESERVED — Rezerve" },
  { value: "CONFIRMED", label: "CONFIRMED — Onaylandı" },
  { value: "ACTIVE", label: "ACTIVE — Depoda" },
  { value: "COMPLETED", label: "COMPLETED — Tamamlandı" },
  { value: "CANCELLED", label: "CANCELLED — İptal" },
];

export default function DepolamaPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("RESERVED");
  const [editNote, setEditNote] = useState("");

  const api = useMemo(() => createAdminApi(), []);

  async function load() {
    const r = await api.retail.listStorage();
    setItems(r.items as unknown as Reservation[]);
  }

  useEffect(() => {
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((r) =>
      [r.customerName, r.phone, r.status, r.note, r.packageId, r.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [items, q]);

  function startEdit(r: Reservation) {
    setEditId(r.id);
    setEditStatus(r.status || "RESERVED");
    setEditNote(r.note || "");
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(editId);
    try {
      await api.retail.updateStorage(editId, { status: editStatus, note: editNote });
      setTone("success");
      setMsg("Rezervasyon güncellendi");
      setEditId(null);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.retail.deleteStorage(deleteTarget.id);
      setTone("success");
      setMsg("Rezervasyon silindi");
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
    <AdminShell title="Depolama Rezervasyonları">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Çeyiz / ücretsiz depolama talepleri — durum güncelle ve sil
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div className="adb-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)" }}>
          <Field label="Ara">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, telefon, durum…" />
          </Field>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>Müşteri</th>
                <th style={{ padding: 12 }}>Tarih</th>
                <th style={{ padding: 12 }}>Durum</th>
                <th style={{ padding: 12 }}>Not / İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{r.customerName}</div>
                    <div style={{ color: "var(--adb-muted)" }}>{r.phone}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    {r.startDate} → {r.endDate}
                  </td>
                  <td style={{ padding: 12 }}>
                    {editId === r.id ? (
                      <SearchableSelect options={STATUS_OPTIONS} value={editStatus} onChange={setEditStatus} />
                    ) : (
                      <StatusChip status="montage">{r.status}</StatusChip>
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    {editId === r.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Not" />
                        <div className="admin-actions-row">
                          <Button type="button" style={{ height: 34, fontSize: 12 }} disabled={busy === r.id} onClick={saveEdit}>
                            Kaydet
                          </Button>
                          <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => setEditId(null)}>
                            İptal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div>{r.note || "—"}</div>
                        <div className="admin-actions-row">
                          <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => startEdit(r)}>
                            Düzenle
                          </Button>
                          <Button
                            type="button"
                            variant="promo"
                            className="adb-btn-danger"
                            style={{ height: 34, fontSize: 12 }}
                            onClick={() => setDeleteTarget(r)}
                          >
                            Sil
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, color: "var(--adb-muted)" }}>
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Rezervasyonu sil?"
        description={deleteTarget ? <>{deleteTarget.customerName} kaydı silinecek.</> : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
