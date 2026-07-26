"use client";

import { useState, useTransition } from "react";
import { Check, ListChecks, Plus, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addActionItem,
  addAttendees,
  removeAttendee,
  respondToMeeting,
  saveMinutes,
  updateMeetingStatus,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ATTENDEE_STATUS, MEETING_STATUS, TASK_PRIORITY } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { AttendeeStatus, Meeting, MeetingStatus, Profile, Task } from "@/lib/types";

type AttendeeRow = {
  user_id: string;
  status: string;
  is_organiser: boolean;
  profile:
    | (Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> & { job_title: string | null })
    | null;
};

type ActionItem = Task & {
  assignee: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
};

type TeamMember = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

export function MeetingDetail({
  meeting,
  attendees,
  actionItems,
  team,
  myStatus,
  isInvited,
  canManage,
  currentUserId,
}: {
  meeting: Meeting;
  attendees: AttendeeRow[];
  actionItems: ActionItem[];
  team: TeamMember[];
  myStatus: string | null;
  isInvited: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState(false);

  function rsvp(status: AttendeeStatus) {
    startTransition(async () => {
      const result = await respondToMeeting(meeting.id, status);
      if (result?.error) toast.error(result.error);
      else toast.success(ATTENDEE_STATUS[status].label);
    });
  }

  function setStatus(status: MeetingStatus) {
    startTransition(async () => {
      const result = await updateMeetingStatus(meeting.id, status);
      if (result?.error) toast.error(result.error);
    });
  }

  function writeUp(formData: FormData) {
    startTransition(async () => {
      const result = await saveMinutes(
        meeting.id,
        String(formData.get("minutes") ?? ""),
        String(formData.get("decisions") ?? "")
      );
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Written up");
        setEditingMinutes(false);
      }
    });
  }

  const invitedIds = attendees.map((a) => a.user_id);
  const notInvited = team.filter((m) => !invitedIds.includes(m.id));

  return (
    <div className="space-y-5">
      {/* Your RSVP — the first thing an invitee needs to act on. */}
      {isInvited && meeting.status === "scheduled" && (
        <Card className="p-4">
          <p className="mb-2.5 text-sm font-medium">Can you make it?</p>
          <div className="flex gap-2">
            {(["accepted", "tentative", "declined"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={myStatus === status ? "primary" : "outline"}
                className="flex-1"
                disabled={pending}
                onClick={() => rsvp(status)}
              >
                {ATTENDEE_STATUS[status].label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {meeting.agenda && (
        <section>
          <SectionTitle>Agenda</SectionTitle>
          <Card className="p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{meeting.agenda}</p>
          </Card>
        </section>
      )}

      {/* Attendees */}
      <section>
        <SectionTitle
          action={
            canManage && notInvited.length > 0 ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-pink-500 hover:underline"
              >
                <UserPlus className="size-3.5" />
                Invite
              </button>
            ) : undefined
          }
        >
          Attendees ({attendees.length})
        </SectionTitle>

        <Card className="divide-y overflow-hidden">
          {attendees.map((guest) => {
            const status = ATTENDEE_STATUS[guest.status as keyof typeof ATTENDEE_STATUS];
            return (
              <div key={guest.user_id} className="flex items-center gap-3 p-3.5">
                <Avatar
                  name={guest.profile?.full_name || guest.profile?.email || "?"}
                  src={guest.profile?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {guest.profile?.full_name || guest.profile?.email}
                    {guest.user_id === currentUserId && (
                      <span className="muted ml-1.5 text-xs font-normal">you</span>
                    )}
                  </p>
                  <p className="muted truncate text-xs">
                    {guest.is_organiser ? "Organiser" : guest.profile?.job_title || ""}
                  </p>
                </div>
                <Badge className={status.className} dot={status.dot}>
                  {status.label}
                </Badge>
                {canManage && !guest.is_organiser && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const result = await removeAttendee(meeting.id, guest.user_id);
                        if (result?.error) toast.error(result.error);
                      })
                    }
                    aria-label="Remove"
                    className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:text-red-600"
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      {/* Minutes and decisions */}
      <section>
        <SectionTitle
          action={
            canManage && !editingMinutes ? (
              <button
                onClick={() => setEditingMinutes(true)}
                className="text-xs font-medium text-pink-500 hover:underline"
              >
                {meeting.minutes ? "Edit" : "Write up"}
              </button>
            ) : undefined
          }
        >
          Minutes &amp; decisions
        </SectionTitle>

        {editingMinutes ? (
          <Card className="p-4">
            <form action={writeUp} className="space-y-4">
              <Field label="What happened">
                <Textarea
                  name="minutes"
                  rows={6}
                  defaultValue={meeting.minutes ?? ""}
                  placeholder="The discussion, in enough detail that someone who missed it can catch up."
                />
              </Field>
              <Field label="Decisions" hint="Kept separate so the outcome is findable later.">
                <Textarea
                  name="decisions"
                  rows={3}
                  defaultValue={meeting.decisions ?? ""}
                  placeholder="What was actually agreed."
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingMinutes(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={pending}>
                  Save
                </Button>
              </div>
            </form>
          </Card>
        ) : meeting.minutes || meeting.decisions ? (
          <Card className="divide-y">
            {meeting.minutes && (
              <div className="p-4">
                <p className="muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                  What happened
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{meeting.minutes}</p>
              </div>
            )}
            {meeting.decisions && (
              <div className="bg-[var(--surface-sunken)] p-4">
                <p className="muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                  Decisions
                </p>
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                  {meeting.decisions}
                </p>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-4">
            <p className="muted text-sm">
              Not written up yet. Minutes are what stop a decision evaporating the moment
              everyone leaves the room.
            </p>
          </Card>
        )}
      </section>

      {/* Action items */}
      <section>
        <SectionTitle
          action={
            canManage ? (
              <button
                onClick={() => setActionOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-pink-500 hover:underline"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            ) : undefined
          }
        >
          Action items ({actionItems.length})
        </SectionTitle>

        {actionItems.length === 0 ? (
          <Card className="p-4">
            <p className="muted text-sm">
              Nothing assigned yet. Action items become real tasks — they show up in the
              owner&apos;s work list and get reminders.
            </p>
          </Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {actionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3.5">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    TASK_PRIORITY[item.priority].dot
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      item.status === "done" && "muted line-through"
                    )}
                  >
                    {item.title}
                  </p>
                  {item.due_at && (
                    <p className="muted mt-0.5 text-xs">Due {formatDate(item.due_at)}</p>
                  )}
                </div>
                {item.assignee && (
                  <Avatar
                    name={item.assignee.full_name || item.assignee.email}
                    src={item.assignee.avatar_url}
                    size="xs"
                  />
                )}
                {item.status === "done" && (
                  <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* Status control */}
      {canManage && (
        <div>
          <p className="muted mb-2 text-xs font-semibold uppercase tracking-wide">Status</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {(["scheduled", "in_progress", "completed", "cancelled"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatus(status)}
                disabled={pending}
                aria-pressed={meeting.status === status}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:opacity-60",
                  meeting.status === status
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "surface hover:border-pink-300"
                )}
              >
                {MEETING_STATUS[status].label}
              </button>
            ))}
          </div>
        </div>
      )}

      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        meetingId={meeting.id}
        candidates={notInvited}
      />

      <ActionItemSheet
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        meetingId={meeting.id}
        departmentId={meeting.department_id}
        attendees={attendees}
      />
    </div>
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {children}
      </h2>
      {action}
    </div>
  );
}

function InviteSheet({
  open,
  onClose,
  meetingId,
  candidates,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  candidates: TeamMember[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function invite() {
    startTransition(async () => {
      const result = await addAttendees(meetingId, selected);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${selected.length} invited`);
        setSelected([]);
        onClose();
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Invite more people"
      description="They get a WhatsApp invitation straight away."
      footer={
        <Button block loading={pending} disabled={!selected.length} onClick={invite}>
          Invite {selected.length > 0 && selected.length}
        </Button>
      }
    >
      <ul className="space-y-1">
        {candidates.map((member) => {
          const isSelected = selected.includes(member.id);
          return (
            <li key={member.id}>
              <button
                onClick={() =>
                  setSelected((prev) =>
                    isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                  )
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  isSelected ? "bg-pink-50 dark:bg-pink-900/20" : "hover:bg-[var(--surface-sunken)]"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border-2",
                    isSelected ? "border-pink-500 bg-pink-500" : "border-[var(--border-subtle)]"
                  )}
                >
                  {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                <Avatar name={member.full_name || member.email} src={member.avatar_url} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.full_name || member.email}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function ActionItemSheet({
  open,
  onClose,
  meetingId,
  departmentId,
  attendees,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  departmentId: string | null;
  attendees: AttendeeRow[];
}) {
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await addActionItem(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Action item added");
        onClose();
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Add action item"
      description="This becomes a real task in the owner's work list."
    >
      <form action={submit} className="space-y-4">
        <input type="hidden" name="meeting_id" value={meetingId} />
        <input type="hidden" name="department_id" value={departmentId ?? ""} />

        <Field label="What needs doing?" required>
          <Input name="title" required autoFocus placeholder="e.g. Send the revised budget to Finance" />
        </Field>

        <Field label="Owner">
          <Select name="assignee_id" defaultValue="">
            <option value="">Unassigned</option>
            {attendees.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.profile?.full_name || a.profile?.email}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due">
            <Input name="due_at" type="datetime-local" />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="normal">
              {Object.entries(TASK_PRIORITY).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Button type="submit" block loading={pending} className="mt-2">
          <ListChecks className="size-4" />
          Add action item
        </Button>
      </form>
    </Sheet>
  );
}
