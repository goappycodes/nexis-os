"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronRight, GripVertical, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { createBoardTask, moveTaskToColumn } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { TASK_PRIORITY } from "@/lib/constants";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import type { BoardColumn, Profile, Task } from "@/lib/types";

type BoardTask = Task & {
  assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
};
type TeamMember = Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;

export function BoardView({
  boardId,
  columns,
  tasks,
  team,
  departmentId,
  currentUserId,
  commentCounts,
  canManage,
}: {
  boardId: string;
  columns: BoardColumn[];
  tasks: BoardTask[];
  team: TeamMember[];
  departmentId: string | null;
  currentUserId: string;
  commentCounts: Record<string, number>;
  canManage: boolean;
}) {
  const [addTo, setAddTo] = useState<BoardColumn | null>(null);
  const [detail, setDetail] = useState<BoardTask | null>(null);
  const [moving, setMoving] = useState<BoardTask | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The card should land in its new column the instant you drop it, not
  // after the server round trip.
  const [cards, applyMove] = useOptimistic(
    tasks,
    (current, update: { id: string; columnId: string }) =>
      current.map((t) => (t.id === update.id ? { ...t, column_id: update.columnId } : t))
  );

  function move(task: BoardTask, column: BoardColumn) {
    setMoving(null);
    if (task.column_id === column.id) return;

    startTransition(async () => {
      applyMove({ id: task.id, columnId: column.id });
      const result = await moveTaskToColumn(task.id, column.id, column.name);
      if (result?.error) toast.error(result.error);
      else toast.success(`Moved to ${column.name}`);
    });
  }

  function handleDrop(column: BoardColumn, event: React.DragEvent) {
    event.preventDefault();
    setDragOver(null);

    // Read the id off the drag payload rather than component state: state set
    // in onDragStart may not have committed yet, and dataTransfer is the
    // mechanism the platform actually guarantees.
    const id = event.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    if (!id) return;

    const task = cards.find((t) => t.id === id);
    if (task) move(task, column);
  }

  return (
    <>
      {/* Columns scroll horizontally on phone, sit side by side on desktop.
          A drag-and-drop board is unusable on a small touch screen, so moving
          a card is an explicit tap-to-choose action instead. */}
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {columns.map((column) => {
          const items = cards.filter((t) => t.column_id === column.id);

          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                // Preventing default is what marks this a valid drop target.
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== column.id) setDragOver(column.id);
              }}
              onDragLeave={(e) => {
                // Ignore bubbling from children, or the highlight flickers.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => handleDrop(column, e)}
              className={cn(
                "w-[85vw] shrink-0 snap-start rounded-2xl p-1 transition sm:w-72",
                dragOver === column.id && "bg-pink-50 ring-2 ring-pink-400 dark:bg-pink-900/20"
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold">
                  {column.name}
                  <span className="muted ml-1.5 font-normal">{items.length}</span>
                </p>
                {canManage && (
                  <button
                    onClick={() => setAddTo(column)}
                    aria-label={`Add task to ${column.name}`}
                    className="flex size-7 items-center justify-center rounded-lg hover:bg-[var(--surface-sunken)]"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {items.map((task) => {
                  const overdue =
                    task.status !== "done" && task.due_at && daysUntil(task.due_at) < 0;
                  const count = commentCounts[task.id] ?? 0;

                  return (
                    <Card
                      key={task.id}
                      draggable={canManage}
                      onDragStart={(e) => {
                        setDragging(task.id);
                        e.dataTransfer.effectAllowed = "move";
                        // Firefox will not start a drag without payload.
                        e.dataTransfer.setData("text/plain", task.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDragOver(null);
                      }}
                      className={cn(
                        "p-3 transition",
                        canManage && "sm:cursor-grab sm:active:cursor-grabbing",
                        dragging === task.id && "opacity-40"
                      )}
                    >
                      <button onClick={() => setDetail(task)} className="w-full text-left">
                        <div className="flex items-start gap-2">
                          {canManage && (
                            <GripVertical
                              className="mt-0.5 hidden size-3.5 shrink-0 text-[var(--text-muted)] sm:block"
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              "mt-1.5 size-1.5 shrink-0 rounded-full",
                              TASK_PRIORITY[task.priority].dot
                            )}
                            aria-hidden
                          />
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              task.status === "done" && "muted line-through"
                            )}
                          >
                            {task.title}
                          </p>
                        </div>

                        <div className="mt-2 flex items-center gap-2 pl-3.5">
                          {task.assignee && (
                            <Avatar
                              name={task.assignee.full_name || task.assignee.email}
                              src={task.assignee.avatar_url}
                              size="xs"
                            />
                          )}
                          {task.due_at && (
                            <span
                              className={cn(
                                "text-xs",
                                overdue ? "font-medium text-red-600" : "muted"
                              )}
                            >
                              {formatDate(task.due_at)}
                            </span>
                          )}
                          {count > 0 && (
                            <span className="muted inline-flex items-center gap-1 text-xs">
                              <MessageSquare className="size-3" />
                              {count}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Dragging is unusable inside a horizontally
                          scrolling board on touch, so phones get Move. */}
                      {canManage && columns.length > 1 && (
                        <button
                          onClick={() => setMoving(task)}
                          className="mt-2 inline-flex items-center gap-1 pl-3.5 text-xs font-medium text-pink-500 hover:underline sm:hidden"
                        >
                          Move
                          <ChevronRight className="size-3" />
                        </button>
                      )}
                    </Card>
                  );
                })}

                {items.length === 0 && (
                  <div
                    className={cn(
                      "rounded-xl border border-dashed p-6 text-center transition",
                      dragOver === column.id && "border-pink-400"
                    )}
                  >
                    <p className="muted text-xs">
                      {dragOver === column.id ? "Drop here" : "Nothing here"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add task */}
      {addTo && (
        <AddTaskSheet
          column={addTo}
          boardId={boardId}
          team={team}
          departmentId={departmentId}
          onClose={() => setAddTo(null)}
        />
      )}

      {/* Move task */}
      <Sheet
        open={moving !== null}
        onClose={() => setMoving(null)}
        title="Move task"
        description={moving?.title}
      >
        <ul className="space-y-1">
          {columns.map((column) => (
            <li key={column.id}>
              <button
                onClick={() => moving && move(moving, column)}
                disabled={pending || moving?.column_id === column.id}
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-[var(--surface-sunken)] disabled:opacity-50",
                  moving?.column_id === column.id && "bg-pink-50 font-medium dark:bg-pink-900/20"
                )}
              >
                {column.name}
                {moving?.column_id === column.id && (
                  <span className="muted ml-2 text-xs">current</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <TaskDetailSheet
        task={detail}
        team={team}
        currentUserId={currentUserId}
        canEdit={canManage || detail?.assignee_id === currentUserId}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

function AddTaskSheet({
  column,
  boardId,
  team,
  departmentId,
  onClose,
}: {
  column: BoardColumn;
  boardId: string;
  team: TeamMember[];
  departmentId: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createBoardTask(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Task added");
        onClose();
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Add task" description={`To "${column.name}"`}>
      <form action={submit} className="space-y-4">
        <input type="hidden" name="board_id" value={boardId} />
        <input type="hidden" name="column_id" value={column.id} />
        <input type="hidden" name="department_id" value={departmentId ?? ""} />

        <Field label="Task" required>
          <Input name="title" required autoFocus placeholder="What needs doing?" />
        </Field>

        <Field label="Details">
          <Textarea name="description" rows={3} />
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

        <Field label="Assign to">
          <Select name="assignee_id" defaultValue="">
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" block loading={pending} className="mt-2">
          Add task
        </Button>
      </form>
    </Sheet>
  );
}
