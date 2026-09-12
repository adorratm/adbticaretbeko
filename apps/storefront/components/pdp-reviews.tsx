"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, TextArea } from "@adb/ui";
import { getStoreAccessToken, getStoreUser, parseApiError } from "@adb/api-client";
import { createStoreApi } from "../lib/store-api";

type Review = {
  id: string;
  customerName?: string;
  rating: number;
  title?: string;
  body: string;
  createdAt?: string;
};

export function PdpReviews({ productId }: { productId: string }) {
  const [items, setItems] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await createStoreApi().reviews.list(productId);
    setItems(res.items);
    setAverage(res.average || 0);
    setCount(res.count || 0);
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!getStoreAccessToken()) {
      window.location.href = "/auth/login?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const user = getStoreUser();
      await createStoreApi().reviews.create({
        productId,
        customerId: user?.userId,
        customerName: user?.email?.split("@")[0] || "Musteri",
        rating,
        title,
        body,
      });
      setTitle("");
      setBody("");
      setTone("success");
      setMsg("Yorumunuz yayınlandı");
      await load();
    } catch (err) {
      setTone("error");
      setMsg(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <h2 className="adb-headline-md" style={{ margin: 0 }}>
          Müşteri yorumları
        </h2>
        <div style={{ fontSize: 14, color: "var(--adb-muted)" }}>
          {count > 0 ? (
            <>
              Ortalama <strong style={{ color: "var(--adb-on-surface)" }}>{average.toFixed(1)}</strong> / 5 · {count} yorum
            </>
          ) : (
            "Henüz yorum yok"
          )}
        </div>
      </div>

      <div className="adb-pdp-reviews-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr) minmax(0,320px)", marginTop: 14 }}>
        <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
          {items.length === 0 ? (
            <div className="adb-card" style={{ padding: 20, color: "var(--adb-muted)" }}>
              İlk yorumu siz yazın — montaj ve ürün deneyiminizi paylaşın.
            </div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="adb-card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{r.customerName || "Müşteri"}</strong>
                  <span style={{ color: "#d97706", fontWeight: 700 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                {r.title ? <div style={{ marginTop: 4, fontWeight: 600 }}>{r.title}</div> : null}
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--adb-muted)" }}>{r.body}</p>
              </div>
            ))
          )}
        </div>

        <form className="adb-card" style={{ padding: 16, display: "grid", gap: 10, height: "fit-content" }} onSubmit={onSubmit}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Yorum yaz</h3>
          <Field label="Puan">
            <select className="adb-input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} yıldız
                </option>
              ))}
            </select>
          </Field>
          <Field label="Başlık">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Montaj hızlıydı" />
          </Field>
          <Field label="Yorum">
            <TextArea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} placeholder="Deneyiminizi yazın…" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Gönderiliyor…" : "Gönder"}
          </Button>
          {msg ? <Alert tone={tone}>{msg}</Alert> : null}
        </form>
      </div>
    </section>
  );
}
