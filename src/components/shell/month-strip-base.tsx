"use client";

import Link from "next/link";
import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontally scrollable month picker.
 *
 * Shows a window around the active month and auto-scrolls it into view, so on a
 * phone the current month is always where your thumb expects it.
 */
export function MonthStripBase({
  active,
  href,
  monthsBefore = 6,
  monthsAfter = 6,
}: {
  active: string;
  href: (month: string) => string;
  monthsBefore?: number;
  monthsAfter?: number;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);

  const months = useMemo(() => {
    const [year, month] = active.split("-").map(Number);
    const anchor = new Date(year, month - 1, 1);
    const list: { key: string; label: string; year: number }[] = [];

    for (let i = -monthsBefore; i <= monthsAfter; i++) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + i, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        year: d.getFullYear(),
      });
    }
    return list;
  }, [active, monthsBefore, monthsAfter]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {months.map((m) => {
        const isActive = m.key === active;
        return (
          <Link
            key={m.key}
            ref={isActive ? activeRef : undefined}
            href={href(m.key)}
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2 transition",
              isActive
                ? "border-pink-500 bg-pink-500 text-white"
                : "surface hover:border-pink-300"
            )}
          >
            <span className="text-sm font-semibold leading-tight">{m.label}</span>
            <span className={cn("text-[10px] leading-tight", isActive ? "text-white/70" : "muted")}>
              {m.year}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
