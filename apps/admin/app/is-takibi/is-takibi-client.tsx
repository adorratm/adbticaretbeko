"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { Alert, Button, EmptyState, Field, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";
import { useAdminBranch } from "../../components/admin-branch";
import { OpsLiveMap, type OpsLatLng, type OpsMapPoint } from "../../components/ops-live-map";

type Job = {
  id: string;
  orderId: string;
  teamId: string;
  status: string;
  customerName: string;
  customerPhone: string;
  addressSnapshot: string;
  district: string;
  teamName: string;
  warehouseCode?: string;
  lastLat?: number;
  lastLng?: number;
  lat?: number;
  lng?: number;
  assignedTechnician?: string;
  lastLocationAt?: string;
};

type OrderRow = { id: string; customerName: string; productName: string; district: string; status: string; total: number };
type Team = { id: string; name: string; technician: string };

const ISTANBUL = { lat: 41.015, lng: 28.98 };

function statusLabel(s: string) {
  const map: Record<string, string> = {
    ASSIGNED: "Atandı",
    ACCEPTED: "Kabul",
    EN_ROUTE: "Yolda",
    ON_SITE: "Sahada",
    DONE: "Tamam",
    CANCELLED: "İptal",
  };
  return map[s] || s;
}

function asCoord(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function mapJob(x: Record<string, unknown>): Job {
  return {
    id: String(x.id),
    orderId: String(x.orderId || ""),
    teamId: String(x.teamId || ""),
    status: String(x.status || ""),
    customerName: String(x.customerName || ""),
    customerPhone: String(x.customerPhone || ""),
    addressSnapshot: String(x.addressSnapshot || ""),
    district: String(x.district || ""),
    teamName: String(x.teamName || ""),
    warehouseCode: String(x.warehouseCode || ""),
    lastLat: asCoord(x.lastLat),
    lastLng: asCoord(x.lastLng),
    lat: asCoord(x.lat),
    lng: asCoord(x.lng),
    assignedTechnician: String(x.assignedTechnician || ""),
    lastLocationAt: x.lastLocationAt ? String(x.lastLocationAt) : undefined,
  };
}

function jobPoint(j: Job): { lat: number; lng: number; live: boolean } | null {
  const liveLat = asCoord(j.lastLat);
  const liveLng = asCoord(j.lastLng);
  if (liveLat != null && liveLng != null) return { lat: liveLat, lng: liveLng, live: true };
  const lat = asCoord(j.lat);
  const lng = asCoord(j.lng);
  if (lat != null && lng != null) return { lat, lng, live: false };
  return null;
}

export default function IsTakibiClient() {
  const searchParams = useSearchParams();
  const { branchCode, branch, ready: branchReady } = useAdminBranch();
  const api = useMemo(() => createAdminApi(), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [socketOk, setSocketOk] = useState(false);
  const [planned, setPlanned] = useState<OpsLatLng[]>([]);
  const [trail, setTrail] = useState<OpsLatLng[]>([]);

  useEffect(() => {
    const q = searchParams.get("orderId");
    if (q) setOrderId(q);
  }, [searchParams]);

  const loadTrail = useCallback(
    async (jobId: string) => {
      try {
        const data = await api.serviceJobs.trail(jobId);
        setPlanned(
          (data.planned || []).map((p) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
            label: p.label,
          })),
        );
        setTrail(
          (data.trail || []).map((p) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
          })),
        );
      } catch {
        setPlanned([]);
        setTrail([]);
      }
    },
    [api],
  );

  const load = useCallback(async () => {
    const [branchJobs, allJobs, o, t] = await Promise.all([
      api.serviceJobs.list({ warehouse: branchCode }),
      api.serviceJobs.list(),
      api.orders.list(),
      api.serviceTeams.list(branchCode),
    ]);

    const mappedBranch = (branchJobs.items || []).map((x) => mapJob(x as Record<string, unknown>));
    const mappedAll = (allJobs.items || []).map((x) => mapJob(x as Record<string, unknown>));
    // Şube filtresi boşsa tüm işleri göster (yanlış warehouse kodu yüzünden harita boş kalmasın)
    setJobs(mappedBranch.length > 0 ? mappedBranch : mappedAll);

    setOrders(
      (o.items as OrderRow[]).map((x) => ({
        id: String(x.id),
        customerName: String(x.customerName || ""),
        productName: String(x.productName || ""),
        district: String(x.district || ""),
        status: String(x.status || ""),
        total: Number(x.total) || 0,
      })),
    );
    const teamItems = (t.items || []) as Team[];
    setTeams(teamItems);
    setTeamId((prev) => prev || teamItems[0]?.id || "");
  }, [api, branchCode]);

  useEffect(() => {
    if (!branchReady) return;
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
    const poll = setInterval(() => {
      load().catch(() => undefined);
    }, 5000);
    return () => clearInterval(poll);
  }, [load, branchReady]);

  useEffect(() => {
    if (!selectedJobId) {
      setPlanned([]);
      setTrail([]);
      return;
    }
    loadTrail(selectedJobId).catch(() => undefined);
  }, [selectedJobId, loadTrail]);

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetch("/api/public-config").then((r) => r.json()).catch(() => ({}));
        const url = cfg.realtimeUrl || process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:8102";
        if (cancelled) return;
        socket = io(url, { auth: { role: "admin" }, transports: ["websocket", "polling"] });
        socket.on("connect", () => {
          setSocketOk(true);
          socket?.emit("join", "ops");
          socket?.emit("join", "admins");
        });
        socket.on("disconnect", () => setSocketOk(false));
        socket.on("connect_error", () => setSocketOk(false));
        socket.on("job.location", (data: { jobId?: string; lat?: number; lng?: number; at?: string }) => {
          if (!data.jobId || data.lat == null || data.lng == null) return;
          setJobs((prev) => {
            const exists = prev.some((j) => j.id === data.jobId);
            if (!exists) {
              load().catch(() => undefined);
              return prev;
            }
            return prev.map((j) =>
              j.id === data.jobId
                ? {
                    ...j,
                    lastLat: Number(data.lat),
                    lastLng: Number(data.lng),
                    lastLocationAt: data.at || new Date().toISOString(),
                  }
                : j,
            );
          });
          setSelectedJobId((cur) => {
            if (cur === data.jobId) {
              setTrail((prev) => {
                const lat = Number(data.lat);
                const lng = Number(data.lng);
                const last = prev[prev.length - 1];
                if (last && Math.abs(last.lat - lat) < 1e-6 && Math.abs(last.lng - lng) < 1e-6) return prev;
                return [...prev, { lat, lng }];
              });
            }
            return cur;
          });
        });
        socket.on("job.status", () => {
          load().catch(() => undefined);
        });
      } catch {
        setSocketOk(false);
      }
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [load]);

  async function createJob() {
    if (!orderId || !teamId) {
      setTone("error");
      setMsg("Sipariş ve ekip seçin");
      return;
    }
    setBusy(true);
    try {
      const created = await api.serviceJobs.create({
        orderId,
        teamId,
        warehouseCode: branchCode,
        lat: ISTANBUL.lat + (Math.random() - 0.5) * 0.08,
        lng: ISTANBUL.lng + (Math.random() - 0.5) * 0.1,
      });
      setTone("success");
      setMsg(`İş emri ve planlı rota oluşturuldu: ${created.id.slice(0, 8)}`);
      setSelectedJobId(created.id);
      await load();
      await loadTrail(created.id);
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createRoute(job: Job) {
    setBusy(true);
    try {
      await api.serviceJobs.createRoute(job.id);
      await loadTrail(job.id);
      setTone("success");
      setMsg("Planlı rota oluşturuldu (şube → müşteri)");
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function simulateLocation(job: Job) {
    setBusy(true);
    try {
      let lat: number;
      let lng: number;
      if (planned.length >= 2 && selectedJobId === job.id) {
        const cur = jobPoint(job);
        let idx = 0;
        if (cur) {
          let best = Number.POSITIVE_INFINITY;
          planned.forEach((p, i) => {
            const d = (p.lat - cur.lat) ** 2 + (p.lng - cur.lng) ** 2;
            if (d < best) {
              best = d;
              idx = i;
            }
          });
          idx = Math.min(idx + 1, planned.length - 1);
        }
        const target = planned[idx] || planned[0];
        if (!target) {
          const base = jobPoint(job) || ISTANBUL;
          lat = base.lat + (Math.random() - 0.5) * 0.012;
          lng = base.lng + (Math.random() - 0.5) * 0.012;
        } else {
          lat = target.lat + (Math.random() - 0.5) * 0.0008;
          lng = target.lng + (Math.random() - 0.5) * 0.0008;
        }
      } else {
        const base = jobPoint(job) || ISTANBUL;
        lat = base.lat + (Math.random() - 0.5) * 0.012;
        lng = base.lng + (Math.random() - 0.5) * 0.012;
      }
      await api.serviceJobs.location(job.id, {
        teamId: job.teamId || teamId || "admin",
        pin: "1234",
        lat,
        lng,
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, lastLat: lat, lastLng: lng, lastLocationAt: new Date().toISOString() }
            : j,
        ),
      );
      setSelectedJobId(job.id);
      setTrail((prev) => [...prev, { lat, lng }]);
      setTone("success");
      setMsg("Konum izi güncellendi — yeşil çizgi geçilen yolu gösterir");
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const selected = jobs.find((j) => j.id === selectedJobId) || null;
  const selectedPoint = selected ? jobPoint(selected) : null;
  const trackedCount = jobs.filter((j) => jobPoint(j)?.live).length;
  const assignableOrders = orders.filter((o) => !["CANCELLED", "PAYMENT_PENDING"].includes(o.status)).slice(0, 40);

  const mapPoints: OpsMapPoint[] = useMemo(
    () =>
      jobs
        .map((j) => {
          const pt = jobPoint(j);
          if (!pt) return null;
          return {
            id: j.id,
            lat: pt.lat,
            lng: pt.lng,
            live: pt.live,
            selected: j.id === selectedJobId,
            label: j.customerName || "İş",
            popupHtml: `<strong>${j.customerName || "İş"}</strong><br/>${statusLabel(j.status)} · ${
              j.teamName || ""
            }<br/>${pt.live ? "Canlı konum" : "Başlangıç konumu"}<br/><small>${pt.lat.toFixed(5)}, ${pt.lng.toFixed(
              5,
            )}</small>`,
          } satisfies OpsMapPoint;
        })
        .filter(Boolean) as OpsMapPoint[],
    [jobs, selectedJobId],
  );

  return (
    <AdminShell title="İş Takibi">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Canlı servis / iş takibi</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adb-muted)" }}>
            Şube: {branch?.name || branchCode} · Socket: {socketOk ? "bağlı" : "kapalı"} · Harita:{" "}
            {mapError ? "hata" : mapReady ? "hazır" : "yükleniyor"} · Nokta: {mapPoints.length} · Canlı: {trackedCount}
            {selectedJobId ? ` · Rota: ${planned.length} · İz: ${trail.length}` : ""} ·{" "}
            <a href="http://localhost:3002" target="_blank" rel="noreferrer" style={{ color: "var(--adb-primary)", fontWeight: 700 }}>
              Teknisyen paneli →
            </a>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/servis-ekipleri" className="adb-btn adb-btn-tertiary" style={{ height: 36 }}>
            Ekipler
          </Link>
          <Link href="/servis-rotalari" className="adb-btn adb-btn-tertiary" style={{ height: 36 }}>
            Rotalar
          </Link>
        </div>
      </div>

      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      {mapError ? (
        <Alert tone="error" style={{ marginBottom: 12 }}>
          Harita: {mapError}
        </Alert>
      ) : null}

      <div
        className="admin-ops-grid"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr) minmax(0, 280px)",
        }}
      >
        <aside className="adb-card" style={{ padding: 12, maxHeight: "70vh", overflow: "auto" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Aktif işler ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <EmptyState title="İş yok" description="Sağdan sipariş atayın." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {jobs.map((j) => {
                const pt = jobPoint(j);
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setSelectedJobId(j.id)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 8,
                      border: selectedJobId === j.id ? "1px solid var(--adb-primary)" : "1px solid var(--adb-border-subtle)",
                      background: selectedJobId === j.id ? "rgba(0,86,179,0.06)" : "var(--adb-surface-low)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{j.customerName || "Müşteri"}</div>
                    <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>
                      {statusLabel(j.status)} · {j.teamName || "Ekip yok"}
                      {pt?.live ? " · Canlı" : pt ? " · Konum var" : " · Konum yok"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div
          className="adb-card adb-ops-map-card"
          style={{ padding: 0, overflow: "hidden", minHeight: 420, height: "70vh", position: "relative" }}
        >
          <OpsLiveMap
            points={mapPoints}
            selectedId={selectedJobId}
            planned={planned}
            trail={trail}
            onReady={() => {
              setMapReady(true);
              setMapError("");
            }}
            onError={(m) => setMapError(m)}
          />
          {mapReady && mapPoints.length === 0 ? (
            <div
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                zIndex: 500,
                background: "rgba(255,255,255,0.95)",
                border: "1px solid var(--adb-border-subtle)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                maxWidth: 280,
              }}
            >
              Haritada nokta yok. İş oluşturun veya seçip “Konumu simüle et” deyin.
            </div>
          ) : null}
        </div>

        <aside className="adb-card" style={{ padding: 12, display: "grid", gap: 12, alignContent: "start" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>İş emri oluştur</h3>
          <Field label="Sipariş">
            <SearchableSelect
              options={assignableOrders.map((o) => ({
                value: o.id,
                label: `${o.id.slice(0, 8)} · ${o.customerName || "Müşteri"} · ${o.productName || ""}`,
                searchText: `${o.id} ${o.customerName} ${o.productName} ${o.district}`,
              }))}
              value={orderId}
              onChange={setOrderId}
              searchPlaceholder="Sipariş ara…"
            />
          </Field>
          <Field label="Ekip">
            <SearchableSelect
              options={teams.map((t) => ({ value: t.id, label: `${t.name}${t.technician ? ` · ${t.technician}` : ""}` }))}
              value={teamId}
              onChange={setTeamId}
              searchPlaceholder="Ekip ara…"
            />
          </Field>
          <Button type="button" disabled={busy} onClick={createJob}>
            Ata & oluştur
          </Button>

          {selected ? (
            <div style={{ paddingTop: 8, borderTop: "1px solid var(--adb-border-subtle)", display: "grid", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{selected.customerName}</strong>
              <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{selected.addressSnapshot}</div>
              <div style={{ fontSize: 12 }}>Durum: {statusLabel(selected.status)}</div>
              <div style={{ fontSize: 12 }}>
                Konum:{" "}
                {selectedPoint
                  ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}${selectedPoint.live ? " (canlı)" : ""}`
                  : "Henüz yok"}
              </div>
              <div style={{ fontSize: 12 }}>
                Planlı rota: {planned.length} nokta · Geçilen yol: {trail.length} nokta
              </div>
              {selected.lastLocationAt ? (
                <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>
                  Son güncelleme: {new Date(selected.lastLocationAt).toLocaleTimeString("tr-TR")}
                </div>
              ) : null}
              <Button type="button" variant="tertiary" disabled={busy} onClick={() => createRoute(selected)}>
                Rota oluştur
              </Button>
              <Button type="button" variant="tertiary" disabled={busy} onClick={() => simulateLocation(selected)}>
                Konumu simüle et (rota üzerinde)
              </Button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
              Soldan bir iş seçin; planlı rota (mavi kesik) ve geçilen yol (yeşil) haritada görünür.
            </p>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
