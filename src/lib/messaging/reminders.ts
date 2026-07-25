import { createAdminClient } from "@/lib/supabase/server";
import { sendMessage } from "./msg91";
import { formatDate, toE164 } from "@/lib/utils";
import type { Reminder } from "@/lib/types";

/**
 * Reminder scheduling and delivery.
 *
 * Runs with the service-role client because the cron job has no user session —
 * it acts on behalf of the whole organisation.
 */

/**
 * Approved WhatsApp template names, created by scripts/msg91-templates.mjs.
 *
 * In every one of these, {{1}} is the recipient's first name; the remaining
 * variables come from the reminder's payload.variables, in order.
 */
export const TEMPLATES = {
  taskReminder: "nexisos_task_reminder",
  taskUrgent: "nexisos_task_urgent",
  taskAssigned: "nexisos_task_assigned",
  approvalPending: "nexisos_approval_pending",
  approvalDecision: "nexisos_approval_decision",
  eventCountdown: "nexisos_event_countdown",
} as const;

export type ScheduleInput = {
  userId: string;
  sendAt: Date;
  body: string;
  entityType?: string;
  entityId?: string;
  template?: string;
  channel?: "whatsapp" | "sms" | "in_app";
  payload?: Record<string, unknown>;
};

export async function scheduleReminder(input: ScheduleInput) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("reminders").insert({
    user_id: input.userId,
    send_at: input.sendAt.toISOString(),
    body: input.body,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    template: input.template ?? null,
    channel: input.channel ?? "whatsapp",
    payload: input.payload ?? {},
    status: "pending",
  });

  return { error: error?.message };
}

/**
 * Queue an immediate WhatsApp nudge. Used by the approval flow, where waiting
 * for the nightly cron would defeat the point — the whole reason approvals
 * happen on WhatsApp today is that they are fast.
 *
 * Fire-and-forget: a messaging failure must never break the user's action.
 */
