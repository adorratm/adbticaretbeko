"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

export type SelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

export type SearchableSelectProps = {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  name?: string;
  id?: string;
  clearable?: boolean;
};

export function SearchableSelect({
  options,
  value = "",
  onChange,
  placeholder = "Seçin…",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç yok",
  disabled,
  error,
  className,
  name,
  id,
  clearable = false,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 320, preferUp: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = (o.searchText || `${o.label} ${o.value}`).toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 200), window.innerWidth - 16);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, preferUp ? spaceAbove : spaceBelow, window.innerHeight * 0.5));
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (left < 8) left = 8;
    const top = preferUp ? Math.max(8, r.top - 6 - maxHeight) : r.bottom + 6;
    setPos({ top, left, width, maxHeight, preferUp });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onScroll = () => updatePos();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if ((e.target as HTMLElement)?.closest?.("[data-adb-sselect-portal]")) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(v: string) {
    onChange?.(v);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.value);
    }
  }

  const panel =
    open && mounted
      ? createPortal(
          <div
            data-adb-sselect-portal
            className="adb-sselect-panel adb-sselect-panel-portal"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, 200),
              maxHeight: pos.maxHeight,
              zIndex: 10050,
            }}
            role="presentation"
          >
            <div className="adb-sselect-search-wrap">
              <input
                ref={inputRef}
                className="adb-sselect-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-autocomplete="list"
                aria-controls={listId}
              />
            </div>
            <ul id={listId} className="adb-sselect-list" role="listbox">
              {filtered.length === 0 ? (
                <li className="adb-sselect-empty">{emptyText}</li>
              ) : (
                filtered.map((opt, i) => (
                  <li key={opt.value || `opt-${i}`} role="option" aria-selected={opt.value === value}>
                    <button
                      type="button"
                      className={cn(
                        "adb-sselect-option",
                        opt.value === value && "adb-sselect-option-active",
                        i === highlight && "adb-sselect-option-hi",
                      )}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("adb-sselect", open && "adb-sselect-open", error && "adb-sselect-error", className)} onKeyDown={onKeyDown}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="adb-sselect-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
      >
        <span className={cn("adb-sselect-value", !selected && "adb-sselect-placeholder")}>
          {selected?.label || placeholder}
        </span>
        <span className="adb-sselect-actions">
          {clearable && value ? (
            <span
              role="button"
              tabIndex={-1}
              className="adb-sselect-clear"
              aria-label="Temizle"
              onClick={(e) => {
                e.stopPropagation();
                pick("");
              }}
            >
              ×
            </span>
          ) : null}
          <span className="adb-sselect-chevron" aria-hidden>
            ▾
          </span>
        </span>
      </button>
      {panel}
    </div>
  );
}
