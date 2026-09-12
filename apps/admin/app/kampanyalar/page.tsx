"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Field, Input, SearchableSelect, TextArea } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type Coupon = {
  id: string;
  code: string;
  title: string;
  type: string;
  value: number;
  minSubtotal: number;
  maxDiscount: number;
  usageLimit: number;
  usedCount: number;
  active: boolean;
};

type Campaign = {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  productIds?: string[];
  showModal?: boolean;
  active?: boolean;
};

const TYPE_OPTIONS = [
  { value: "percent", label: "Yüzde (%)" },
  { value: "fixed", label: "Sabit tutar (₺)" },
];

function formatTRY(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

const emptyCoupon = {
  code: "",
  title: "",
  type: "percent" as "percent" | "fixed",
  value: 10,
  minSubtotal: 0,
  maxDiscount: 0,
  usageLimit: 0,
  active: true,
};

const emptyCampaign = {
  title: "",
  subtitle: "",
  body: "",
  imageUrl: "",
  ctaLabel: "İncele",
  ctaHref: "/kampanyalar",
  productIds: "",
  showModal: true,
  active: true,
};

export default function KampanyalarPage() {
  const [tab, setTab] = useState<"coupons" | "campaigns">("campaigns");
  const [items, setItems] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleteCampaign, setDeleteCampaign] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(emptyCoupon);
  const [cForm, setCForm] = useState(emptyCampaign);

  const api = useMemo(() => createAdminApi(), []);

  async function load() {
    const [coupons, camps] = await Promise.all([api.promotions.listCoupons(), api.promotions.listCampaigns()]);
    setItems(coupons.items as Coupon[]);
    setCampaigns(camps.items as Campaign[]);
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
    return items.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term),
    );
  }, [items, q]);

  function resetCoupon() {
    setEditingId(null);
    setForm(emptyCoupon);
  }

  function resetCampaign() {
    setEditingCampaignId(null);
    setCForm(emptyCampaign);
  }

  async function onCouponSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const value = form.type === "percent" ? form.value : Math.round(form.value * 100);
      const payload = {
        code: form.code,
        title: form.title,
        type: form.type,
        value,
        minSubtotal: Math.round(form.minSubtotal * 100),
        maxDiscount: Math.round(form.maxDiscount * 100),
        usageLimit: form.usageLimit,
        active: form.active,
      };
      if (editingId) {
        await api.promotions.updateCoupon(editingId, payload);
        setMsg("Kupon güncellendi");
      } else {
        await api.promotions.createCoupon(payload);
        setMsg("Kupon oluşturuldu");
      }
      setTone("success");
      resetCoupon();
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCampaignSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const productIds = cForm.productIds
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        title: cForm.title,
        subtitle: cForm.subtitle,
        body: cForm.body,
        imageUrl: cForm.imageUrl,
        ctaLabel: cForm.ctaLabel,
        ctaHref: cForm.ctaHref,
        productIds,
        showModal: cForm.showModal,
        active: cForm.active,
      };
      if (editingCampaignId) {
        await api.promotions.updateCampaign(editingCampaignId, payload);
        setMsg("Kampanya güncellendi — storefront modalına yansır");
      } else {
        await api.promotions.createCampaign(payload);
        setMsg("Ürün kampanyası oluşturuldu — müşteriye modal gösterilir");
      }
      setTone("success");
      resetCampaign();
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Kampanyalar">
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button type="button" variant={tab === "campaigns" ? "primary" : "tertiary"} onClick={() => setTab("campaigns")}>
          Ürün kampanyaları
        </Button>
        <Button type="button" variant={tab === "coupons" ? "primary" : "tertiary"} onClick={() => setTab("coupons")}>
          Kupon kodları
        </Button>
      </div>

      {tab === "campaigns" ? (
        <div className="admin-split-kampanya">
          <div className="adb-card" style={{ overflow: "hidden" }}>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Başlık</th>
                    <th style={{ padding: 12 }}>Modal</th>
                    <th style={{ padding: 12 }}>CTA</th>
                    <th style={{ padding: 12 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700 }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{c.subtitle}</div>
                      </td>
                      <td style={{ padding: 12 }}>{c.showModal ? "Evet" : "Hayır"}</td>
                      <td style={{ padding: 12 }}>{c.ctaHref}</td>
                      <td style={{ padding: 12 }}>
                        <div className="admin-actions-row">
                          <Button
                            type="button"
                            variant="tertiary"
                            style={{ height: 34, fontSize: 12 }}
                            onClick={() => {
                              setEditingCampaignId(c.id);
                              setCForm({
                                title: c.title,
                                subtitle: c.subtitle || "",
                                body: c.body || "",
                                imageUrl: c.imageUrl || "",
                                ctaLabel: c.ctaLabel || "İncele",
                                ctaHref: c.ctaHref || "/kampanyalar",
                                productIds: (c.productIds || []).join(", "),
                                showModal: !!c.showModal,
                                active: c.active !== false,
                              });
                            }}
                          >
                            Düzenle
                          </Button>
                          <Button type="button" variant="promo" className="adb-btn-danger" style={{ height: 34, fontSize: 12 }} onClick={() => setDeleteCampaign(c)}>
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 20, color: "var(--adb-muted)" }}>
                        Henüz ürün kampanyası yok.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <form className="adb-card" onSubmit={onCampaignSubmit} style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{editingCampaignId ? "Kampanyayı düzenle" : "Yeni ürün kampanyası"}</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
              Modal açık kampanyalar storefront’ta kullanıcıya otomatik gösterilir.
            </p>
            <Field label="Başlık">
              <Input value={cForm.title} onChange={(e) => setCForm({ ...cForm, title: e.target.value })} required />
            </Field>
            <Field label="Alt başlık">
              <Input value={cForm.subtitle} onChange={(e) => setCForm({ ...cForm, subtitle: e.target.value })} />
            </Field>
            <Field label="Metin">
              <TextArea value={cForm.body} onChange={(e) => setCForm({ ...cForm, body: e.target.value })} rows={3} required />
            </Field>
            <Field label="Görsel URL">
              <Input value={cForm.imageUrl} onChange={(e) => setCForm({ ...cForm, imageUrl: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="CTA metni">
              <Input value={cForm.ctaLabel} onChange={(e) => setCForm({ ...cForm, ctaLabel: e.target.value })} />
            </Field>
            <Field label="CTA link">
              <Input value={cForm.ctaHref} onChange={(e) => setCForm({ ...cForm, ctaHref: e.target.value })} />
            </Field>
            <Field label="Ürün ID’leri (virgülle)">
              <Input value={cForm.productIds} onChange={(e) => setCForm({ ...cForm, productIds: e.target.value })} placeholder="uuid1, uuid2" />
            </Field>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={cForm.showModal} onChange={(e) => setCForm({ ...cForm, showModal: e.target.checked })} />
              Storefront’ta modal göster
            </label>
            {editingCampaignId ? (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={cForm.active} onChange={(e) => setCForm({ ...cForm, active: e.target.checked })} />
                Aktif
              </label>
            ) : null}
            <div className="admin-actions-row">
              <Button type="submit" disabled={busy}>
                {busy ? "Kaydediliyor…" : editingCampaignId ? "Güncelle" : "Kampanya oluştur"}
              </Button>
              {editingCampaignId ? (
                <Button type="button" variant="tertiary" onClick={resetCampaign}>
                  İptal
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : (
        <div className="admin-split-kampanya">
          <div className="adb-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid var(--adb-border-subtle)" }}>
              <Field label="Kupon ara">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, başlık…" />
              </Field>
            </div>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Kod</th>
                    <th style={{ padding: 12 }}>Başlık</th>
                    <th style={{ padding: 12 }}>İndirim</th>
                    <th style={{ padding: 12 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>{c.code}</td>
                      <td style={{ padding: 12 }}>{c.title}</td>
                      <td style={{ padding: 12 }}>{c.type === "percent" ? `%${c.value}` : formatTRY(c.value)}</td>
                      <td style={{ padding: 12 }}>
                        <div className="admin-actions-row">
                          <Button
                            type="button"
                            variant="tertiary"
                            style={{ height: 34, fontSize: 12 }}
                            onClick={() => {
                              setEditingId(c.id);
                              setForm({
                                code: c.code,
                                title: c.title,
                                type: (c.type === "fixed" ? "fixed" : "percent") as "percent" | "fixed",
                                value: c.type === "percent" ? c.value : c.value / 100,
                                minSubtotal: c.minSubtotal / 100,
                                maxDiscount: c.maxDiscount / 100,
                                usageLimit: c.usageLimit,
                                active: c.active,
                              });
                            }}
                          >
                            Düzenle
                          </Button>
                          <Button type="button" variant="promo" className="adb-btn-danger" style={{ height: 34, fontSize: 12 }} onClick={() => setDeleteTarget(c)}>
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form className="adb-card" onSubmit={onCouponSubmit} style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{editingId ? "Kuponu düzenle" : "Yeni kupon"}</h2>
            <Field label="Kod">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
            </Field>
            <Field label="Başlık">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
            <Field label="Tip">
              <SearchableSelect
                options={TYPE_OPTIONS}
                value={form.type}
                onChange={(type) => setForm({ ...form, type: type as "percent" | "fixed" })}
              />
            </Field>
            <Field label={form.type === "percent" ? "Yüzde" : "Tutar (₺)"}>
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
            </Field>
            <div className="admin-actions-row">
              <Button type="submit" disabled={busy}>
                {busy ? "Kaydediliyor…" : editingId ? "Güncelle" : "Kupon oluştur"}
              </Button>
              {editingId ? (
                <Button type="button" variant="tertiary" onClick={resetCoupon}>
                  İptal
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Kuponu sil?"
        description={deleteTarget ? <>{deleteTarget.code} silinecek.</> : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await api.promotions.deleteCoupon(deleteTarget.id);
            setDeleteTarget(null);
            await load();
          } catch (e) {
            setTone("error");
            setMsg(parseApiError(e));
          } finally {
            setDeleting(false);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleteCampaign}
        title="Kampanyayı sil?"
        description={deleteCampaign ? <>{deleteCampaign.title} silinecek.</> : null}
        confirmLabel="Evet, sil"
        loading={deleting}
        onCancel={() => setDeleteCampaign(null)}
        onConfirm={async () => {
          if (!deleteCampaign) return;
          setDeleting(true);
          try {
            await api.promotions.deleteCampaign(deleteCampaign.id);
            setDeleteCampaign(null);
            await load();
          } catch (e) {
            setTone("error");
            setMsg(parseApiError(e));
          } finally {
            setDeleting(false);
          }
        }}
      />
    </AdminShell>
  );
}
