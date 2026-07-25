"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addChecklistItem,
  addTaskComment,
  deleteTaskComment,
  getChecklistItems,
  getTaskComments,
  toggleChecklistItem,
  updateTaskDetails,
  type CommentWithAuthor,
} from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/misc";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TASK_PRIORITY, WORK_CATEGORY } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import type { Profile, Task, TaskChecklistItem, TaskPriority, WorkCategory } from "@/lib/types";

type TeamMember = Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;

/** Convert an ISO timestamp into the value a datetime-local input expects. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDetailSheet({
  task,
  team,
  currentUserId,
  canEdit,
  onClose,
}: {
  task: (Task & { assignee?: TeamMember | null }) | null;
  team: TeamMember[];
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [subtasks, setSubtasks] = useState<TaskChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [editing, setEditing] = useState(false);

  const taskId = task?.id;

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);
    setEditing(false);

    Promise.all([getTaskComments(taskId), getChecklistItems(taskId)]).then(
      ([loadedComments, loadedSubtasks]) => {
        if (cancelled) return;
        setComments(loadedComments);
        setSubtasks(loadedSubtasks as TaskChecklistItem[]);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (!task) return null;

  function refresh() {
    if (!taskId) return;
    Promise.all([getTaskComments(taskId), getChecklistItems(taskId)]).then(
      ([c, s]) => {
        setComments(c);
        setSubtasks(s as TaskChecklistItem[]);
      }
    );
  }

  function submitComment() {
    const body = draft.trim();
    if (!body || !taskId) return;

    startTransition(async () => {
      const result = await addTaskComment(taskId, body);
      if (result?.error) toast.error(result.error);
      else {
        setDraft("");
        refresh();
      }
    });
  }

  function removeComment(id: string) {
    startTransition(async () => {
      const result = await deleteTaskComment(id);
      if (result?.error) toast.error(result.error);
      else setComments((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function saveDetails(formData: FormData) {
    if (!taskId) return;
    const dueRaw = String(formData.get("due_at") ?? "");

    startTransition(async () => {
      const result = await updateTaskDetails(taskId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
        assignee_id: String(formData.get("assignee_id") ?? "") || null,
        priority: String(formData.get("priority") ?? "normal") as TaskPriority,
        category: String(formData.get("category") ?? "other") as WorkCategory,
      });

      if (result?.error) toast.error(result.error);
      else {
        toast.success("Saved");
        setEditing(false);
      }
    });
  }

  function addSubtask() {
    const title = newSubtask.trim();
    if (!title || !taskId) return;

    startTransition(async () => {
      const result = await addChecklistItem(taskId, title);
      if (result?.error) toast.error(result.error);
      else {
        setNewSubtask("");
        refresh();
      }
    });
  }

  function toggleSubtask(item: TaskChecklistItem) {
    // Optimistic — a sub-task tick should never feel like a round trip.
    setSubtasks((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, is_done: !s.is_done } : s))
    );
    startTransition(async () => {
      const result = await toggleChecklistItem(item.id, !item.is_done);
      if (result?.error) {
        toast.error(result.error);
        refresh();
      }
    });
  }

  const priorityMeta = TASK_PRIORITY[task.priority];

  return (
    <Sheet open onClose={onClose} title={editing ? "Edit task" : task.title}>
      {editing ? (
        <form action={saveDetails} className="space-y-4">
          <Field label="Title" required>
            <Input name="title" defaultValue={task.title} required autoFocus />
          </Field>

          <Field label="Details" hint="Anything the person doing this needs to know.">
            <Textarea name="description" rows={4} defaultValue={task.description ?? ""} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due">
              <Input name="due_at" type="datetime-local" defaultValue={toLocalInput(task.due_at)} />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue={task.priority}>
                {Object.entries(TASK_PRIORITY).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Assign to">
            <Select name="assignee_id" defaultValue={task.assignee_id ?? ""}>
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category">
            <Select name="category" defaultValue={task.category}>
              {Object.entries(WORK_CATEGORY).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={pending}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", priorityMeta.className)}>
              {priorityMeta.label}
            </span>
            <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium">
              {WORK_CATEGORY[task.category].label}
            </span>
            {task.due_at && (
              <span className="muted text-xs">Due {formatDateTime(task.due_at)}</span>
            )}
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
          )}

          {task.assignee && (
            <div className="flex items-center gap-2">
              <Avatar
                name={task.assignee.full_name || task.assignee.email}
                src={task.assignee.avatar_url}
                size="sm"
              />
              <span className="text-sm">{task.assignee.full_name || task.assignee.email}</span>
            </div>
          )}

          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          )}

          {/* Sub-tasks */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Sub-tasks
            </p>

            {subtasks.length > 0 && (
              <ul className="mb-2 space-y-1">
                {subtasks.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => toggleSubtask(item)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-[var(--surface-sunken)]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2",
                          item.is_done
                            ? "border-green-600 bg-green-600"
                            : "border-[var(--border-subtle)]"
                        )}
                      >
                        {item.is_done && <Check className="size-2.5 text-white" strokeWidth={4} />}
                      </span>
                      <span
                        className={cn(
                          "text-sm leading-snug",
                          item.is_done && "text-[var(--text-muted)] line-through"
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a sub-task…"
                className="h-10 min-h-10"
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={addSubtask}
                disabled={!newSubtask.trim() || pending}
                aria-label="Add sub-task"
                className="size-10 shrink-0"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : comments.length === 0 ? (
              <p className="muted py-2 text-sm">
                No comments yet. Add context, blockers or updates here.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex gap-2.5">
                    <Avatar
                      name={comment.author?.full_name || comment.author?.email || "?"}
                      src={comment.author?.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">
                          {comment.author?.full_name || comment.author?.email || "Unknown"}
                        </span>
                        <span className="muted shrink-0 text-[11px]">
                          {formatDateTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                    {comment.author_id === currentUserId && (
                      <button
                        onClick={() => removeComment(comment.id)}
                        aria-label="Delete comment"
                        className="shrink-0 self-start rounded p-1 text-[var(--text-muted)] hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter makes a new line.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                rows={2}
                placeholder="Write a comment…"
                className="min-h-11"
              />
              <Button
                size="icon"
                onClick={submitComment}
                disabled={!draft.trim() || pending}
                aria-label="Send comment"
                className="shrink-0 self-end"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
