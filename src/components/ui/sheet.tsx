"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet on mobile, centred dialog on desktop.
 *
 * Sheets rather than full pages for create/edit flows: on a phone this keeps
 * the user's place in the list they came from, which is how the team actually
 * works — glance, act, return.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Stop the page behind the sheet from scrolling.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-[var(--surface-raised)] shadow-2xl",
          "sm:max-w-lg sm:rounded-3xl",
          "animate-[slideUp_.22s_ease-out]",
          className
        )}
      >
        {/* Drag affordance — signals "swipe/tap away" on touch. */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--border-subtle)]" />
        </div>

        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
              {description && <p className="muted mt-1 text-sm">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="flex gap-2 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>

      <style>{`@keyframes slideUp{from{transform:translateY(12px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}
