"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Button, EmptyState, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";
import { useAdminBranch } from "../../components/admin-branch";

type ServiceTeam = {
  id: string;
  warehouseCode: string;
  name: string;
  technician: string;
  vehiclePlate: string;
  active: boolean;
};

export default function ServisEkipleriPage() {
  const { branchCode, branch, warehouses } = useAdminBranch();
  const [items, setItems] = useState<ServiceTeam[]>([]);
  const [filterWh, setFilterWh] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [technician, setTechnician] = useState("");
  const [plate, setPlate] = useState("");
  const [createWh, setCreateWh] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTech, setEditTech] = useState("");
  const [editPlate, setEditPlate] = useState("");

  const api = useMemo(() => createAdminApi(), []);

  useEffect(() => {
    setFilterWh(branchCode);
    setCreateWh(branchCode);
  }, [branchCode]);

  async function load(wh = filterWh) {
    try {
      const res = await api.serviceTeams.list(wh || undefined);
      setItems(res.items || []);
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  useEffect(() => {
    void load(filterWh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWh]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) =>
      [t.name, t.technician, t.vehiclePlate, t.warehouseCode].some((v) => String(v || "").toLowerCase().includes(term)),
    );
  }, [items, q]);

  const warehouseOptions = useMemo(() => {
    const list =
      warehouses.length > 0
        ? warehouses
        : [
            { code: "BESIKTAS", name: "Beşiktaş", city: "İstanbul" },
            { code: "KADIKOY", name: "Kadıköy", city: "İstanbul" },
            { code: "BURSA", name: "Bursa", city: "Bursa" },
            { code: "MAIN", name: "Merkez Depo", city: "İstanbul" },
          ];
    return list.map((w) => ({
      value: w.code,
      label: w.city ? `${w.name} — ${w.city}` : w.name,
      searchText: `${w.code} ${w.name} ${"city" in w ? w.city : ""}`,
    }));
  }, [warehouses]);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setTone("error");
      setMsg("Ekip adı gerekli");
      return;
    }
    setBusy(true);
    try {
      await api.serviceTeams.create({
        warehouseCode: createWh || branchCode,
        name: name.trim(),
        technician: technician.trim(),
        vehiclePlate: plate.trim(),
      });
      setName("");
      setTechnician("");
      setPlate("");
      setTone("success");
      setMsg("Servis ekibi eklendi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t: ServiceTeam) {
    setEditId(t.id);
    setEditName(t.name);
    setEditTech(t.technician || "");
    setEditPlate(t.vehiclePlate || "");
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    try {
      await api.serviceTeams.update(editId, {
        name: editName.trim(),
        technician: editTech.trim(),
        vehiclePlate: editPlate.trim(),
      });
      setEditId(null);
      setTone("success");
      setMsg("Ekip güncellendi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeTeam(id: string) {
    setBusy(true);
    try {
      await api.serviceTeams.remove(id);
      setTone("success");
      setMsg("Ekip silindi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Servis Ekipleri">
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Servis Ekipleri</h2>
          <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 13 }}>
            Montaj ekiplerini şubeye göre tanımlayın · Aktif: {branch?.name || branchCode}
          </p>
        </div>
        <Link href="/servis-rotalari" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
          Servis rotalarına git
        </Link>
      </div>

      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 16 }}>
          {msg}
        </Alert>
      ) : null}

      <div className="admin-split-kampanya">
        <div className="adb-card" style={{ padding: 16 }}>
          <div style={{ display: "grid", gap: 12, marginBottom: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <Field label="Şube filtresi">
              <SearchableSelect
                options={[{ value: "", label: "Tüm şubeler" }, ...warehouseOptions]}
                value={filterWh}
                onChange={setFilterWh}
                searchPlaceholder="Şube ara…"
              />
            </Field>
            <Field label="Ara">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ekip, teknisyen, plaka…" />
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Ekip yok" description="Sağdaki formdan yeni servis ekibi ekleyin." />
          ) : (
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Ekip</th>
                    <th style={{ padding: 12 }}>Şube</th>
                    <th style={{ padding: 12 }}>Teknisyen</th>
                    <th style={{ padding: 12 }}>Plaka</th>
                    <th style={{ padding: 12 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>{t.name}</td>
                      <td style={{ padding: 12 }}>{t.warehouseCode}</td>
                      <td style={{ padding: 12 }}>{t.technician || "—"}</td>
                      <td style={{ padding: 12 }}>{t.vehiclePlate || "—"}</td>
                      <td style={{ padding: 12 }}>
                        <div className="admin-actions-row">
                          <Button type="button" variant="secondary" style={{ height: 32, fontSize: 12 }} onClick={() => startEdit(t)}>
                            Düzenle
                          </Button>
                          <Button type="button" variant="tertiary" style={{ height: 32, fontSize: 12 }} disabled={busy} onClick={() => removeTeam(t.id)}>
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editId ? (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: "var(--adb-surface-low)", display: "grid", gap: 10 }}>
              <strong>Ekibi düzenle</strong>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ekip adı" />
              <Input value={editTech} onChange={(e) => setEditTech(e.target.value)} placeholder="Teknisyen" />
              <Input value={editPlate} onChange={(e) => setEditPlate(e.target.value)} placeholder="Plaka" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" onClick={saveEdit} disabled={busy}>
                  Kaydet
                </Button>
                <Button type="button" variant="tertiary" onClick={() => setEditId(null)}>
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <form className="adb-card" style={{ padding: 16, display: "grid", gap: 12, alignContent: "start" }} onSubmit={createTeam}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Yeni ekip</h3>
          <Field label="Şube">
            <SearchableSelect options={warehouseOptions} value={createWh || branchCode} onChange={setCreateWh} searchPlaceholder="Şube ara…" />
          </Field>
          <Field label="Ekip adı">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Beşiktaş Merkez Ekibi" required />
          </Field>
          <Field label="Teknisyen">
            <Input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Ad Soyad" />
          </Field>
          <Field label="Araç plakası">
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="34 XX 000" />
          </Field>
          <Button type="submit" disabled={busy}>
            Ekip ekle
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
