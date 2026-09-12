"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApiClient, parseApiError } from "@adb/api-client";
import { Alert, Button, Field, Input, SearchableSelect } from "@adb/ui";

type Team = { id: string; name: string; technician: string; warehouseCode: string; accessPin?: string };
type Job = {
  id: string;
  orderId: string;
  status: string;
  customerName: string;
  customerPhone: string;
  addressSnapshot: string;
  district: string;
  notes: string;
  assignedTechnician: string;
};

const STATUS_FLOW = ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ON_SITE", "DONE"] as const;

function nextStatus(cur: string) {
  const i = STATUS_FLOW.indexOf(cur as (typeof STATUS_FLOW)[number]);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1]!;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    ASSIGNED: "Atandı",
    ACCEPTED: "Kabul",
    EN_ROUTE: "Yoldayım",
    ON_SITE: "Sahada",
    DONE: "Tamam",
    CANCELLED: "İptal",
  };
  return map[s] || s;
}

function nextActionLabel(s: string) {
  const map: Record<string, string> = {
    ASSIGNED: "İşi kabul et",
    ACCEPTED: "Yola çık",
    EN_ROUTE: "Sahaya vardım",
    ON_SITE: "İşi tamamla",
  };
  return map[s] || statusLabel(nextStatus(s) || "");
}

function mapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

const SESSION_KEY = "adb_tech_session";

