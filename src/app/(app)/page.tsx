import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, ListChecks, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle, Skeleton } from "@/components/ui/misc";
import { EVENT_STATUS, TASK_PRIORITY } from "@/lib/constants";
import { cn, daysUntil, formatDate, relativeDay } from "@/lib/utils";
import type { Task, Event, ApprovalRequest } from "@/lib/types";

export const metadata = { title: "Home" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = (user.full_name || user.email).split(" ")[0].split("@")[0];

  return (
    <div className="space-y-7">
      <div>
        <p className="muted text-sm">{greeting()},</p>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsRow userId={user.id} />
      </Suspense>

      <Suspense fallback={<ListSkeleton title="My open work" />}>
        <MyWork userId={user.id} />
      </Suspense>

      <Suspense fallback={<ListSkeleton title="Waiting on me" />}>
        <WaitingOnMe userId={user.id} />
      </Suspense>

      <Suspense fallback={<ListSkeleton title="Upcoming events" />}>
        <UpcomingEvents />
      </Suspense>
    </div>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────────── */

async function StatsRow({ userId }: { userId: string }) {
  const supabase = await createClient();
  const today = new Date();
  const endOfWeek = new Date(today.getTime() + 7 * 86_400_000).toISOString();

  const [openTasks, overdue, dueThisWeek, approvals] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .not("status", "in", "(done,cancelled)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .not("status", "in", "(done,cancelled)")
      .lt("due_at", today.toISOString()),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .not("status", "in", "(done,cancelled)")
      .gte("due_at", today.toISOString())
      .lte("due_at", endOfWeek),
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "pending"),
  ]);

  const stats = [
    { label: "Open tasks", value: openTasks.count ?? 0, href: "/my-work", icon: ListChecks, tone: "" },
    { label: "Overdue", value: overdue.count ?? 0, href: "/my-work?filter=overdue", icon: Clock, tone: "text-red-600" },
    { label: "Due this week", value: dueThisWeek.count ?? 0, href: "/my-work?filter=week", icon: CalendarDays, tone: "" },
    { label: "To approve", value: approvals.count ?? 0, href: "/approvals", icon: CheckCircle2, tone: "text-pink-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Link key={s.label} href={s.href}>
          <Card className="p-4 transition hover:border-pink-300">
            <s.icon className={cn("mb-2 size-4 text-[var(--text-muted)]", s.tone)} />
            <p className={cn("text-2xl font-semibold leading-none", s.value > 0 && s.tone)}>
              {s.value}
            </p>
            <p className="muted mt-1 text-xs">{s.label}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/* ── My work ──────────────────────────────────────────────────────────────── */

type TaskRow = Pick<Task, "id" | "title" | "due_at" | "priority" | "status" | "event_id"> & {
  event: { name: string; slug: string } | null;
};

async function MyWork({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, priority, status, event_id, event:events(name, slug)")
    .eq("assignee_id", userId)
    .not("status", "in", "(done,cancelled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(6);

  const tasks = (data ?? []) as unknown as TaskRow[];

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/my-work" className="text-xs font-medium text-pink-500 hover:underline">
            View all
          </Link>
        }
      >
        My open work
      </SectionTitle>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="size-6" />}
            title="Nothing on your plate"
            description="No open tasks assigned to you. Enjoy it while it lasts."
          />
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {tasks.map((task) => {
            const overdue = task.due_at && daysUntil(task.due_at) < 0;
            return (
              <Link
                key={task.id}
                href={`/my-work?task=${task.id}`}
                className="flex items-start gap-3 p-4 transition hover:bg-[var(--surface-sunken)]"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    TASK_PRIORITY[task.priority].dot
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <div className="muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {task.event && <span className="truncate">{task.event.name}</span>}
                    {task.due_at && (
                      <>
                        {task.event && <span aria-hidden>·</span>}
                        <span className={cn(overdue && "font-medium text-red-600")}>
                          {overdue ? "Overdue " : "Due "}
                          {relativeDay(task.due_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--text-muted)]" />
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}

/* ── Waiting on me ────────────────────────────────────────────────────────── */

async function WaitingOnMe({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("id, title, entity_type, created_at, due_at")
    .eq("assigned_to", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  const requests = (data ?? []) as unknown as Pick<
    ApprovalRequest,
    "id" | "title" | "entity_type" | "created_at" | "due_at"
  >[];

  if (requests.length === 0) return null;

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/approvals" className="text-xs font-medium text-pink-500 hover:underline">
            View all
          </Link>
        }
      >
        Waiting on your approval
      </SectionTitle>

      <Card className="divide-y overflow-hidden">
        {requests.map((req) => (
          <Link
            key={req.id}
            href={`/approvals/${req.id}`}
            className="flex items-center gap-3 p-4 transition hover:bg-[var(--surface-sunken)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{req.title || "Untitled"}</p>
              <p className="muted mt-0.5 text-xs capitalize">
                {req.entity_type} · raised {relativeDay(req.created_at)}
              </p>
            </div>
            <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Pending
            </Badge>
          </Link>
        ))}
      </Card>
    </section>
  );
}

/* ── Upcoming events ──────────────────────────────────────────────────────── */

async function UpcomingEvents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, slug, starts_at, venue, status")
    .gte("starts_at", new Date().toISOString())
    .not("status", "in", "(cancelled,completed)")
    .order("starts_at", { ascending: true })
    .limit(4);

  const events = (data ?? []) as unknown as Pick<
    Event,
    "id" | "name" | "slug" | "starts_at" | "venue" | "status"
  >[];

  return (
    <section>
      <SectionTitle
        action={
          <Link href="/events" className="text-xs font-medium text-pink-500 hover:underline">
            View all
          </Link>
        }
      >
        Upcoming events
      </SectionTitle>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="No events scheduled"
            description="Create an event and Nexis OS will build the full checklist for you."
            action={
              <Link href="/events/new">
                <Button>
                  <Plus className="size-4" />
                  New event
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => {
            const days = daysUntil(event.starts_at);
            const meta = EVENT_STATUS[event.status];
            return (
              <Link key={event.id} href={`/events/${event.slug}`}>
                <Card className="h-full p-4 transition hover:border-pink-300">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Badge className={meta.className} dot={meta.dot}>
                      {meta.label}
                    </Badge>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold",
                        days <= 3 ? "text-pink-500" : "muted"
                      )}
                    >
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                    </span>
                  </div>
                  <p className="font-medium leading-tight">{event.name}</p>
                  <p className="muted mt-1.5 text-xs">
                    {formatDate(event.starts_at)}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Skeletons ────────────────────────────────────────────────────────────── */

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[92px] rounded-2xl" />
      ))}
    </div>
  );
}

function ListSkeleton({ title }: { title: string }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Skeleton className="h-40 rounded-2xl" />
    </section>
  );
}
