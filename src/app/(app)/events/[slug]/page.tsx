import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, canApprove } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EVENT_STATUS } from "@/lib/constants";
import { progressMessage } from "@/lib/encouragement";
import { formatDateTime, formatMoney, daysUntil } from "@/lib/utils";
import type { Event, Profile, Task } from "@/lib/types";
import { EventChecklist } from "./checklist";
import { EventStatusControl } from "./status-control";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("name").eq("slug", slug).single();
  return { title: data?.name ?? "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, department:departments(id, name, color), owner:profiles!events_owner_id_fkey(id, full_name, avatar_url, email)")
    .eq("slug", slug)
    .single();

  if (!event) notFound();

  const typed = event as unknown as Event & {
    department: { id: string; name: string; color: string } | null;
    owner: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
  };

  const [{ data: tasks }, { data: team }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, email)")
      .eq("event_id", typed.id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("sort_order"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const allTasks = (tasks ?? []) as unknown as (Task & {
    assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
  })[];

  // One query for every comment count on the page, so each checklist row can
  // show its badge without a per-row request.
  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", allTasks.map((t) => t.id));

  const commentCounts: Record<string, number> = {};
  for (const row of commentRows ?? []) {
    commentCounts[row.task_id] = (commentCounts[row.task_id] ?? 0) + 1;
  }

  const active = allTasks.filter((t) => t.status !== "cancelled");
  const done = active.filter((t) => t.status === "done").length;
  const pct = active.length ? (done / active.length) * 100 : 0;

  const meta = EVENT_STATUS[typed.status];
  const days = daysUntil(typed.starts_at);
  const canManage = canApprove(user, typed.department?.id ?? null) || typed.owner_id === user.id;

  return (
    <div className="space-y-5">
      <Link
        href="/events"
        className="muted inline-flex items-center gap-1.5 text-sm hover:text-[var(--text-strong)]"
      >
        <ArrowLeft className="size-4" />
        Events
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge className={meta.className} dot={meta.dot}>
            {meta.label}
          </Badge>
          {typed.department && (
            <Badge
              className="text-white"
              style={{ backgroundColor: typed.department.color }}
            >
              {typed.department.name}
            </Badge>
          )}
          {days >= 0 && typed.status !== "completed" && (
            <span className="text-xs font-semibold text-pink-500">
              {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{typed.name}</h1>
        {typed.description && <p className="muted mt-2 text-sm">{typed.description}</p>}
      </div>

      <Card className="divide-y">
        <Detail icon={<CalendarDays className="size-4" />} label="When">
          {formatDateTime(typed.starts_at)}
          {typed.ends_at && ` → ${formatDateTime(typed.ends_at)}`}
        </Detail>
        {typed.venue && (
          <Detail icon={<MapPin className="size-4" />} label="Venue">
            {typed.venue}
          </Detail>
        )}
        {typed.expected_attendees !== null && (
          <Detail icon={<Users className="size-4" />} label="Expected">
            {typed.expected_attendees} attendees
          </Detail>
        )}
        {typed.budget_amount !== null && (
          <Detail icon={<Wallet className="size-4" />} label="Budget">
            {formatMoney(typed.budget_amount)}
          </Detail>
        )}
      </Card>

      {canManage && (
        <EventStatusControl eventId={typed.id} current={typed.status} />
      )}

      {active.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">Checklist progress</p>
            <p className="text-sm">
              <span className="font-semibold">{done}</span>
              <span className="muted">/{active.length}</span>
            </p>
          </div>
          <Progress value={pct} />
          <p className="muted mt-2 text-xs">{progressMessage(done, active.length)}</p>
        </Card>
      )}

      <EventChecklist
        eventId={typed.id}
        tasks={allTasks}
        team={(team ?? []) as unknown as Pick<Profile, "id" | "full_name" | "avatar_url" | "email">[]}
        canManage={canManage}
        departmentId={typed.department?.id ?? null}
        currentUserId={user.id}
        commentCounts={commentCounts}
      />
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="muted w-20 shrink-0 text-xs uppercase tracking-wide">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{children}</span>
    </div>
  );
}
