"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notifyNow, TEMPLATES } from "@/lib/messaging/reminders";
import { formatDateTime } from "@/lib/utils";
import type { AttendeeStatus, MeetingStatus, TaskPriority } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Log a meeting and invite people to it.
 *
 * Invitations go out on WhatsApp immediately — the whole reason meetings get
 * missed today is that the invite lived in someone's head.
 */
export async function createMeeting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "");
  if (!title) return { error: "Give the meeting a title." };
  if (!startsAt) return { error: "Pick a date and time." };

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return { error: "That date doesn't look right." };

  const endsRaw = String(formData.get("ends_at") ?? "");
  const departmentId = String(formData.get("department_id") ?? "") || null;

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      title,
      agenda: String(formData.get("agenda") ?? "").trim() || null,
      starts_at: start.toISOString(),
      ends_at: endsRaw ? new Date(endsRaw).toISOString() : null,
      location: String(formData.get("location") ?? "").trim() || null,
      meeting_link: String(formData.get("meeting_link") ?? "").trim() || null,
      department_id: departmentId,
      event_id: String(formData.get("event_id") ?? "") || null,
      organiser_id: user.id,
      created_by: user.id,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error || !meeting) return { error: error?.message ?? "Could not create the meeting." };

  // The organiser is always an attendee, and is auto-accepted — they called it.
  const invitedIds = new Set(formData.getAll("attendees").map(String).filter(Boolean));
  invitedIds.delete(user.id);

  const rows = [
    {
      meeting_id: meeting.id,
      user_id: user.id,
      status: "accepted" as AttendeeStatus,
      is_organiser: true,
    },
    ...[...invitedIds].map((id) => ({
      meeting_id: meeting.id,
      user_id: id,
      status: "invited" as AttendeeStatus,
      is_organiser: false,
    })),
  ];

  const { error: attendeeError } = await supabase.from("meeting_attendees").insert(rows);
  if (attendeeError) {
    return { error: `Meeting created, but invitations failed: ${attendeeError.message}` };
  }

  await inviteAttendees(meeting.id, [...invitedIds], {
    title,
    when: formatDateTime(start),
    where: String(formData.get("location") ?? "").trim() || "Online",
    organiser: user.full_name || user.email,
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  revalidatePath("/");
  redirect(`/meetings/${meeting.id}`);
}

/** In-app notification plus a WhatsApp nudge for each invitee. */
async function inviteAttendees(
  meetingId: string,
  userIds: string[],
  details: { title: string; when: string; where: string; organiser: string }
) {
  if (!userIds.length) return;
  const supabase = await createClient();

  await supabase.from("notifications").insert(
    userIds.map((id) => ({
      user_id: id,
      title: "Meeting invitation",
      body: `${details.title} — ${details.when}`,
      url: `/meetings/${meetingId}`,
      entity_type: "meeting",
      entity_id: meetingId,
    }))
  );

  for (const id of userIds) {
    await notifyNow({
      userId: id,
      template: TEMPLATES.meetingInvite,
      variables: [details.title, details.when, details.where, details.organiser],
      body: `You're invited: ${details.title} on ${details.when} at ${details.where}.`,
      entityType: "meeting",
      entityId: meetingId,
    });
  }
}

/** Add people to a meeting that already exists. */
export async function addAttendees(meetingId: string, userIds: string[]): Promise<ActionState> {
  const user = await requireUser();
  if (!userIds.length) return { ok: true };

  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("title, starts_at, location")
    .eq("id", meetingId)
    .single();

  if (!meeting) return { error: "That meeting no longer exists." };

  const { error } = await supabase.from("meeting_attendees").upsert(
    userIds.map((id) => ({
      meeting_id: meetingId,
      user_id: id,
      status: "invited" as AttendeeStatus,
    })),
    { onConflict: "meeting_id,user_id", ignoreDuplicates: true }
  );

  if (error) return { error: "You don't have permission to invite people to this meeting." };

  await inviteAttendees(meetingId, userIds, {
    title: meeting.title,
    when: formatDateTime(meeting.starts_at),
    where: meeting.location || "Online",
    organiser: user.full_name || user.email,
  });

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

export async function removeAttendee(meetingId: string, userId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("meeting_attendees")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("user_id", userId);

  if (error) return { error: "You don't have permission to change this guest list." };

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

/** RSVP. RLS confines this to the caller's own attendee row. */
export async function respondToMeeting(
  meetingId: string,
  status: AttendeeStatus
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("meeting_attendees")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("meeting_id", meetingId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Tell the organiser, so they can chase a decline or rebook.
  const { data: meeting } = await supabase
    .from("meetings")
    .select("title, organiser_id")
    .eq("id", meetingId)
    .single();

  if (meeting?.organiser_id && meeting.organiser_id !== user.id && status !== "invited") {
    await supabase.from("notifications").insert({
      user_id: meeting.organiser_id,
      title: `${user.full_name || user.email} ${status}`,
      body: meeting.title,
      url: `/meetings/${meetingId}`,
      entity_type: "meeting",
      entity_id: meetingId,
    });
  }

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  return { ok: true };
}

export async function updateMeetingStatus(
  meetingId: string,
  status: MeetingStatus
): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("meetings").update({ status }).eq("id", meetingId);
  if (error) return { error: error.message };

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  return { ok: true };
}

/** Write up what happened and what was decided. */
export async function saveMinutes(
  meetingId: string,
  minutes: string,
  decisions: string
): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("meetings")
    .update({
      minutes: minutes.trim() || null,
      decisions: decisions.trim() || null,
      // Writing minutes means it happened.
      status: "completed",
    })
    .eq("id", meetingId);

  if (error) return { error: "You don't have permission to write up this meeting." };

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true };
}

/**
 * An action item is a normal task, so it shows up in the assignee's "My work"
 * and picks up reminders like everything else.
 */
export async function addActionItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!title) return { error: "What needs doing?" };
  if (!meetingId) return { error: "Missing meeting." };

  const dueRaw = String(formData.get("due_at") ?? "");
  const assigneeId = String(formData.get("assignee_id") ?? "") || null;

  const { error } = await supabase.from("tasks").insert({
    title,
    meeting_id: meetingId,
    assignee_id: assigneeId,
    department_id: String(formData.get("department_id") ?? "") || null,
    priority: (String(formData.get("priority") ?? "normal") || "normal") as TaskPriority,
    due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
    created_by: user.id,
    category: "documentation",
  });

  if (error) return { error: error.message };

  if (assigneeId && assigneeId !== user.id) {
    await supabase.from("notifications").insert({
      user_id: assigneeId,
      title: "New action item",
      body: title,
      url: `/meetings/${meetingId}`,
      entity_type: "task",
      entity_id: meetingId,
    });
  }

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/my-work");
  return { ok: true };
}

export async function deleteMeeting(meetingId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) return { error: "Only the organiser can delete this meeting." };

  revalidatePath("/meetings");
  redirect("/meetings");
}
