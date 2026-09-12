"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAdminApi } from "./admin-shell";

export type SearchHit = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription?: string;
  status?: string;
  categoryName?: string;
};

type Props = {
  valueId?: string;
  valueLabel?: string;
  placeholder?: string;
  onSelect: (hit: SearchHit | null) => void;
  className?: string;
};

export function ProductSearchField({
  valueId,
  valueLabel,
  placeholder = "Ürün adı, SKU, slug veya ID ara…",
  onSelect,
  className,
}: Props) {
  const [q, setQ] = useState(valueLabel || "");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backend, setBackend] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const api = useMemo(() => createAdminApi(), []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (valueLabel) setQ(valueLabel);
  }, [valueLabel]);

  function updatePos() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, hits.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t)) return;
      if ((e.target as HTMLElement)?.closest?.("[data-adb-product-search-portal]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setBackend("");
      return;
    }
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const res = await api.search.query({ q: term });
        setHits(
          (res.items || []).map((i) => ({
            id: i.id,
            sku: i.sku,
            name: i.name,
            slug: i.slug,
            shortDescription: i.shortDescription,
            status: i.status,
            categoryName: i.categoryName,
          })),
        );
        setBackend(res.backend || "");
        setOpen(true);
      } catch {
        try {
          const res = await api.products.list({ q: term });
          setHits(
            (res.items || []).map((i) => ({
              id: i.id,
              sku: i.sku,
              name: i.name,
              slug: i.slug,
              shortDescription: i.shortDescription,
              status: i.status,
            })),
          );
          setBackend("catalog");
          setOpen(true);
        } catch {
          setHits([]);
        }
      } finally {
        setBusy(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, api]);

  const panel =
    open && mounted && hits.length > 0
      ? createPortal(
          <ul
            data-adb-product-search-portal
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, 240),
              zIndex: 10050,
              margin: 0,
              padding: 6,
              listStyle: "none",
              background: "#fff",
              border: "1px solid var(--adb-border-subtle)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(17, 28, 45, 0.12), 0 2px 8px rgba(17, 28, 45, 0.06)",
              maxHeight: "min(320px, 50vh)",
              overflow: "auto",
            }}
          >
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQ(`${h.name} (${h.sku})`);
                    setOpen(false);
                    onSelect(h);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    padding: "10px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "grid",
                    gap: 2,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--adb-surface-low)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span style={{ fontWeight: 650, fontSize: 13, overflowWrap: "anywhere" }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: "var(--adb-muted)", overflowWrap: "anywhere" }}>
                    {h.sku}
                    {h.categoryName ? ` · ${h.categoryName}` : ""}
                    {h.status ? ` · ${h.status}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={boxRef} className={className} style={{ position: "relative", display: "grid", gap: 6 }}>
      <input
        ref={inputRef}
        className="adb-input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          if (valueId) onSelect(null);
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {valueId ? (
        <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>
          Seçili ID: <code>{valueId.slice(0, 8)}…</code>
          {backend ? ` · arama: ${backend}` : null}
          <button
            type="button"
            style={{
              marginLeft: 8,
              border: "none",
              background: "transparent",
              color: "var(--adb-primary)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
            onClick={() => {
              setQ("");
              onSelect(null);
            }}
          >
            Temizle
          </button>
        </div>
      ) : busy ? (
        <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>Aranıyor…</div>
      ) : backend ? (
        <div style={{ fontSize: 11, color: "var(--adb-muted)" }}>Motor: {backend}</div>
      ) : null}
      {panel}
    </div>
  );
}