export async function notifyNow(input: {
  userId: string;
  template: string;
  variables: string[];
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    const supabase = createAdminClient();

    const { data: reminder, error } = await supabase
      .from("reminders")
      .insert({
        user_id: input.userId,
        send_at: new Date().toISOString(),
        body: input.body,
        template: input.template,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        channel: "whatsapp",
        payload: { variables: input.variables },
        status: "pending",
      })
      .select("*")
      .single();

    if (error || !reminder) return { error: error?.message };

    await deliverReminder(reminder as Reminder);
    return {};
  } catch (error) {
    console.error("[notifyNow]", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Queue day-before nudges for every task due tomorrow that has an assignee.
 *
 * Deliberately idempotent: an existing pending or sent reminder for the same
 * task and user means we skip, so running the cron twice never double-sends.
 */
export async function scheduleDueTaskReminders() {
  const supabase = createAdminClient();

  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, assignee_id, event:events(name)")
    .not("assignee_id", "is", null)
    .not("status", "in", "(done,cancelled)")
    .gte("due_at", tomorrowStart.toISOString())
    .lte("due_at", tomorrowEnd.toISOString());

  // The relational select erases the generated row type; narrow it once here.
  const tasks = (data ?? []) as unknown as {
    id: string;
    title: string;
    due_at: string;
    assignee_id: string;
    event: { name: string } | null;
  }[];

  if (!tasks.length) return { scheduled: 0 };

  const { data: existing } = await supabase
    .from("reminders")
    .select("entity_id, user_id")
    .eq("entity_type", "task")
    .in("status", ["pending", "sent"])
    .in("entity_id", tasks.map((t) => t.id));

  const seen = new Set((existing ?? []).map((r) => `${r.entity_id}:${r.user_id}`));

  // Send at 9am the morning before — early enough to act on.
  const sendAt = new Date(now);
  sendAt.setHours(9, 0, 0, 0);
  if (sendAt < now) sendAt.setTime(now.getTime() + 60_000);

  const rows = tasks
    .filter((task) => task.assignee_id && !seen.has(`${task.id}:${task.assignee_id}`))
    .map((task) => ({
      user_id: task.assignee_id,
      entity_type: "task",
      entity_id: task.id,
      channel: "whatsapp" as const,
      send_at: sendAt.toISOString(),
      template: TEMPLATES.taskReminder,
      body: `Reminder: "${task.title}" is due ${formatDate(task.due_at)}${
        task.event ? ` for ${task.event.name}` : ""
      }.`,
      // Template variables after {{1}}, which is always the recipient's first
      // name and is filled in at send time when we have their profile.
      payload: { variables: [task.title, formatDate(task.due_at)] },
      status: "pending" as const,
    }));

  if (!rows.length) return { scheduled: 0 };

  const { error } = await supabase.from("reminders").insert(rows);
  return { scheduled: error ? 0 : rows.length, error: error?.message };
}

/**
 * Escalate work that is overdue, or urgent-priority and due today.
 *
 * Separate from the routine day-before nudge on purpose: this uses a visually
 * distinct template so a genuine escalation does not read like the daily noise.
 * Re-escalates at most once every 48 hours per task so a stuck item nags
 * without becoming background static people learn to ignore.
 */
export async function scheduleUrgentTaskReminders() {
  const supabase = createAdminClient();

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_at, assignee_id, priority")
    .not("assignee_id", "is", null)
    .not("status", "in", "(done,cancelled)")
    .lte("due_at", endOfToday.toISOString())
    .limit(200);

  const tasks = (data ?? []) as unknown as {
    id: string;
    title: string;
    due_at: string;
    assignee_id: string;
    priority: string;
  }[];

  // Overdue at any priority, or urgent and due today.
  const candidates = tasks.filter(
    (t) => new Date(t.due_at) < now || t.priority === "urgent"
  );

  if (!candidates.length) return { escalated: 0 };

  const cutoff = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("reminders")
    .select("entity_id, user_id")
    .eq("entity_type", "task")
    .eq("template", TEMPLATES.taskUrgent)
    .gte("created_at", cutoff)
    .in("entity_id", candidates.map((t) => t.id));

  const recentlyNudged = new Set((recent ?? []).map((r) => `${r.entity_id}:${r.user_id}`));

  const rows = candidates
    .filter((t) => !recentlyNudged.has(`${t.id}:${t.assignee_id}`))
    .map((task) => {
      const overdueDays = Math.floor(
        (now.getTime() - new Date(task.due_at).getTime()) / 86_400_000
      );
      const statusLine =
        overdueDays > 0
          ? `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`
          : "Marked urgent, due today";

      return {
        user_id: task.assignee_id,
        entity_type: "task",
        entity_id: task.id,
        channel: "whatsapp" as const,
        send_at: now.toISOString(),
        template: TEMPLATES.taskUrgent,
        body: `Urgent: "${task.title}" — ${statusLine}.`,
        payload: { variables: [task.title, formatDate(task.due_at), statusLine] },
        status: "pending" as const,
      };
    });

  if (!rows.length) return { escalated: 0 };

  const { error } = await supabase.from("reminders").insert(rows);
  return { escalated: error ? 0 : rows.length, error: error?.message };
}

/**
 * Deliver every pending reminder whose time has come.
 *
 * Each attempt is recorded in message_log regardless of outcome, so delivery
 * problems are visible rather than silent.
 */
export async function dispatchDueReminders(limit = 50) {
  const supabase = createAdminClient();

  const { data: due } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at")
    .limit(limit);

  if (!due?.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of due) {
    const outcome = await deliverReminder(reminder as Reminder);
    if (outcome === "sent") sent++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  }

  return { sent, failed, skipped };
}

/**
 * Deliver a single reminder and record the attempt.
 *
 * Split out so an approval notification can go straight out rather than
 * waiting for the next cron pass — approvals are the flow people feel most.
 */
async function deliverReminder(reminder: Reminder): Promise<"sent" | "failed" | "skipped"> {
  const supabase = createAdminClient();

  const { data: profile } = reminder.user_id
    ? await supabase
        .from("profiles")
        .select("id, phone, full_name, whatsapp_opt_in, is_active")
        .eq("id", reminder.user_id)
        .single()
    : { data: null };

  // Respect opt-out and deactivation rather than shouting into the void.
  if (
    !profile ||
    !profile.is_active ||
    (reminder.channel === "whatsapp" && !profile.whatsapp_opt_in)
  ) {
    await supabase
      .from("reminders")
      .update({
        status: "cancelled",
        error: !profile
          ? "No profile"
          : !profile.is_active
            ? "User deactivated"
            : "User opted out of WhatsApp",
      })
      .eq("id", reminder.id);
    return "skipped";
  }

  const phone = toE164(profile.phone);
  if (!phone) {
    await supabase
      .from("reminders")
      .update({
        status: "failed",
        error: "No phone number on file",
        attempts: reminder.attempts + 1,
      })
      .eq("id", reminder.id);
    return "failed";
  }

  // {{1}} is always the first name; the rest were resolved at schedule time.
  const extraVariables = Array.isArray((reminder.payload as { variables?: unknown })?.variables)
    ? (reminder.payload as { variables: unknown[] }).variables.map(String)
    : [];

  const result = await sendMessage({
    to: phone,
    channel: reminder.channel,
    body: reminder.body ?? undefined,
    template: reminder.template ?? undefined,
    variables: [profile.full_name?.split(" ")[0] || "there", ...extraVariables],
  });

  await supabase.from("message_log").insert({
    provider: "msg91",
    channel: reminder.channel,
    recipient: phone,
    template: reminder.template,
    body: reminder.body,
    status: result.status,
    provider_response: (result.response ?? { error: result.error }) as never,
    reminder_id: reminder.id,
  });

  await supabase
    .from("reminders")
    .update({
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.error ?? null,
      provider_message_id: result.messageId ?? null,
      attempts: reminder.attempts + 1,
    })
    .eq("id", reminder.id);

  return result.ok ? "sent" : "failed";
}
