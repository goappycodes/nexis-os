import { createClient } from "@/lib/supabase/server";
import type {
  ApprovalRequest,
  Event,
  MarketingCampaign,
  Meeting,
  Reminder,
  Task,
} from "@/lib/types";

/**
 * Everything on the calendar, from one place.
 *
 * Six different things land on a Nexis calendar — events, meetings, task
 * deadlines, marketing campaigns, approval deadlines and scheduled reminders.
 * Gathering them in one function means the month grid and the dashboard can
 * never drift out of sync about what "this week" contains.
 *
 * RLS does the access filtering, so this returns exactly what the caller is
 * allowed to see without any extra checks here.
 */

export type AgendaKind =
  | "event"
  | "meeting"
  | "task"
  | "campaign"
  | "approval"
  | "reminder";

export type AgendaEntry = {
  kind: AgendaKind;
  id: string;
  /** ISO timestamp the entry sits on. */
  date: string;
  /** Set only for things that span days, like a campaign. */
  endDate?: string;
  title: string;
  href: string;
  meta?: string;
  status?: string;
  priority?: string;
  /** Directly involves the current user — theirs to do, attend or decide. */
  mine?: boolean;
  /** True for entries with a real clock time rather than just a date. */
  timed?: boolean;
};

export type AgendaOptions = {
  from: Date;
  to: Date;
  userId: string;
  /** Limit to entries involving this user. Used by the dashboard. */
  onlyMine?: boolean;
  kinds?: AgendaKind[];
};

export async function getAgenda({
  from,
  to,
  userId,
  onlyMine = false,
  kinds,
}: AgendaOptions): Promise<AgendaEntry[]> {
  const supabase = await createClient();
  const wants = (kind: AgendaKind) => !kinds || kinds.includes(kind);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  // Campaigns are filtered by month rather than timestamp, so they need their
  // own bounds.
  const monthFrom = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`;
  const monthTo = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-01`;

  const [events, meetings, tasks, campaigns, approvals, reminders] = await Promise.all([
    wants("event")
      ? supabase
          .from("events")
          .select("id, name, slug, status, venue, starts_at")
          .gte("starts_at", fromIso)
          .lt("starts_at", toIso)
          .not("status", "eq", "cancelled")
          .order("starts_at")
      : null,

    wants("meeting")
      ? supabase
          .from("meetings")
          .select(
            "id, title, starts_at, ends_at, location, meeting_link, status, organiser_id, " +
              "attendees:meeting_attendees(user_id, status)"
          )
          .gte("starts_at", fromIso)
          .lt("starts_at", toIso)
          .not("status", "eq", "cancelled")
          .order("starts_at")
      : null,

    wants("task")
      ? supabase
          .from("tasks")
          .select(
            "*, event:events(name, slug), meeting:meetings(title), " +
              "assignee:profiles!tasks_assignee_id_fkey(full_name)"
          )
          .not("due_at", "is", null)
          .gte("due_at", fromIso)
          .lt("due_at", toIso)
          .not("status", "in", "(cancelled)")
          .order("due_at")
          .limit(500)
      : null,

    wants("campaign")
      ? supabase
          .from("marketing_campaigns")
          .select("id, name, month, status, starts_on, ends_on, channels, owner_id")
          .gte("month", monthFrom)
          .lte("month", monthTo)
          .not("status", "eq", "cancelled")
      : null,

    wants("approval")
      ? supabase
          .from("approval_requests")
          .select("id, title, entity_type, status, due_at, assigned_to, requested_by")
          .eq("status", "pending")
          .not("due_at", "is", null)
          .gte("due_at", fromIso)
          .lt("due_at", toIso)
      : null,

    wants("reminder")
      ? supabase
          .from("reminders")
          .select("id, body, template, send_at, status, user_id, entity_type, entity_id")
          .eq("status", "pending")
          .gte("send_at", fromIso)
          .lt("send_at", toIso)
          .order("send_at")
          .limit(200)
      : null,
  ]);

  const entries: AgendaEntry[] = [];

  for (const row of (events?.data ?? []) as unknown as (Pick<
    Event,
    "id" | "name" | "slug" | "status" | "venue"
  > & { starts_at: string })[]) {
    entries.push({
      kind: "event",
      id: row.id,
      date: row.starts_at,
      title: row.name,
      href: `/events/${row.slug}`,
      meta: row.venue ?? undefined,
      status: row.status,
      timed: true,
    });
  }

  for (const row of (meetings?.data ?? []) as unknown as (Pick<
    Meeting,
    "id" | "title" | "starts_at" | "ends_at" | "location" | "meeting_link" | "status" | "organiser_id"
  > & { attendees: { user_id: string; status: string }[] })[]) {
    const attending = row.attendees?.some((a) => a.user_id === userId);
    entries.push({
      kind: "meeting",
      id: row.id,
      date: row.starts_at,
      endDate: row.ends_at ?? undefined,
      title: row.title,
      href: `/meetings/${row.id}`,
      meta:
        row.location ??
        (row.meeting_link ? "Online" : undefined) ??
        `${row.attendees?.length ?? 0} invited`,
      status: row.status,
      mine: attending || row.organiser_id === userId,
      timed: true,
    });
  }

  for (const row of (tasks?.data ?? []) as unknown as (Task & {
    event: { name: string; slug: string } | null;
    meeting: { title: string } | null;
    assignee: { full_name: string } | null;
  })[]) {
    entries.push({
      kind: "task",
      id: row.id,
      date: row.due_at!,
      title: row.title,
      href: row.event
        ? `/events/${row.event.slug}`
        : row.meeting_id
          ? `/meetings/${row.meeting_id}`
          : "/my-work",
      meta: row.event?.name ?? row.meeting?.title ?? row.assignee?.full_name ?? undefined,
      status: row.status,
      priority: row.priority,
      mine: row.assignee_id === userId,
    });
  }

  for (const row of (campaigns?.data ?? []) as unknown as (Pick<
    MarketingCampaign,
    "id" | "name" | "month" | "status" | "starts_on" | "ends_on" | "channels" | "owner_id"
  >)[]) {
    entries.push({
      kind: "campaign",
      id: row.id,
      // A campaign with no explicit dates still belongs to its month.
      date: row.starts_on ?? row.month,
      endDate: row.ends_on ?? undefined,
      title: row.name,
      href: `/marketing?month=${row.month.slice(0, 7)}`,
      meta: row.channels?.slice(0, 2).join(", ") || undefined,
      status: row.status,
      mine: row.owner_id === userId,
    });
  }

  for (const row of (approvals?.data ?? []) as unknown as Pick<
    ApprovalRequest,
    "id" | "title" | "entity_type" | "status" | "due_at" | "assigned_to" | "requested_by"
  >[]) {
    entries.push({
      kind: "approval",
      id: row.id,
      date: row.due_at!,
      title: row.title || "Approval",
      href: "/approvals",
      meta: `${row.entity_type} awaiting decision`,
      status: row.status,
      mine: row.assigned_to === userId || row.requested_by === userId,
    });
  }

  for (const row of (reminders?.data ?? []) as unknown as Pick<
    Reminder,
    "id" | "body" | "template" | "send_at" | "status" | "user_id" | "entity_type" | "entity_id"
  >[]) {
    entries.push({
      kind: "reminder",
      id: row.id,
      date: row.send_at,
      title: row.body ?? row.template ?? "Reminder",
      href: "/my-work",
      meta: "WhatsApp reminder",
      status: row.status,
      mine: row.user_id === userId,
      timed: true,
    });
  }

  const filtered = onlyMine ? entries.filter((e) => e.mine) : entries;
  return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
