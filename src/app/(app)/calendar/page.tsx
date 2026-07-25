import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Event, MarketingCampaign, Task } from "@/lib/types";
import { MonthCalendar, type CalendarEntry } from "./month-calendar";

export const metadata = { title: "Calendar" };

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; show?: string; day?: string }>;
}) {
  const { month, show = "all", day } = await searchParams;
  const active = month ?? monthKey(new Date());

  const user = await requireUser();
  const supabase = await createClient();

  const [year, m] = active.split("-").map(Number);

  // Pull a padded window so entries landing in the leading/trailing days of the
  // grid (the greyed-out neighbours) still show up.
  const from = new Date(Date.UTC(year, m - 1, 1 - 7)).toISOString();
  const to = new Date(Date.UTC(year, m, 1 + 7)).toISOString();

  const [{ data: events }, { data: tasks }, { data: campaigns }] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, slug, status, venue, starts_at")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at"),
    supabase
      .from("tasks")
      .select("*, event:events(name, slug), assignee:profiles!tasks_assignee_id_fkey(full_name)")
      .not("due_at", "is", null)
      .gte("due_at", from)
      .lt("due_at", to)
      .not("status", "in", "(cancelled)")
      .order("due_at")
      .limit(500),
    supabase
      .from("marketing_campaigns")
      .select("id, name, month, status, starts_on, ends_on, channels")
      .gte("month", `${year}-${String(m).padStart(2, "0")}-01`)
      .lte("month", `${year}-${String(m).padStart(2, "0")}-01`),
  ]);

  const eventRows = (events ?? []) as unknown as (Pick<
    Event,
    "id" | "name" | "slug" | "status" | "venue"
  > & { starts_at: string })[];

  const taskRows = (tasks ?? []) as unknown as (Task & {
    event: { name: string; slug: string } | null;
    assignee: { full_name: string } | null;
  })[];

  const campaignRows = (campaigns ?? []) as unknown as Pick<
    MarketingCampaign,
    "id" | "name" | "month" | "status" | "starts_on" | "ends_on" | "channels"
  >[];

  const entries: CalendarEntry[] = [];

  for (const event of eventRows) {
    entries.push({
      kind: "event",
      id: event.id,
      date: event.starts_at,
      title: event.name,
      href: `/events/${event.slug}`,
      meta: event.venue ?? undefined,
      status: event.status,
    });
  }

  for (const task of taskRows) {
    entries.push({
      kind: "task",
      id: task.id,
      date: task.due_at!,
      title: task.title,
      href: task.event ? `/events/${task.event.slug}` : "/my-work",
      meta: task.event?.name ?? task.assignee?.full_name ?? undefined,
      status: task.status,
      priority: task.priority,
      mine: task.assignee_id === user.id,
    });
  }

  // A campaign without explicit dates still belongs to its month — pin it to
  // the first, so the marketing plan is visible on the grid either way.
  for (const campaign of campaignRows) {
    entries.push({
      kind: "campaign",
      id: campaign.id,
      date: campaign.starts_on ?? campaign.month,
      endDate: campaign.ends_on ?? undefined,
      title: campaign.name,
      href: `/marketing?month=${active}`,
      meta: campaign.channels.slice(0, 2).join(", ") || undefined,
      status: campaign.status,
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      <MonthCalendar month={active} entries={entries} show={show} selectedDay={day} />
    </div>
  );
}
