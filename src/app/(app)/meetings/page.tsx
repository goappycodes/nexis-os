import Link from "next/link";
import { Clock, MapPin, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getDepartments, getTeam } from "@/lib/reference-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { NoEventsIllustration } from "@/components/ui/illustrations";
import { ATTENDEE_STATUS, MEETING_STATUS } from "@/lib/constants";
import { cn, formatDateTime, relativeDay } from "@/lib/utils";
import type { Meeting, Profile } from "@/lib/types";
import { NewMeeting } from "./new-meeting";

export const metadata = { title: "Meetings" };

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "upcoming" } = await searchParams;
  const showPast = view === "past";
  const mineOnly = view === "mine";

  const user = await requireUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [departments, team, { data: events }] = await Promise.all([
    getDepartments(),
    getTeam(),
    supabase.from("events").select("id, name").order("starts_at", { ascending: false }).limit(40),
  ]);

  let query = supabase
    .from("meetings")
    .select(
      "*, organiser:profiles!meetings_organiser_id_fkey(id, full_name, email, avatar_url), " +
        "department:departments(name, color), " +
        "attendees:meeting_attendees(user_id, status, profile:profiles(id, full_name, email, avatar_url))"
    );

  if (showPast) {
    query = query.lt("starts_at", now).order("starts_at", { ascending: false });
  } else {
    query = query.gte("starts_at", now).order("starts_at", { ascending: true });
  }

  const { data } = await query.limit(60);

  type Row = Meeting & {
    organiser: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    department: { name: string; color: string } | null;
    attendees: {
      user_id: string;
      status: string;
      profile: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    }[];
  };

  let meetings = (data ?? []) as unknown as Row[];
  if (mineOnly) {
    meetings = meetings.filter(
      (m) => m.organiser_id === user.id || m.attendees.some((a) => a.user_id === user.id)
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <NewMeeting
          departments={departments}
          team={team}
          events={(events ?? []) as { id: string; name: string }[]}
          defaultDepartmentId={user.primary_department_id}
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ViewLink label="Upcoming" value="upcoming" active={view} />
        <ViewLink label="Mine" value="mine" active={view} />
        <ViewLink label="Past" value="past" active={view} />
      </div>

      {meetings.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<NoEventsIllustration className="w-36" />}
            title={showPast ? "No past meetings" : "Nothing scheduled"}
            description={
              showPast
                ? "Once meetings happen, they collect here with their minutes and decisions."
                : "Log a meeting and everyone invited gets a WhatsApp straight away."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const meta = MEETING_STATUS[meeting.status];
            const mine = meeting.attendees.find((a) => a.user_id === user.id);
            const going = meeting.attendees.filter((a) => a.status === "accepted").length;

            return (
              <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
                <Card className="p-4 transition hover:border-pink-300">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{meeting.title}</p>
                      <p className="muted mt-1 text-xs">
                        {formatDateTime(meeting.starts_at)} · {relativeDay(meeting.starts_at)}
                      </p>
                    </div>
                    <Badge className={meta.className} dot={meta.dot}>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {meeting.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {meeting.location}
                      </span>
                    )}
                    {meeting.meeting_link && (
                      <span className="inline-flex items-center gap-1">
                        <Video className="size-3.5" />
                        Online
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {meeting.attendees.length} invited
                      {going > 0 && ` · ${going} going`}
                    </span>
                    {meeting.ends_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {Math.round(
                          (new Date(meeting.ends_at).getTime() -
                            new Date(meeting.starts_at).getTime()) /
                            60000
                        )}{" "}
                        min
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {meeting.attendees.slice(0, 5).map((a) => (
                        <Avatar
                          key={a.user_id}
                          name={a.profile?.full_name || a.profile?.email || "?"}
                          src={a.profile?.avatar_url}
                          size="xs"
                          className="ring-2 ring-[var(--surface-raised)]"
                        />
                      ))}
                      {meeting.attendees.length > 5 && (
                        <span className="muted ml-3 self-center text-xs">
                          +{meeting.attendees.length - 5}
                        </span>
                      )}
                    </div>

                    {/* Your own RSVP is the thing you actually scan for. */}
                    {mine && (
                      <Badge
                        className={cn("shrink-0", ATTENDEE_STATUS[mine.status as keyof typeof ATTENDEE_STATUS].className)}
                      >
                        {ATTENDEE_STATUS[mine.status as keyof typeof ATTENDEE_STATUS].label}
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ViewLink({ label, value, active }: { label: string; value: string; active: string }) {
  const isActive = active === value;
  return (
    <a
      href={`/meetings?view=${value}`}
      className={
        isActive
          ? "shrink-0 rounded-full bg-ink-800 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-800"
          : "surface shrink-0 rounded-full px-4 py-2 text-xs font-medium hover:border-pink-300"
      }
    >
      {label}
    </a>
  );
}
