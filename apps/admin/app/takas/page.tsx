"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input, StatusChip } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type TradeIn = {
  id: string;
  customerName: string;
  phone: string;
  oldBrand: string;
  oldModel: string;
  oldCondition: string;
  desiredProductSku: string;
  offeredAmount: number;
  status: string;
  note: string;
  createdAt: string;
};

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function TakasAdminPage() {
  const [items, setItems] = useState<TradeIn[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [offerTL, setOfferTL] = useState("");
  const [note, setNote] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TradeIn | null>(null);
  const [deleting, setDeleting] = useState(false);

  const api = useMemo(() => createAdminApi(), []);

  async function load() {
    const res = await api.retail.listTradeIns();
    setItems(res.items as unknown as TradeIn[]);
  }

  useEffect(() => {
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
  }, []);

  async function setStatus(id: string, status: string, extra?: { offeredAmount?: number; note?: string }) {
    setBusy(id);
    try {
      await api.retail.updateTradeIn(id, { status, ...extra });
      setTone("success");
      setMsg(`${id.slice(0, 8)} → ${status}`);
      setEditId(null);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(t: TradeIn) {
    setEditId(t.id);
    setOfferTL(String((t.offeredAmount || 0) / 100));
    setNote(t.note || "");
  }

  async function saveEdit(t: TradeIn) {
    const offeredAmount = Math.round(Number(offerTL || 0) * 100);
    await setStatus(t.id, t.status || "PENDING", { offeredAmount, note });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.retail.deleteTradeIn(deleteTarget.id);
      setTone("success");
      setMsg("Takas teklifi silindi");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) =>
      [t.customerName, t.phone, t.oldBrand, t.oldModel, t.desiredProductSku, t.status, t.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [items, q]);

  return (
    <AdminShell title="Takas Teklifleri">
      <p style={{ marginTop: 0, color: "var(--adb-muted)", fontSize: 13 }}>
        Teklif tutarı / not düzenle, onayla veya sil
      </p>
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div className="adb-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)" }}>
          <Field label="Ara">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Müşteri, telefon, model, SKU…" />
          </Field>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead style={{ background: "#f4f6f9", textAlign: "left" }}>
              <tr>
                <th style={{ padding: 12 }}>Müşteri</th>
                <th style={{ padding: 12 }}>Eski ürün</th>
                <th style={{ padding: 12 }}>Teklif</th>
                <th style={{ padding: 12 }}>Durum</th>
                <th style={{ padding: 12 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--adb-border)" }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{t.customerName}</div>
                    <div style={{ color: "var(--adb-muted)" }}>{t.phone}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    {t.oldBrand} {t.oldModel}
                    <div style={{ color: "var(--adb-muted)" }}>{t.oldCondition}</div>
                  </td>
                  <td style={{ padding: 12 }}>
                    {editId === t.id ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <Input value={offerTL} onChange={(e) => setOfferTL(e.target.value)} placeholder="Teklif ₺" />
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not" />
                      </div>
                    ) : (
                      formatTRY(t.offeredAmount)
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    <StatusChip status="preparing">{t.status}</StatusChip>
                  </td>
                  <td style={{ padding: 12 }}>
                    {editId === t.id ? (
                      <div className="admin-actions-row">
                        <Button type="button" style={{ height: 34, fontSize: 12 }} disabled={busy === t.id} onClick={() => saveEdit(t)}>
                          Kaydet
                        </Button>
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => setEditId(null)}>
                          İptal
                        </Button>
                      </div>
                    ) : (
                      <div className="admin-actions-row">
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} onClick={() => startEdit(t)}>
                          Düzenle
                        </Button>
                        <Button type="button" style={{ height: 34, fontSize: 12 }} disabled={busy === t.id} onClick={() => setStatus(t.id, "APPROVED")}>
                          Onayla
                        </Button>
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} disabled={busy === t.id} onClick={() => setStatus(t.id, "REJECTED")}>
                          Reddet
                        </Button>
                        <Button type="button" variant="tertiary" style={{ height: 34, fontSize: 12 }} disabled={busy === t.id} onClick={() => setStatus(t.id, "COMPLETED")}>
                          Tamamla
                        </Button>
                        <Button
                          type="button"
                          variant="promo"
                          className="adb-btn-danger"
                          style={{ height: 34, fontSize: 12 }}
                          onClick={() => setDeleteTarget(t)}
                        >
                          Sil
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, color: "var(--adb-muted)" }}>
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
        title="Takas teklifini sil?"
        description={deleteTarget ? <>{deleteTarget.customerName} — {deleteTarget.oldModel}</> : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}
