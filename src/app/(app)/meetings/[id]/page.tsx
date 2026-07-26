import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getTeam } from "@/lib/reference-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MEETING_STATUS } from "@/lib/constants";
import { formatDateTime, relativeDay } from "@/lib/utils";
import type { Meeting, Profile, Task } from "@/lib/types";
import { MeetingDetail } from "./meeting-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("title").eq("id", id).single();
  return { title: data?.title ?? "Meeting" };
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "*, organiser:profiles!meetings_organiser_id_fkey(id, full_name, email, avatar_url), " +
        "department:departments(id, name, color), event:events(id, name, slug)"
    )
    .eq("id", id)
    .single();

  if (!meeting) notFound();

  const typed = meeting as unknown as Meeting & {
    organiser: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    department: { id: string; name: string; color: string } | null;
    event: { id: string; name: string; slug: string } | null;
  };

  const [{ data: attendees }, { data: actionItems }, team] = await Promise.all([
    supabase
      .from("meeting_attendees")
      .select("*, profile:profiles(id, full_name, email, avatar_url, job_title)")
      .eq("meeting_id", id),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)")
      .eq("meeting_id", id)
      .order("created_at"),
    getTeam(),
  ]);

  type AttendeeRow = {
    user_id: string;
    status: string;
    is_organiser: boolean;
    profile: (Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> & {
      job_title: string | null;
    }) | null;
  };

  const guests = (attendees ?? []) as unknown as AttendeeRow[];
  const tasks = (actionItems ?? []) as unknown as (Task & {
    assignee: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
  })[];

  const myRsvp = guests.find((g) => g.user_id === user.id);
  const canManage = typed.organiser_id === user.id || typed.created_by === user.id;
  const meta = MEETING_STATUS[typed.status];

  return (
    <div className="space-y-5">
      <Link
        href="/meetings"
        className="muted inline-flex items-center gap-1.5 text-sm hover:text-[var(--text-strong)]"
      >
        <ArrowLeft className="size-4" />
        Meetings
      </Link>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge className={meta.className} dot={meta.dot}>
            {meta.label}
          </Badge>
          {typed.department && (
            <Badge className="text-white" style={{ backgroundColor: typed.department.color }}>
              {typed.department.name}
            </Badge>
          )}
          <span className="muted text-xs">{relativeDay(typed.starts_at)}</span>
        </div>

        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{typed.title}</h1>
      </div>

      <Card className="divide-y">
        <Row icon={<CalendarDays className="size-4" />} label="When">
          {formatDateTime(typed.starts_at)}
          {typed.ends_at && ` → ${formatDateTime(typed.ends_at)}`}
        </Row>
        {typed.location && (
          <Row icon={<MapPin className="size-4" />} label="Where">
            {typed.location}
          </Row>
        )}
        {typed.meeting_link && (
          <Row icon={<Video className="size-4" />} label="Link">
            <a
              href={typed.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-pink-500 hover:underline"
            >
              Join the call
            </a>
          </Row>
        )}
        <Row icon={<Users className="size-4" />} label="Called by">
          {typed.organiser?.full_name || typed.organiser?.email || "—"}
        </Row>
        {typed.event && (
          <Row icon={<CalendarDays className="size-4" />} label="Event">
            <Link href={`/events/${typed.event.slug}`} className="text-pink-500 hover:underline">
              {typed.event.name}
            </Link>
          </Row>
        )}
      </Card>

      <MeetingDetail
        meeting={typed}
        attendees={guests}
        actionItems={tasks}
        team={team}
        myStatus={myRsvp?.status ?? null}
        isInvited={Boolean(myRsvp)}
        canManage={canManage}
        currentUserId={user.id}
      />
    </div>
  );
}

function Row({
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
