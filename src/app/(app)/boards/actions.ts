"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** The columns every new board starts with. */
const DEFAULT_COLUMNS = ["To do", "In progress", "Review", "Done"];

export async function createBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the board a name." };

  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      department_id: String(formData.get("department_id") ?? "") || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !board) return { error: error?.message ?? "Could not create the board." };

  const { error: columnError } = await supabase.from("board_columns").insert(
    DEFAULT_COLUMNS.map((columnName, index) => ({
      board_id: board.id,
      name: columnName,
      sort_order: index,
    }))
  );

  if (columnError) {
    return { error: `Board created, but its columns could not be set up: ${columnError.message}` };
  }

  revalidatePath("/boards");
  return { ok: true };
}

export async function createBoardTask(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const boardId = String(formData.get("board_id") ?? "");
  if (!title) return { error: "Give the task a title." };
  if (!boardId) return { error: "Missing board." };

  const dueRaw = String(formData.get("due_at") ?? "");

  const { error } = await supabase.from("tasks").insert({
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    board_id: boardId,
    column_id: String(formData.get("column_id") ?? "") || null,
    assignee_id: String(formData.get("assignee_id") ?? "") || null,
    department_id: String(formData.get("department_id") ?? "") || null,
    priority: (String(formData.get("priority") ?? "normal") || "normal") as TaskPriority,
    due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/boards/${boardId}`);
  return { ok: true };
}

/** Move a card between columns, keeping status roughly in step. */
export async function moveTaskToColumn(taskId: string, columnId: string, columnName: string) {
  await requireUser();
  const supabase = await createClient();

  const normalised = columnName.toLowerCase();
  const status: TaskStatus | undefined = normalised.includes("done")
    ? "done"
    : normalised.includes("progress")
      ? "in_progress"
      : normalised.includes("review")
        ? "in_progress"
        : "todo";

  const { error } = await supabase
    .from("tasks")
    .update({ column_id: columnId, status })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/boards", "layout");
  return { ok: true };
}
