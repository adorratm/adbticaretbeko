"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Sil",
  cancelLabel = "Vazgeç",
  loading = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="adb-confirm-root" role="presentation" onClick={() => !loading && onCancel()}>
      <div
        className="adb-confirm-dialog adb-animate-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="adb-confirm-title"
        aria-describedby={description ? "adb-confirm-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("adb-confirm-icon", tone === "danger" ? "adb-confirm-icon-danger" : "adb-confirm-icon-primary")}>
          <span className="material-symbols-outlined" aria-hidden>
            {tone === "danger" ? "delete_forever" : "help"}
          </span>
        </div>
        <h2 id="adb-confirm-title" className="adb-confirm-title">
          {title}
        </h2>
        {description ? (
          <div id="adb-confirm-desc" className="adb-confirm-desc">
            {description}
          </div>
        ) : null}
        <div className="adb-confirm-actions">
          <Button type="button" variant="tertiary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "promo" : "primary"}
            onClick={onConfirm}
            disabled={loading}
            className={tone === "danger" ? "adb-btn-danger" : undefined}
          >
            {loading ? "İşleniyor…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
