"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { cn, formatDate } from "@/lib/utils";
import { parseMonthKey } from "@/lib/month";

import type { AgendaEntry } from "@/lib/agenda";

export type CalendarEntry = AgendaEntry;

/** Colour and icon per source, shared by the grid, legend and day sheet. */
const KIND_STYLE = {
  event:    { dot: "bg-pink-500",   chip: "bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-100",   icon: CalendarDays,  label: "Events" },
  meeting:  { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", icon: Users,      label: "Meetings" },
  task:     { dot: "bg-blue-500",   chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",     icon: ListChecks,    label: "Deadlines" },
  campaign: { dot: "bg-lemon",      chip: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",     icon: Megaphone,     label: "Marketing" },
  approval: { dot: "bg-amber-500",  chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", icon: CheckCircle2,  label: "Approvals" },
  reminder: { dot: "bg-teal-500",   chip: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",     icon: Bell,          label: "Reminders" },
} as const;

type KindStyle = {
  dot: string;
  chip: string;
  icon: LucideIcon;
  label: string;
};

const FALLBACK_STYLE: KindStyle = {
  dot: "bg-ink-400",
  chip: "bg-ink-100 text-ink-700 dark:bg-ink-700 dark:text-ink-100",
  icon: CalendarDays,
  label: "Other",
};

/** Never returns undefined, so a new agenda kind cannot crash the grid. */
function styleFor(kind: string): KindStyle {
  return (KIND_STYLE as Record<string, KindStyle>)[kind] ?? FALLBACK_STYLE;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Local yyyy-mm-dd. Using the ISO string here would shift dates across UTC. */
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function MonthCalendar({
  month,
  entries,
  show,
  onlyMine = false,
}: {
  month: string;
  entries: CalendarEntry[];
  show: string;
  onlyMine?: boolean;
}) {
  const router = useRouter();
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Parsed defensively here as well as on the server: this component must
  // never be the thing that turns a bad URL into a blank screen.
  const { year, month: monthNumber } = parseMonthKey(month);
  // Memoised so the cells grid below actually caches instead of rebuilding
  // 42 Date objects on every render.
  const first = useMemo(() => new Date(year, monthNumber - 1, 1), [year, monthNumber]);

  // The server already applied the kind and "mine" filters.
  const visible = entries;

  /** Every entry keyed by the day it falls on, campaigns filling their range. */
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    for (const entry of visible) {
      const start = new Date(entry.date);
      const end = entry.endDate ? new Date(entry.endDate) : start;

      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      // Guard against a bad range spinning forever.
      let guard = 0;
      while (cursor <= last && guard < 60) {
        const key = dayKey(cursor);
        map.set(key, [...(map.get(key) ?? []), entry]);
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
    }
    return map;
  }, [visible]);

  /** Six weeks of cells, Monday-first, padded with neighbouring days. */
  const cells = useMemo(() => {
    // getDay() is Sunday-first; shift so Monday is column 0.
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, monthNumber - 1, 1 - offset);

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      return {
        date,
        key: dayKey(date),
        inMonth: date.getMonth() === monthNumber - 1,
        isToday: dayKey(date) === dayKey(new Date()),
      };
    });
  }, [first, year, monthNumber]);

  const monthLabel = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const step = (delta: number) => {
    const d = new Date(year, monthNumber - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const dayEntries = openDay ? (byDay.get(openDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/calendar?month=${step(-1)}&show=${show}${onlyMine ? "&mine=1" : ""}`}
          scroll={false}
          aria-label="Previous month"
          className="surface flex size-9 items-center justify-center rounded-xl hover:border-pink-300"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <Link
          href={`/calendar?month=${step(1)}&show=${show}${onlyMine ? "&mine=1" : ""}`}
          scroll={false}
          aria-label="Next month"
          className="surface flex size-9 items-center justify-center rounded-xl hover:border-pink-300"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* What to show */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterChip label="Everything" value="all" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Events" value="event" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Meetings" value="meeting" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Deadlines" value="task" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Marketing" value="campaign" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Approvals" value="approval" active={show} month={month} mine={onlyMine} />
        <FilterChip label="Reminders" value="reminder" active={show} month={month} mine={onlyMine} />

        <Link
          href={`/calendar?month=${month}&show=${show}${onlyMine ? "" : "&mine=1"}`}
          scroll={false}
          className={cn(
            "ml-1 shrink-0 rounded-full px-4 py-2 text-xs font-medium transition",
            onlyMine
              ? "bg-pink-500 text-white"
              : "surface hover:border-pink-300"
          )}
        >
          Just mine
        </Link>
      </div>

      {/* Grid */}
      <Card className="overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              className="pb-1 text-center text-[11px] font-semibold uppercase text-[var(--text-muted)]"
            >
              {d}
            </div>
          ))}

          {cells.map((cell) => {
            const items = byDay.get(cell.key) ?? [];
            const shown = items.slice(0, 3);

            return (
              <button
                key={cell.key}
                onClick={() => items.length && setOpenDay(cell.key)}
                disabled={items.length === 0}
                className={cn(
                  "flex min-h-[68px] flex-col gap-0.5 rounded-lg p-1 text-left transition sm:min-h-[92px] sm:p-1.5",
                  cell.inMonth ? "bg-[var(--surface-sunken)]" : "opacity-40",
                  items.length > 0 && "hover:ring-2 hover:ring-pink-300",
                  cell.isToday && "ring-2 ring-pink-500"
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 text-[11px] font-semibold leading-none",
                    cell.isToday ? "text-pink-500" : "text-[var(--text-muted)]"
                  )}
                >
                  {cell.date.getDate()}
                </span>

                {/* Compact on phones: dots only. Titles from `sm` up. */}
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {shown.map((entry, i) => (
                    <span
                      key={`${entry.kind}-${entry.id}-${i}`}
                      className={cn("size-1.5 rounded-full", styleFor(entry.kind).dot)}
                    />
                  ))}
                </span>

                <span className="hidden flex-col gap-0.5 sm:flex">
                  {shown.map((entry, i) => (
                    <span
                      key={`${entry.kind}-${entry.id}-${i}`}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                        styleFor(entry.kind).chip
                      )}
                    >
                      {entry.title}
                    </span>
                  ))}
                </span>

                {items.length > shown.length && (
                  <span className="muted text-[10px] leading-none">
                    +{items.length - shown.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(KIND_STYLE) as (keyof typeof KIND_STYLE)[]).map((kind) => {
          const count = visible.filter((e) => e.kind === kind).length;
          return (
            <span key={kind} className="muted inline-flex items-center gap-1.5 text-xs">
              <span className={cn("size-2 rounded-full", KIND_STYLE[kind].dot)} />
              {KIND_STYLE[kind].label}
              {count > 0 && ` (${count})`}
            </span>
          );
        })}
      </div>

      {/* Day detail */}
      <Sheet
        open={openDay !== null}
        onClose={() => {
          setOpenDay(null);
          router.replace(`/calendar?month=${month}&show=${show}${onlyMine ? "&mine=1" : ""}`, {
            scroll: false,
          });
        }}
        title={openDay ? formatDate(new Date(`${openDay}T12:00:00`)) : undefined}
        description={
          dayEntries.length === 1 ? "1 item" : `${dayEntries.length} items`
        }
      >
        <ul className="space-y-2">
          {dayEntries.map((entry, i) => {
            const style = styleFor(entry.kind);
            const Icon = style.icon;
            return (
              <li key={`${entry.kind}-${entry.id}-${i}`}>
                <Link
                  href={entry.href}
                  className="surface flex items-start gap-3 rounded-xl p-3 transition hover:border-pink-300"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      style.chip
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{entry.title}</span>
                    {entry.meta && (
                      <span className="muted block truncate text-xs">{entry.meta}</span>
                    )}
                    {entry.kind === "task" && entry.mine && (
                      <span className="mt-1 inline-block rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-700 dark:bg-pink-900 dark:text-pink-100">
                        Yours
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function FilterChip({
  label,
  value,
  active,
  month,
  mine,
}: {
  label: string;
  value: string;
  active: string;
  month: string;
  mine: boolean;
}) {
  const isActive = active === value;
  return (
    <Link
      href={`/calendar?month=${month}&show=${value}${mine ? "&mine=1" : ""}`}
      scroll={false}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-xs font-medium transition",
        isActive
          ? "bg-ink-800 text-white dark:bg-white dark:text-ink-800"
          : "surface hover:border-pink-300"
      )}
    >
      {label}
    </Link>
  );
}
