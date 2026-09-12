"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { createApiClient, getStoreAccessToken } from "@adb/api-client";
import { useStoreAuth } from "../hooks/use-store-auth";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ compact }: { compact?: boolean }) {
  const auth = useStoreAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [realtimeUrl, setRealtimeUrl] = useState("http://localhost:8102");

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        getAccessToken: () => getStoreAccessToken(),
      }),
    [],
  );

  const unread = items.filter((i) => !i.read).length;

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
    let cancelled = false;
    api.notifications
      .inbox({ userId: auth.userId })
      .then((r) => {
        if (!cancelled) setItems((r.items as InboxItem[]) || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth.ready, auth.loggedIn, auth.userId, api.notifications]);

  useEffect(() => {
    if (!auth.ready || !auth.loggedIn || !auth.userId) return;
    let socket: Socket | null = null;
    try {
      socket = io(realtimeUrl, {
        transports: ["websocket", "polling"],
        auth: { userId: auth.userId, role: "customer" },
      });
      socket.on("notification", (payload: { id?: string; title?: string; body?: string; createdAt?: string }) => {
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
            },
            ...prev,
          ].slice(0, 40);
        });
      });
    } catch {
      /* optional */
    }
    return () => {
      socket?.disconnect();
    };
  }, [auth.ready, auth.loggedIn, auth.userId, realtimeUrl]);

  if (!auth.ready || !auth.loggedIn) return null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        className="adb-btn adb-btn-tertiary adb-header-icon-btn"
        style={{ height: compact ? 40 : 40, width: 40, padding: 0, position: "relative" }}
        aria-label="Bildirimler"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unread > 0 ? (
          <span className="adb-notif-badge">{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="adb-card adb-animate-fade adb-notif-popover">
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--adb-border-subtle)", display: "flex", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13 }}>Bildirimler</strong>
            <Link href="/hesabim/bildirimler" onClick={() => setOpen(false)} style={{ fontSize: 12, fontWeight: 700, color: "var(--adb-primary)" }}>
              Tümü
            </Link>
          </div>
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {items.length === 0 ? (
              <p style={{ margin: 0, padding: 16, fontSize: 13, color: "var(--adb-muted)" }}>Henüz bildirim yok.</p>
            ) : (
              items.slice(0, 8).map((n) => (
                <Link
                  key={n.id}
                  href="/hesabim/bildirimler"
                  onClick={() => setOpen(false)}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--adb-border-subtle)",
                    background: n.read ? "#fff" : "rgba(0,86,179,0.04)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--adb-muted)", marginTop: 4, lineHeight: 1.4 }}>{n.body}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
