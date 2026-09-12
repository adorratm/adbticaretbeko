"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import Link from "next/link";
import { Alert, Button, EmptyState } from "@adb/ui";
import { createApiClient, getStoreAccessToken, parseApiError } from "@adb/api-client";
import { StorefrontShell } from "../../../components/site-shell";
import { useStoreAuth } from "../../../hooks/use-store-auth";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  broadcast?: boolean;
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function BildirimlerPage() {
  const auth = useStoreAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [msg, setMsg] = useState("");
  const [realtimeUrl, setRealtimeUrl] = useState("http://localhost:8102");

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        getAccessToken: () => getStoreAccessToken(),
      }),
    [],
  );

  useEffect(() => {
    fetch("/api/public-config")
      .then((r) => r.json())
      .then((c: { realtimeUrl?: string }) => {
        if (c.realtimeUrl) setRealtimeUrl(c.realtimeUrl);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!auth.ready || !auth.loggedIn || !auth.userId) return;
    api.notifications
      .inbox({ userId: auth.userId })
      .then((r) => setItems((r.items as InboxItem[]) || []))
      .catch((e) => setMsg(parseApiError(e)));
  }, [auth.ready, auth.loggedIn, auth.userId, api.notifications]);

  useEffect(() => {
    if (!auth.ready || !auth.loggedIn || !auth.userId) return;
    const socket = io(realtimeUrl, {
      transports: ["websocket", "polling"],
      auth: { userId: auth.userId, role: "customer" },
    });
    socket.on("notification", (payload: InboxItem & { id?: string }) => {
      setItems((prev) => {
        const id = payload.id || `live-${Date.now()}`;
        if (prev.some((x) => x.id === id)) return prev;
        return [
          {
            id,
            title: payload.title || "Bildirim",
            body: payload.body || "",
            read: false,
            createdAt: payload.createdAt || new Date().toISOString(),
            broadcast: payload.broadcast,
          },
          ...prev,
        ];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [auth.ready, auth.loggedIn, auth.userId, realtimeUrl]);

  if (auth.ready && !auth.loggedIn) {
    return (
      <StorefrontShell>
        <main className="adb-container" style={{ padding: "48px 24px" }}>
          <EmptyState title="Giriş gerekli" description="Bildirimlerinizi görmek için hesabınıza giriş yapın." />
          <Link
            href="/auth/login?next=/hesabim/bildirimler"
            className="adb-btn adb-btn-primary"
            style={{ marginTop: 16, textDecoration: "none", display: "inline-flex" }}
          >
            Giriş Yap
          </Link>
        </main>
      </StorefrontShell>
    );
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <StorefrontShell>
      <main>
        <section
          style={{
            background: "linear-gradient(180deg, var(--adb-surface) 0%, var(--adb-surface-low) 100%)",
            padding: "28px 0 8px",
            borderBottom: "1px solid var(--adb-border-subtle)",
          }}
        >
          <div className="adb-container" style={{ paddingBottom: 20 }}>
            <p className="adb-label-sm" style={{ color: "var(--adb-primary)", margin: 0 }}>
              Hesabım
            </p>
            <h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>Bildirimler</h1>
            <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 14 }}>
              {items.length === 0
                ? "Sipariş, montaj ve kampanya duyuruları burada listelenir."
                : `${items.length} bildirim${unread ? ` · ${unread} okunmamış` : ""}`}
            </p>
          </div>
        </section>

        <section className="adb-container" style={{ padding: "24px 24px 64px", maxWidth: 800 }}>
          {msg ? (
            <Alert tone="error" style={{ marginBottom: 12 }}>
              {msg}
            </Alert>
          ) : null}

          {items.length === 0 ? (
            <div className="adb-card" style={{ padding: 28, textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--adb-primary)" }}>
                notifications
              </span>
              <h2 style={{ margin: "12px 0 6px", fontSize: 18 }}>Henüz bildirim yok</h2>
              <p style={{ margin: 0, color: "var(--adb-muted)", fontSize: 14, lineHeight: 1.55 }}>
                Sipariş durumu, montaj randevusu ve kampanya duyuruları burada görünür.
              </p>
              <Link href="/kampanyalar" className="adb-btn adb-btn-tertiary" style={{ marginTop: 16, textDecoration: "none", display: "inline-flex" }}>
                Kampanyaları incele
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((n) => (
                <article
                  key={n.id}
                  className="adb-card"
                  style={{
                    padding: 16,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "start",
                    background: n.read ? "#fff" : "rgba(0,86,179,0.04)",
                    borderColor: n.read ? undefined : "rgba(0,86,179,0.18)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: n.read ? "var(--adb-surface-low)" : "var(--adb-primary-container)",
                      color: n.read ? "var(--adb-primary)" : "#fff",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                      {n.broadcast ? "campaign" : "package_2"}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <strong style={{ fontSize: 15 }}>{n.title}</strong>
                      {!n.read ? (
                        <span className="adb-badge adb-badge-service" style={{ textTransform: "none", letterSpacing: 0 }}>
                          Yeni
                        </span>
                      ) : null}
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--adb-muted)", lineHeight: 1.5 }}>{n.body}</p>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--adb-outline)" }}>{formatWhen(n.createdAt)}</div>
                  </div>
                  {!n.read ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      style={{ height: 34, fontSize: 12 }}
                      onClick={async () => {
                        await api.notifications.markRead(n.id);
                        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                      }}
                    >
                      Okundu
                    </Button>
                  ) : (
                    <span />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
