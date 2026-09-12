"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Alert, Button, EmptyState, Field, Input, SearchableSelect } from "@adb/ui";
import { parseApiError } from "@adb/api-client";
import { AdminShell, createAdminApi } from "../../components/admin-shell";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  userId?: string;
  read: boolean;
  createdAt: string;
};

export default function AdminBildirimlerPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; title?: string }>>([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [userId, setUserId] = useState("");
  const [template, setTemplate] = useState("campaign.push");
  const [title, setTitle] = useState("Kampanya hatırlatması");
  const [body, setBody] = useState("Yeni Beko fırsatını kaçırmayın.");
  const [busy, setBusy] = useState(false);
  const [realtimeUrl, setRealtimeUrl] = useState("http://localhost:8102");

  const api = useMemo(() => createAdminApi(), []);

  async function load() {
    const [inbox, tpl] = await Promise.all([api.notifications.inbox(), api.notifications.templates()]);
    setItems((inbox.items as InboxItem[]) || []);
    setTemplates(tpl.items || []);
  }

  useEffect(() => {
    load().catch((e) => {
      setTone("error");
      setMsg(parseApiError(e));
    });
    fetch("/api/public-config")
      .then((r) => r.json())
      .then((c: { realtimeUrl?: string }) => {
        if (c.realtimeUrl) setRealtimeUrl(c.realtimeUrl);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const socket = io(realtimeUrl, {
      transports: ["websocket", "polling"],
      auth: { role: "admin" },
    });
    socket.on("notification", () => {
      load().catch(() => undefined);
    });
    return () => {
      socket.disconnect();
    };
  }, [realtimeUrl]);

  async function send() {
    setBusy(true);
    try {
      await api.notifications.send({
        template,
        channel: "push",
        userId: userId.trim() || undefined,
        title,
        data: { title, body, orderId: "demo" },
      });
      setTone("success");
      setMsg(userId.trim() ? "Bildirim kullanıcıya iletildi" : "Genel duyuru tüm müşterilere iletildi");
      await load();
    } catch (e) {
      setTone("error");
      setMsg(parseApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Bildirimler">
      {msg ? (
        <Alert tone={tone} style={{ marginBottom: 12 }}>
          {msg}
        </Alert>
      ) : null}
      <div className="admin-split-wide">
        <div className="adb-card" style={{ overflow: "hidden" }}>
          <div className="admin-table-wrap">
            {items.length === 0 ? (
              <EmptyState title="Kayıt yok" description="Gönderilen bildirimler burada listelenir." />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "var(--adb-surface-low)", textAlign: "left" }}>
                  <tr>
                    <th style={{ padding: 12 }}>Başlık</th>
                    <th style={{ padding: 12 }}>Hedef</th>
                    <th style={{ padding: 12 }}>Okundu</th>
                    <th style={{ padding: 12 }}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((n) => (
                    <tr key={n.id} style={{ borderTop: "1px solid var(--adb-border-subtle)" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: "var(--adb-muted)" }}>{n.body}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        {!n.userId || n.userId === "__broadcast__" || n.userId === "broadcast"
                          ? "Tüm müşteriler"
                          : n.userId}
                      </td>
                      <td style={{ padding: 12 }}>{n.read ? "Evet" : "Hayır"}</td>
                      <td style={{ padding: 12 }}>{n.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <form
          className="adb-card"
          style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Bildirim gönder</h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--adb-muted)" }}>
            Kullanıcı ID boş bırakılırsa duyuru tüm giriş yapmış müşterilere gider.
          </p>
          <Field label="Kullanıcı ID (boş = genel duyuru)">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="opsiyonel" />
          </Field>
          <Field label="Şablon">
            <SearchableSelect
              options={(templates.length ? templates : [{ id: "campaign.push", title: "Kampanya" }]).map((t) => ({
                value: t.id,
                label: t.title || t.id,
              }))}
              value={template}
              onChange={setTemplate}
            />
          </Field>
          <Field label="Başlık">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Mesaj">
            <Input value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Gönderiliyor…" : "Gönder"}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
