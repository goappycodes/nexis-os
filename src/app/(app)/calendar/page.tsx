import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { EVENT_STATUS, TASK_PRIORITY } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { Event, Task } from "@/lib/types";
import { CalendarMonthStrip } from "./month-strip";

export const metadata = { title: "Calendar" };

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Everything happening on one day, merged from events and task deadlines. */
type DayEntry =
  | { kind: "event"; at: string; event: Pick<Event, "id" | "name" | "slug" | "status" | "venue"> }
  | { kind: "task"; at: string; task: Task & { event: { name: string; slug: string } | null } };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const active = month ?? monthKey(new Date());

  await requireUser();
  const supabase = await createClient();

  const [year, m] = active.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, m, 1)).toISOString();

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, slug, status, venue, starts_at")
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
    supabase
      .from("tasks")
      .select("*, event:events(name, slug)")
      .gte("due_at", start)
      .lt("due_at", end)
      .not("status", "in", "(done,cancelled)")
      .order("due_at"),
  ]);

  // The generated row types lose their shape through the relational select,
  // so narrow once here rather than casting at every use site.
  const eventRows = (events ?? []) as unknown as (Pick<
    Event,
    "id" | "name" | "slug" | "status" | "venue"
  > & { starts_at: string })[];

  const taskRows = (tasks ?? []) as unknown as (Task & {
    event: { name: string; slug: string } | null;
  })[];

  const entries: DayEntry[] = [
    ...eventRows.map((e) => ({ kind: "event" as const, at: e.starts_at, event: e })),
    ...taskRows
      .filter((t) => t.due_at)
      .map((t) => ({ kind: "task" as const, at: t.due_at!, task: t })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // Group into days so the page reads as an agenda, not a flat list.
  const byDay = new Map<string, DayEntry[]>();
  for (const entry of entries) {
    const key = new Date(entry.at).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  const monthLabel = new Date(year, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>

      <CalendarMonthStrip active={active} />

      <p className="muted text-sm">{monthLabel}</p>

      {byDay.size === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarRange className="size-6" />}
            title="Nothing this month"
            description="Events and task deadlines appear here as they are scheduled."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, items]) => {
            const date = new Date(day);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div key={day}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isToday && "text-pink-500"
                    )}
                  >
                    {formatDate(date)}
                  </span>
                  {isToday && (
                    <span className="text-xs font-medium text-pink-500">Today</span>
                  )}
                </div>

                <Card className="divide-y overflow-hidden">
                  {items.map((item, i) =>
                    item.kind === "event" ? (
                      <Link
                        key={`e-${item.event.id}-${i}`}
                        href={`/events/${item.event.slug}`}
                        className="flex items-center gap-3 p-3.5 transition hover:bg-[var(--surface-sunken)]"
                      >
                        <span className="h-9 w-1 shrink-0 rounded-full bg-pink-500" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.event.name}
                          </span>
                          {item.event.venue && (
                            <span className="muted block truncate text-xs">
                              {item.event.venue}
                            </span>
                          )}
                        </span>
                        <Badge
                          className={EVENT_STATUS[item.event.status].className}
                          dot={EVENT_STATUS[item.event.status].dot}
                        >
                          {EVENT_STATUS[item.event.status].label}
                        </Badge>
                      </Link>
                    ) : (
                      <div key={`t-${item.task.id}-${i}`} className="flex items-center gap-3 p-3.5">
                        <span
                          className={cn(
                            "h-9 w-1 shrink-0 rounded-full",
                            TASK_PRIORITY[item.task.priority].dot
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{item.task.title}</span>
                          {item.task.event && (
                            <span className="muted block truncate text-xs">
                              {item.task.event.name}
                            </span>
                          )}
                        </span>
                        <span className="muted shrink-0 text-xs">Due</span>
                      </div>
                    )
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
