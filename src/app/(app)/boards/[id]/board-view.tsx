"use client";

import { useState, useTransition } from "react";
import { ChevronRight, MessageSquare, Plus } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

  function move(task: BoardTask, column: BoardColumn) {
    setMoving(null);
    startTransition(async () => {
      const result = await moveTaskToColumn(task.id, column.id, column.name);
      if (result?.error) toast.error(result.error);
      else toast.success(`Moved to ${column.name}`);
    });
  }

  return (
    <>
      {/* Columns scroll horizontally on phone, sit side by side on desktop.
          A drag-and-drop board is unusable on a small touch screen, so moving
          a card is an explicit tap-to-choose action instead. */}
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {columns.map((column) => {
          const items = tasks.filter((t) => t.column_id === column.id);

          return (
            <div key={column.id} className="w-[85vw] shrink-0 snap-start sm:w-72">
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
                    <Card key={task.id} className="p-3">
                      <button onClick={() => setDetail(task)} className="w-full text-left">
                        <div className="flex items-start gap-2">
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

                      {canManage && columns.length > 1 && (
                        <button
                          onClick={() => setMoving(task)}
                          className="mt-2 inline-flex items-center gap-1 pl-3.5 text-xs font-medium text-pink-500 hover:underline"
                        >
                          Move
                          <ChevronRight className="size-3" />
                        </button>
                      )}
                    </Card>
                  );
                })}

                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <p className="muted text-xs">Nothing here</p>
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
