import Link from "next/link";
import { CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/misc";
import { EVENT_STATUS } from "@/lib/constants";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import type { Event } from "@/lib/types";

export const metadata = { title: "Events" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showPast = view === "past";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Link href="/events/new">
          <Button size="sm">
            <Plus className="size-4" />
            New
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Link href="/events">
          <Button variant={showPast ? "outline" : "secondary"} size="sm">
            Upcoming
          </Button>
        </Link>
        <Link href="/events?view=past">
          <Button variant={showPast ? "secondary" : "outline"} size="sm">
            Past
          </Button>
        </Link>
      </div>

      <EventList showPast={showPast} />
    </div>
  );
}

type EventRow = Pick<
  Event,
  "id" | "name" | "slug" | "starts_at" | "venue" | "status" | "expected_attendees"
> & {
  department: { name: string; color: string } | null;
};

async function EventList({ showPast }: { showPast: boolean }) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const query = supabase
    .from("events")
    .select(
      "id, name, slug, starts_at, venue, status, expected_attendees, department:departments(name, color)"
    );

  const { data } = showPast
    ? await query.lt("starts_at", now).order("starts_at", { ascending: false }).limit(50)
    : await query.gte("starts_at", now).order("starts_at", { ascending: true }).limit(50);

  const events = (data ?? []) as unknown as EventRow[];

  if (events.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title={showPast ? "No past events" : "No upcoming events"}
          description={
            showPast
              ? "Events move here automatically once their date passes."
              : "Create an event and Nexis OS builds the full 38-step checklist for you."
          }
          action={
            !showPast && (
              <Link href="/events/new">
                <Button>
                  <Plus className="size-4" />
                  New event
                </Button>
              </Link>
            )
          }
        />
      </Card>
    );
  }

  // One aggregate query for checklist progress across every event on screen,
  // instead of a per-card round trip.
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("event_id, status")
    .in("event_id", events.map((e) => e.id));

  const progress = new Map<string, { done: number; total: number }>();
  for (const row of taskRows ?? []) {
    if (!row.event_id) continue;
    const entry = progress.get(row.event_id) ?? { done: 0, total: 0 };
    if (row.status !== "cancelled") {
      entry.total += 1;
      if (row.status === "done") entry.done += 1;
    }
    progress.set(row.event_id, entry);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((event) => {
        const meta = EVENT_STATUS[event.status];
        const days = daysUntil(event.starts_at);
        const p = progress.get(event.id) ?? { done: 0, total: 0 };
        const pct = p.total ? (p.done / p.total) * 100 : 0;

        return (
          <Link key={event.id} href={`/events/${event.slug}`}>
            <Card className="h-full p-4 transition hover:border-pink-300">
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <Badge className={meta.className} dot={meta.dot}>
                  {meta.label}
                </Badge>
                {!showPast && (
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold",
                      days <= 3 ? "text-pink-500" : "muted"
                    )}
                  >
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                  </span>
                )}
              </div>

              <p className="font-semibold leading-tight">{event.name}</p>

              <div className="muted mt-2 space-y-1 text-xs">
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" />
                  {formatDate(event.starts_at)}
                </p>
                {event.venue && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{event.venue}</span>
                  </p>
                )}
                {event.expected_attendees && (
                  <p className="flex items-center gap-1.5">
                    <Users className="size-3.5 shrink-0" />
                    {event.expected_attendees} expected
                  </p>
                )}
              </div>

              {p.total > 0 && (
                <div className="mt-3.5">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="muted">Checklist</span>
                    <span className="font-medium">
                      {p.done}/{p.total}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

