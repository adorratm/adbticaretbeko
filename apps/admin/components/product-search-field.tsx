"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const boxRef = useRef<HTMLDivElement>(null);
  const api = useMemo(() => createAdminApi(), []);

  useEffect(() => {
    if (valueLabel) setQ(valueLabel);
  }, [valueLabel]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={boxRef} className={className} style={{ position: "relative", display: "grid", gap: 6 }}>
      <input
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

      {open && hits.length > 0 ? (
        <ul
          style={{
            position: "absolute",
            zIndex: 40,
            top: "100%",
            left: 0,
            right: 0,
            margin: "4px 0 0",
            padding: 6,
            listStyle: "none",
            background: "#fff",
            border: "1px solid var(--adb-border-subtle)",
            borderRadius: 10,
            boxShadow: "var(--adb-shadow-hover)",
            maxHeight: 260,
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
                <span style={{ fontWeight: 650, fontSize: 13 }}>{h.name}</span>
                <span style={{ fontSize: 11, color: "var(--adb-muted)" }}>
                  {h.sku}
                  {h.categoryName ? ` · ${h.categoryName}` : ""}
                  {h.status ? ` · ${h.status}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