export default function TechnicianHome() {
  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080",
      }),
    [],
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<{ teamId: string; pin: string; teamName: string } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    api.serviceTeams
      .directory()
      .then((r) => {
        setTeams((r.items || []) as Team[]);
        if (!r.items?.length) setMsg("Aktif ekip yok. Admin > Servis Ekipleri'nden ekip ekleyin.");
      })
      .catch((e) => setMsg(`Ekip listesi alınamadı: ${parseApiError(e)}`));
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [api]);

  const loadJobs = useCallback(async () => {
    if (!session) return;
    const res = await api.serviceJobs.mine(session.teamId, session.pin);
    setJobs(
      (res.items || []).map((j) => ({
        id: String(j.id),
        orderId: String(j.orderId || ""),
        status: String(j.status || ""),
        customerName: String(j.customerName || ""),
        customerPhone: String(j.customerPhone || ""),
        addressSnapshot: String(j.addressSnapshot || ""),
        district: String(j.district || ""),
        notes: String(j.notes || ""),
        assignedTechnician: String(j.assignedTechnician || ""),
      })),
    );
  }, [api, session]);

  useEffect(() => {
    if (!session) return;
    loadJobs().catch((e) => setMsg(parseApiError(e)));
    const t = setInterval(() => {
      loadJobs().catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [session, loadJobs]);

  async function login() {
    setBusy(true);
    setMsg("");
    try {
      await api.serviceJobs.mine(teamId, pin);
      const team = teams.find((t) => t.id === teamId);
      const next = { teamId, pin, teamName: team?.name || "Ekip" };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setJobs([]);
    stopTracking();
  }

  async function advance(job: Job) {
    const ns = nextStatus(job.status);
    if (!ns || !session) return;
    setBusy(true);
    try {
      await api.serviceJobs.update(job.id, { status: ns, teamId: session.teamId, pin: session.pin });
      await loadJobs();
      if (ns === "EN_ROUTE") startTracking(job.id);
      if (ns === "DONE") stopTracking();
    } catch (e) {
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function startTracking(jobId: string) {
    if (!session || !navigator.geolocation) {
      setMsg("Konum bu cihazda kullanılamıyor");
      return;
    }
    stopTracking();
    setTracking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        api.serviceJobs
          .location(jobId, {
            teamId: session.teamId,
            pin: session.pin,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
          .catch(() => undefined);
      },
      () => setMsg("Konum izni gerekli"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  function stopTracking() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setTracking(false);
  }

  const active = jobs.find((j) => j.id === selected) || jobs.find((j) => j.status !== "DONE") || jobs[0] || null;
  const openCount = jobs.filter((j) => j.status !== "DONE" && j.status !== "CANCELLED").length;
  const activeStep = active ? Math.max(0, STATUS_FLOW.indexOf(active.status as (typeof STATUS_FLOW)[number])) : -1;
  const address = active?.addressSnapshot || active?.district || "";

  if (!session) {
    return (
      <main className="tech-shell tech-login">
        <div className="tech-brand-mark tech-rise">
          <p className="tech-brand-word">
            Beko<em>.</em>
          </p>
          <p className="tech-brand-sub">ADB Ticaret yetkili servis — saha iş emirleri ve canlı konum.</p>
        </div>

        {msg ? (
          <Alert tone="error" className="tech-rise-delay" style={{ marginBottom: 12, position: "relative", zIndex: 1 }}>
            {msg}
          </Alert>
        ) : null}

        <div className="tech-login-form tech-rise-delay">
          <Field label="Servis ekibi">
            <SearchableSelect
              options={teams.map((t) => ({
                value: t.id,
                label: `${t.name}${t.technician ? ` · ${t.technician}` : ""}`,
                searchText: `${t.name} ${t.technician} ${t.warehouseCode}`,
              }))}
              value={teamId}
              onChange={setTeamId}
              searchPlaceholder="Ekip ara…"
              placeholder="Ekip seçin…"
            />
          </Field>
          <Field label="Erişim PIN">
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </Field>
          <Button type="button" className="tech-login-cta" disabled={busy || !teamId || !pin} onClick={login}>
            {busy ? "Giriş yapılıyor…" : "Sahaya gir"}
          </Button>
          <p className="tech-pin-hint">PIN, admin panelindeki servis ekibi kaydından gelir.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="tech-shell">
      <header className="tech-topbar">
        <div className="tech-topbar-brand">
          <div className="tech-logo-chip" aria-hidden>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              handyman
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1>{session.teamName}</h1>
            <p>
              <span className={`tech-live-dot${tracking ? " on" : ""}`} aria-hidden />
              {tracking ? "Canlı konum paylaşılıyor" : "Beko yetkili servis"}
            </p>
          </div>
        </div>
        <button type="button" className="tech-ghost-btn" onClick={logout}>
          Çıkış
        </button>
      </header>

      {msg ? (
        <Alert tone="error" className="tech-alert">
          {msg}
        </Alert>
      ) : null}

      <div className="tech-body">
        <div className="tech-section-head tech-rise">
          <h2>İş emirleri</h2>
          <span>{openCount} açık</span>
        </div>

        {jobs.length === 0 ? (
          <div className="tech-empty tech-rise-delay">
            <span className="material-symbols-outlined">assignment</span>
            <h3>Atanmış iş yok</h3>
            <p>Admin panelden iş emri oluşturduğunuzda burada görünür.</p>
          </div>
        ) : (
          <div className="tech-job-list tech-rise-delay">
            {jobs.map((j) => {
              const isActive = active?.id === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  className={`tech-job${isActive ? " is-active" : ""}`}
                  data-status={j.status}
                  onClick={() => setSelected(j.id)}
                >
                  <span className="tech-job-rail" aria-hidden />
                  <span className="tech-job-main">
                    <strong>{j.customerName || "Müşteri"}</strong>
                    <span className="addr">{j.addressSnapshot || j.district || "Adres yok"}</span>
                    <span className="meta">Sipariş #{j.orderId.slice(0, 8)}</span>
                  </span>
                  <span className="tech-status-pill">{statusLabel(j.status)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active ? (
        <div className="tech-dock">
          <div className="tech-dock-inner">
            <div className="tech-dock-head">
              <div className="eyebrow">Aktif iş · {statusLabel(active.status)}</div>
              <h3>{active.customerName || "Müşteri"}</h3>
              {active.customerPhone ? <div className="phone">{active.customerPhone}</div> : null}
              {address ? <div className="addr">{address}</div> : null}
              {active.notes ? <div className="notes">{active.notes}</div> : null}
            </div>

            <div className="tech-steps" aria-hidden>
              {STATUS_FLOW.map((s, i) => (
                <div
                  key={s}
                  className={`tech-step${i < activeStep ? " done" : ""}${i === activeStep ? " current" : ""}`}
                />
              ))}
            </div>

            <div className="tech-dock-actions">
              {nextStatus(active.status) ? (
                <button type="button" className="primary" disabled={busy} onClick={() => advance(active)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {active.status === "ACCEPTED"
                      ? "directions_car"
                      : active.status === "EN_ROUTE"
                        ? "home_pin"
                        : active.status === "ON_SITE"
                          ? "task_alt"
                          : "check_circle"}
                  </span>
                  {busy ? "Güncelleniyor…" : nextActionLabel(active.status)}
                </button>
              ) : (
                <button type="button" className="primary" disabled>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    verified
                  </span>
                  İş tamamlandı
                </button>
              )}

              {active.customerPhone ? (
                <a href={`tel:${active.customerPhone}`} className="secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    call
                  </span>
                  Ara
                </a>
              ) : (
                <button type="button" className="secondary" disabled>
                  Ara
                </button>
              )}

              {address ? (
                <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className="secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    near_me
                  </span>
                  Yol tarifi
                </a>
              ) : active.status === "EN_ROUTE" || active.status === "ON_SITE" ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => (tracking ? stopTracking() : startTracking(active.id))}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {tracking ? "location_off" : "my_location"}
                  </span>
                  {tracking ? "Konumu durdur" : "Konum paylaş"}
                </button>
              ) : (
                <button type="button" className="secondary" disabled>
                  Yol tarifi
                </button>
              )}

              {(active.status === "EN_ROUTE" || active.status === "ON_SITE") && address ? (
                <button
                  type="button"
                  className="secondary"
                  style={{ gridColumn: "1 / -1" }}
                  onClick={() => (tracking ? stopTracking() : startTracking(active.id))}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {tracking ? "location_off" : "share_location"}
                  </span>
                  {tracking ? "Canlı konumu durdur" : "Canlı konum paylaş"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
