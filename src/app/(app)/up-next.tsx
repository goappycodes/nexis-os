import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Megaphone,
  Users,
} from "lucide-react";
import { getAgenda, type AgendaKind } from "@/lib/agenda";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/misc";
import { cn, formatDate } from "@/lib/utils";

/**
 * One merged view of the next seven days.
 *
 * Events, meetings, deadlines, campaigns, approvals and reminders all land in
 * the same list, grouped by day. The point is that nobody should have to check
 * five places to know what this week actually holds.
 */

const KIND = {
  event: { icon: CalendarDays, chip: "bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-100", label: "Event" },
  meeting: { icon: Users, chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", label: "Meeting" },
  task: { icon: ListChecks, chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", label: "Due" },
  campaign: { icon: Megaphone, chip: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200", label: "Campaign" },
  approval: { icon: CheckCircle2, chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", label: "Approval" },
  reminder: { icon: Bell, chip: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200", label: "Reminder" },
} as const;

const KINDS: AgendaKind[] = ["event", "meeting", "task", "campaign", "approval", "reminder"];

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function UpNext({ userId }: { userId: string }) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 7 * 86_400_000);

  const raw = await getAgenda({ from, to, userId, kinds: KINDS });

  // A campaign pinned to the first of the month, or anything else that started
  // before today but is still running, belongs under Today — not filed under a
  // past date above it. Anything already finished drops out entirely.
  const entries = raw
    .filter((entry) => {
      const ends = new Date(entry.endDate ?? entry.date);
      return ends >= from;
    })
    .map((entry) => {
      const starts = new Date(entry.date);
      if (starts >= from) return entry;
      return { ...entry, date: from.toISOString(), ongoing: true as const };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (entries.length === 0) {
    return (
      <section>
        <SectionTitle
          action={
            <Link href="/calendar" className="text-xs font-medium text-pink-500 hover:underline">
              Open calendar
            </Link>
          }
        >
          The week ahead
        </SectionTitle>
        <Card className="p-5">
          <p className="muted text-sm">
            Nothing scheduled in the next seven days. A quiet week is a good week to get ahead.
          </p>
        </Card>
      </section>
    );
  }

  // Group by day so the list reads as an agenda rather than a flat feed.
  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = new Date(entry.date).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  const todayKey = now.toDateString();
  const tomorrowKey = new Date(now.getTime() + 86_400_000).toDateString();

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/calendar" className="text-xs font-medium text-pink-500 hover:underline">
            Open calendar
          </Link>
        }
      >
        The week ahead
      </SectionTitle>

      <div className="space-y-3">
        {[...byDay.entries()].slice(0, 7).map(([day, items]) => {
          const isToday = day === todayKey;
          const label = isToday
            ? "Today"
            : day === tomorrowKey
              ? "Tomorrow"
              : formatDate(new Date(day));

          return (
            <div key={day}>
              <p
                className={cn(
                  "mb-1.5 px-1 text-xs font-semibold",
                  isToday ? "text-pink-500" : "text-[var(--text-muted)]"
                )}
              >
                {label}
                <span className="muted ml-1.5 font-normal">
                  {items.length} {items.length === 1 ? "thing" : "things"}
                </span>
              </p>

              <Card className="divide-y overflow-hidden">
                {items.slice(0, 6).map((entry, i) => {
                  const style = KIND[entry.kind];
                  const Icon = style.icon;

                  return (
                    <Link
                      key={`${entry.kind}-${entry.id}-${i}`}
                      href={entry.href}
                      className="flex items-center gap-3 p-3 transition hover:bg-[var(--surface-sunken)]"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          style.chip
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-snug">
                          {entry.title}
                        </span>
                        <span className="muted block truncate text-xs">
                          {"ongoing" in entry && entry.ongoing
                            ? "Running now · "
                            : entry.timed
                              ? `${timeOf(entry.date)} · `
                              : ""}
                          {entry.meta ?? style.label}
                        </span>
                      </span>

                      {entry.mine && (
                        <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-700 dark:bg-pink-900 dark:text-pink-100">
                          You
                        </span>
                      )}
                    </Link>
                  );
                })}

                {items.length > 6 && (
                  <Link
                    href="/calendar"
                    className="muted block p-2.5 text-center text-xs hover:text-pink-500"
                  >
                    +{items.length - 6} more
                  </Link>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
