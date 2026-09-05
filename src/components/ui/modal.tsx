"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Modal đơn giản: overlay + panel, đóng bằng Esc hoặc click nền. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-ink-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          // Mobile: bám đáy màn hình như bottom sheet, cao tối đa 92% và tự cuộn
          "my-auto max-h-[92dvh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-t-2xl border bg-card text-foreground shadow-soft sm:max-h-[88vh] sm:rounded-xl",
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card px-4 py-3.5 sm:px-5 sm:py-4">
          <h3 className="min-w-0 text-base font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </div>
    </div>
  );
}
