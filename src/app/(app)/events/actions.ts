"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import type { EventStatus, TaskStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Create an event and, when a playbook is chosen, materialise its every step
 * as a real task with a due date derived from the event date.
 *
 * This is the point of the whole module: the team stops rebuilding the same
 * checklist from memory and stops forgetting the boring-but-critical steps.
 */
export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "");
  const playbookId = String(formData.get("playbook_id") ?? "");

  if (!name) return { error: "Give the event a name." };
  if (!startsAt) return { error: "Pick the event date and time." };

  const eventDate = new Date(startsAt);
  if (Number.isNaN(eventDate.getTime())) return { error: "That date doesn't look right." };

  // Slugs must be unique; suffix on collision rather than failing the insert.
  const base = slugify(name) || "event";
  let slug = base;
  const { data: existing } = await supabase
    .from("events")
    .select("slug")
    .like("slug", `${base}%`);
  if (existing?.some((e) => e.slug === slug)) {
    slug = `${base}-${String(existing.length + 1)}`;
  }

  const departmentId = String(formData.get("department_id") ?? "") || null;
  const endsAtRaw = String(formData.get("ends_at") ?? "");
  const attendees = String(formData.get("expected_attendees") ?? "");
  const budget = String(formData.get("budget_amount") ?? "");

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name,
      slug,
      description: String(formData.get("description") ?? "").trim() || null,
      venue: String(formData.get("venue") ?? "").trim() || null,
      starts_at: eventDate.toISOString(),
      ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
      department_id: departmentId,
      owner_id: user.id,
      created_by: user.id,
      status: "planning",
      expected_attendees: attendees ? Number(attendees) : null,
      budget_amount: budget ? Number(budget) : null,
      registration_enabled: formData.get("registration_enabled") === "on",
    })
    .select("id, slug")
    .single();

  if (error || !event) {
    return { error: error?.message ?? "Could not create the event." };
  }

  if (playbookId) {
    const { data: items } = await supabase
      .from("event_playbook_items")
      .select("*")
      .eq("playbook_id", playbookId)
      .order("sort_order");

    if (items?.length) {
      const tasks = items.map((item) => {
        // Due at 6pm on the offset day — a workday deadline, not midnight.
        const due = new Date(eventDate);
        due.setDate(due.getDate() + item.offset_days);
        due.setHours(18, 0, 0, 0);

        return {
          title: item.title,
          description: item.description,
          event_id: event.id,
          category: item.category,
          department_id: item.department_id ?? departmentId,
          created_by: user.id,
          due_at: due.toISOString(),
          sort_order: item.sort_order,
          status: "todo" as TaskStatus,
        };
      });

      const { error: taskError } = await supabase.from("tasks").insert(tasks);
      if (taskError) {
        // The event exists and is usable; surface the partial failure rather
        // than silently handing back an empty checklist.
        return {
          error: `Event created, but the checklist could not be generated: ${taskError.message}`,
        };
      }
    }
  }

  await supabase.from("activity_log").insert({
    actor_id: user.id,
    action: "event.created",
    entity_type: "event",
    entity_id: event.id,
    department_id: departmentId,
    summary: `Created event "${name}"`,
  });

  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${event.slug}`);
}

export async function updateEventStatus(eventId: string, status: EventStatus) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath("/events");
  return { ok: true };
}

/** Toggle a checklist task between done and todo. */
export async function toggleTask(taskId: string, done: boolean) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  revalidatePath("/my-work");
  revalidatePath("/");
  return { ok: true };
}

export async function assignTask(taskId: string, assigneeId: string | null) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ assignee_id: assigneeId })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  return { ok: true };
}

export async function addEventTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const eventId = String(formData.get("event_id") ?? "");
  if (!title) return { error: "Give the task a title." };
  if (!eventId) return { error: "Missing event." };

  const dueRaw = String(formData.get("due_at") ?? "");

  const { error } = await supabase.from("tasks").insert({
    title,
    event_id: eventId,
    category: (String(formData.get("category") ?? "other") || "other") as never,
    assignee_id: String(formData.get("assignee_id") ?? "") || null,
    department_id: String(formData.get("department_id") ?? "") || null,
    due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
    created_by: user.id,
    sort_order: 999,
  });

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  return { ok: true };
}
