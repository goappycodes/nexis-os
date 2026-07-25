"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Profile, TaskComment, TaskPriority, WorkCategory } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export type CommentWithAuthor = TaskComment & {
  author: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
};

/** Comment thread for a task, oldest first so it reads as a conversation. */
export async function getTaskComments(taskId: string): Promise<CommentWithAuthor[]> {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("task_comments")
    .select("*, author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function addTaskComment(taskId: string, body: string): Promise<ActionState> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: user.id,
    body: trimmed,
  });

  if (error) return { error: error.message };

  // Let the assignee know someone weighed in on their task.
  const { data: task } = await supabase
    .from("tasks")
    .select("assignee_id, title")
    .eq("id", taskId)
    .single();

  if (task?.assignee_id && task.assignee_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: task.assignee_id,
      title: `${user.full_name || user.email} commented`,
      body: `${task.title}: ${trimmed.slice(0, 120)}`,
      entity_type: "task",
      entity_id: taskId,
    });
  }

  revalidatePath("/events", "layout");
  revalidatePath("/my-work");
  return { ok: true };
}

export async function deleteTaskComment(commentId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  // RLS restricts deletion to the comment's author (or a super admin).
  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  if (error) return { error: "You can only delete your own comments." };

  revalidatePath("/events", "layout");
  return { ok: true };
}

/** Update the editable fields of a task from the detail sheet. */
export async function updateTaskDetails(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    due_at?: string | null;
    assignee_id?: string | null;
    priority?: TaskPriority;
    category?: WorkCategory;
  }
): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  if (patch.title !== undefined && !patch.title.trim()) {
    return { error: "The title can't be empty." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  revalidatePath("/my-work");
  return { ok: true };
}

export async function addChecklistItem(taskId: string, title: string): Promise<ActionState> {
  await requireUser();
  if (!title.trim()) return { error: "Give the sub-task a title." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: taskId, title: title.trim() });

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string, isDone: boolean): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_checklist_items")
    .update({ is_done: isDone })
    .eq("id", itemId);

  if (error) return { error: error.message };

  revalidatePath("/events", "layout");
  return { ok: true };
}

export async function getChecklistItems(taskId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("task_checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order")
    .order("title");

  return data ?? [];
}
