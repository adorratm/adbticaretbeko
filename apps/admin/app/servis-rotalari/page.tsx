"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Button, EmptyState, Field, Input, RouteCard, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";
import { useAdminBranch } from "../../components/admin-branch";

type ServiceTeam = {
  id: string;
  warehouseCode: string;
  name: string;
  technician: string;
  vehiclePlate: string;
};

type ServiceRoute = {
  id: string;
  teamId: string;
  warehouseCode: string;
  title: string;
  districtHint: string;
  plannedStops: number;
  doneStops: number;
  nextStop: string;
  status: string;
  teamName: string;
  technician: string;
  vehiclePlate: string;
  tone: "success" | "warn" | "danger";
  routeDate?: string;
};

export default function ServisRotalariPage() {
  const { branchCode, branch, warehouses } = useAdminBranch();
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [routes, setRoutes] = useState<ServiceRoute[]>([]);
  const [filterWh, setFilterWh] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [createWh, setCreateWh] = useState("");
  const [title, setTitle] = useState("");
  const [district, setDistrict] = useState("");
  const [nextStop, setNextStop] = useState("");
  const [planned, setPlanned] = useState("6");

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNext, setEditNext] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPlanned, setEditPlanned] = useState("0");
  const [editDone, setEditDone] = useState("0");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editTeamId, setEditTeamId] = useState("");

  const api = useMemo(() => createAdminApi(), []);

  useEffect(() => {
    setFilterWh(branchCode);
    setCreateWh(branchCode);
  }, [branchCode]);

  async function load(wh = filterWh) {
    try {
      const [t, r] = await Promise.all([
        api.serviceTeams.list(wh || undefined),
        api.serviceRoutes.list(wh || undefined),
      ]);
      setTeams(t.items || []);
      setRoutes(r.items || []);
      if (!teamId && t.items?.[0]?.id) setTeamId(t.items[0].id);
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    }
  }

  useEffect(() => {
    void load(filterWh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWh]);

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

  const filtered = useMemo(() => {
    return routes.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return [r.title, r.teamName, r.technician, r.nextStop, r.districtHint, r.warehouseCode]
        .some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [routes, statusFilter, q]);

  async function createRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setTone("error");
      setMsg("Rota başlığı gerekli");
      return;
    }
    setBusy(true);
    try {
      await api.serviceRoutes.create({
        warehouseCode: createWh || branchCode,
        teamId: teamId || undefined,
        title: title.trim(),
        districtHint: district.trim(),
        nextStop: nextStop.trim(),
        plannedStops: Number(planned) || 0,
        doneStops: 0,
      });
      setTitle("");
      setDistrict("");
      setNextStop("");
      setTone("success");
      setMsg("Rota oluşturuldu");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(r: ServiceRoute) {
    setEditId(r.id);
    setEditTitle(r.title);
    setEditNext(r.nextStop || "");
    setEditDistrict(r.districtHint || "");
    setEditPlanned(String(r.plannedStops || 0));
    setEditDone(String(r.doneStops || 0));
    setEditStatus(r.status || "ACTIVE");
    setEditTeamId(r.teamId || "");
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    try {
      await api.serviceRoutes.update(editId, {
        title: editTitle.trim(),
        nextStop: editNext.trim(),
        districtHint: editDistrict.trim(),
        plannedStops: Number(editPlanned) || 0,
        doneStops: Number(editDone) || 0,
        status: editStatus,
        teamId: editTeamId || undefined,
      });
      setEditId(null);
      setTone("success");
      setMsg("Rota güncellendi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function bumpRoute(r: ServiceRoute) {
    const next = Math.min(r.plannedStops || 0, (r.doneStops || 0) + 1);
    setBusy(true);
    try {
      await api.serviceRoutes.update(r.id, {
        doneStops: next,
        status: r.plannedStops > 0 && next >= r.plannedStops ? "DONE" : "ACTIVE",
      });
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeRoute(id: string) {
    setBusy(true);
    try {
      await api.serviceRoutes.remove(id);
      setTone("success");
      setMsg("Rota silindi");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Servis Rotaları">
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Servis Rotaları</h2>
          <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 13 }}>
            Günlük montaj rotalarını planlayın · Aktif şube: {branch?.name || branchCode}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/servis-ekipleri" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
            Servis ekipleri
          </Link>
          <Link href="/siparisler" className="adb-btn adb-btn-tertiary" style={{ height: 40 }}>
            Siparişler
          </Link>
        </div>
      </div>

      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 16 }}>
          {msg}
        </Alert>
      ) : null}

      <div className="admin-split-kampanya">
        <div className="adb-card" style={{ padding: 16 }}>
          <div style={{ display: "grid", gap: 12, marginBottom: 16, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Field label="Şube">
              <SearchableSelect
                options={[{ value: "", label: "Tüm şubeler" }, ...warehouseOptions]}
                value={filterWh}
                onChange={setFilterWh}
                searchPlaceholder="Şube ara…"
              />
            </Field>
            <Field label="Durum">
              <SearchableSelect
                options={[
                  { value: "ALL", label: "Tümü" },
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "DONE", label: "Tamamlanan" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </Field>
            <Field label="Ara">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rota, ekip, durak…" />
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Rota yok" description="Önce ekip tanımlayıp sağdan yeni rota oluşturun." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((r) => (
                <div key={r.id} className="adb-card" style={{ padding: 12, background: "var(--adb-surface-low)", boxShadow: "none" }}>
                  <RouteCard
                    title={r.title}
                    progress={`${r.doneStops}/${r.plannedStops || 0} Montaj`}
                    tech={`Teknisyen: ${r.technician || r.teamName || "—"}${r.vehiclePlate ? ` (${r.vehiclePlate})` : ""}`}
                    nextStop={r.nextStop ? `Sıradaki: ${r.nextStop}` : r.districtHint || "Durak yok"}
                    tone={r.tone || "success"}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--adb-muted)" }}>
                    {r.warehouseCode} · {r.status}
                    {r.routeDate ? ` · ${r.routeDate}` : ""}
                    {r.teamName ? ` · ${r.teamName}` : ""}
                  </div>
                  <div className="admin-actions-row" style={{ marginTop: 10 }}>
                    <Button
                      type="button"
                      variant="secondary"
                      style={{ height: 32, fontSize: 12 }}
                      disabled={busy || r.status === "DONE" || (r.plannedStops > 0 && r.doneStops >= r.plannedStops)}
                      onClick={() => bumpRoute(r)}
                    >
                      +1 montaj
                    </Button>
                    <Button type="button" variant="secondary" style={{ height: 32, fontSize: 12 }} onClick={() => startEdit(r)}>
                      Düzenle
                    </Button>
                    <Button type="button" variant="tertiary" style={{ height: 32, fontSize: 12 }} disabled={busy} onClick={() => removeRoute(r.id)}>
                      Sil
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editId ? (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: "#fff", border: "1px solid var(--adb-border-subtle)", display: "grid", gap: 10 }}>
              <strong>Rotayı düzenle</strong>
              <Field label="Ekip">
                <SearchableSelect
                  options={[{ value: "", label: "Ekip seçilmedi" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
                  value={editTeamId}
                  onChange={setEditTeamId}
                />
              </Field>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Başlık" />
              <Input value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} placeholder="Bölge / ilçe" />
              <Input value={editNext} onChange={(e) => setEditNext(e.target.value)} placeholder="Sıradaki durak" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input value={editDone} onChange={(e) => setEditDone(e.target.value)} placeholder="Tamamlanan" type="number" min={0} />
                <Input value={editPlanned} onChange={(e) => setEditPlanned(e.target.value)} placeholder="Planlanan" type="number" min={0} />
              </div>
              <SearchableSelect
                options={[
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "DONE", label: "Tamamlandı" },
                ]}
                value={editStatus}
                onChange={setEditStatus}
              />
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

        <form className="adb-card" style={{ padding: 16, display: "grid", gap: 12, alignContent: "start" }} onSubmit={createRoute}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Yeni rota</h3>
          <Field label="Şube">
            <SearchableSelect options={warehouseOptions} value={createWh || branchCode} onChange={setCreateWh} searchPlaceholder="Şube ara…" />
          </Field>
          <Field label="Servis ekibi">
            <SearchableSelect
              options={[
                { value: "", label: teams.length ? "Ekip seçilmedi" : "Önce ekip ekleyin" },
                ...teams.map((t) => ({ value: t.id, label: t.name, searchText: `${t.name} ${t.technician}` })),
              ]}
              value={teamId}
              onChange={setTeamId}
              searchPlaceholder="Ekip ara…"
            />
          </Field>
          {teams.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
              Bu şubede ekip yok. <Link href="/servis-ekipleri">Servis ekipleri</Link> modülünden ekleyin.
            </p>
          ) : null}
          <Field label="Rota başlığı">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Kadıköy 1. Bölge" required />
          </Field>
          <Field label="Bölge / ilçe">
            <Input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Moda, Acıbadem…" />
          </Field>
          <Field label="Sıradaki durak">
            <Input value={nextStop} onChange={(e) => setNextStop(e.target.value)} placeholder="Mahalle / adres notu" />
          </Field>
          <Field label="Planlanan montaj">
            <Input value={planned} onChange={(e) => setPlanned(e.target.value)} type="number" min={0} />
          </Field>
          <Button type="submit" disabled={busy}>
            Rota oluştur
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
