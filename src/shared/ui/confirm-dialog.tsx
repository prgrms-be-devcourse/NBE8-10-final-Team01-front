"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "default" | "danger";
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  confirmTone = "default",
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  const confirmButtonClass =
    confirmTone === "danger"
      ? "border-app-danger/35 bg-app-danger/15 text-app-danger hover:border-app-danger/50 hover:bg-app-danger/20"
      : "border-app-accent/45 bg-gradient-to-r from-app-accent to-app-accent-hover text-white hover:from-app-accent-hover hover:to-app-accent";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-app-base/55 px-4 backdrop-blur-[1px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-app-border/80 bg-app-surface p-4 text-app-primary shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mt-2 text-xs leading-6 text-app-secondary">{description}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="rounded-md border border-app-border bg-app-elevated px-3 py-1.5 text-xs font-semibold text-app-secondary transition hover:border-app-border-strong hover:bg-app-elevated/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
