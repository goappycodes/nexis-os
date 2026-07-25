"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Check, ChevronDown, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addEventTask, assignTask, toggleTask } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { NavIcon } from "@/components/shell/nav-icon";
import { WORK_CATEGORY } from "@/lib/constants";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import type { Profile, Task, WorkCategory } from "@/lib/types";

type ChecklistTask = Task & {
  assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
};

type TeamMember = Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;

export function EventChecklist({
  eventId,
  tasks,
  team,
  canManage,
  departmentId,
}: {
  eventId: string;
  tasks: ChecklistTask[];
  team: TeamMember[];
  canManage: boolean;
  departmentId: string | null;
}) {
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [assigning, setAssigning] = useState<ChecklistTask | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Optimistic toggle: ticking a box on a phone must feel instant, even on a
  // patchy campus connection. The server action reconciles afterwards.
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (current, update: { id: string; done: boolean }) =>
      current.map((t) =>
        t.id === update.id ? { ...t, status: update.done ? "done" : "todo" } : t
      )
  );

  const grouped = useMemo(() => {
    const visible = optimisticTasks.filter(
      (t) => t.status !== "cancelled" && (showDone || t.status !== "done")
    );

    const byCategory = new Map<WorkCategory, ChecklistTask[]>();
    for (const task of visible) {
      const list = byCategory.get(task.category) ?? [];
      list.push(task);
      byCategory.set(task.category, list);
    }

    // Order categories by their earliest due date so the checklist reads as a
    // timeline rather than an arbitrary alphabetical list.
    return [...byCategory.entries()].sort(([, a], [, b]) => {
      const first = (list: ChecklistTask[]) =>
        Math.min(...list.map((t) => (t.due_at ? new Date(t.due_at).getTime() : Infinity)));
      return first(a) - first(b);
    });
  }, [optimisticTasks, showDone]);

  const doneCount = optimisticTasks.filter((t) => t.status === "done").length;

  function handleToggle(task: ChecklistTask) {
    const next = task.status !== "done";
    startTransition(async () => {
      applyOptimistic({ id: task.id, done: next });
      const result = await toggleTask(task.id, next);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleAssign(taskId: string, userId: string | null) {
    setAssigning(null);
    startTransition(async () => {
      const result = await assignTask(taskId, userId);
      if (result?.error) toast.error(result.error);
      else toast.success(userId ? "Assigned" : "Unassigned");
    });
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No checklist yet"
          description="This event was created without a playbook. Add the first task to get going."
          action={
            canManage && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add task
              </Button>
            )
          }
        />
        <AddTaskSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          eventId={eventId}
          team={team}
          departmentId={departmentId}
        />
      </Card>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Checklist
        </h2>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="text-xs font-medium text-pink-500 hover:underline"
            >
              {showDone ? "Hide" : "Show"} done ({doneCount})
            </button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(([category, items]) => (
          <CategoryGroup
            key={category}
            category={category}
            items={items}
            onToggle={handleToggle}
            onAssignClick={setAssigning}
            canManage={canManage}
          />
        ))}
      </div>

      {grouped.length === 0 && (
        <Card>
          <EmptyState
            icon={<Check className="size-6" />}
            title="All done"
            description="Every step on this checklist is complete."
          />
        </Card>
      )}

      <AddTaskSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        eventId={eventId}
        team={team}
        departmentId={departmentId}
      />

      <Sheet
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="Assign task"
        description={assigning?.title}
      >
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => assigning && handleAssign(assigning.id, null)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-[var(--surface-sunken)]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
                <UserPlus className="size-4 text-[var(--text-muted)]" />
              </span>
              Unassigned
            </button>
          </li>
          {team.map((member) => (
            <li key={member.id}>
              <button
                onClick={() => assigning && handleAssign(assigning.id, member.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-[var(--surface-sunken)]",
                  assigning?.assignee_id === member.id && "bg-pink-50 dark:bg-pink-900/20"
                )}
              >
                <Avatar name={member.full_name || member.email} src={member.avatar_url} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  {member.full_name || member.email}
                </span>
                {assigning?.assignee_id === member.id && (
                  <Check className="size-4 shrink-0 text-pink-500" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}

function CategoryGroup({
  category,
  items,
  onToggle,
  onAssignClick,
  canManage,
}: {
  category: WorkCategory;
  items: ChecklistTask[];
  onToggle: (task: ChecklistTask) => void;
  onAssignClick: (task: ChecklistTask) => void;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(true);
  const meta = WORK_CATEGORY[category];
  const done = items.filter((t) => t.status === "done").length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-sunken)]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-900/30">
          <NavIcon name={meta.icon} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{meta.label}</span>
          <span className="muted text-xs">
            {done}/{items.length} done
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="divide-y border-t">
          {items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggle}
              onAssignClick={onAssignClick}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TaskRow({
  task,
  onToggle,
  onAssignClick,
  canManage,
}: {
  task: ChecklistTask;
  onToggle: (task: ChecklistTask) => void;
  onAssignClick: (task: ChecklistTask) => void;
  canManage: boolean;
}) {
  const done = task.status === "done";
  const overdue = !done && task.due_at && daysUntil(task.due_at) < 0;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        onClick={() => onToggle(task)}
        aria-pressed={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition",
          done
            ? "border-green-600 bg-green-600"
            : "border-[var(--border-subtle)] hover:border-pink-500"
        )}
      >
        {done && <Check className="size-3.5 text-white" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", done && "text-[var(--text-muted)] line-through")}>
          {task.title}
        </p>
        {task.description && !done && (
          <p className="muted mt-0.5 text-xs leading-snug">{task.description}</p>
        )}
        {task.due_at && (
          <p
            className={cn(
              "mt-1 text-xs",
              overdue ? "font-medium text-red-600" : "text-[var(--text-muted)]"
            )}
          >
            {overdue ? "Overdue · " : "Due "}
            {formatDate(task.due_at)}
          </p>
        )}
      </div>

      <button
        onClick={() => canManage && onAssignClick(task)}
        disabled={!canManage}
        aria-label={task.assignee ? `Assigned to ${task.assignee.full_name}` : "Assign this task"}
        className="mt-0.5 shrink-0 rounded-full transition disabled:cursor-default disabled:opacity-100"
      >
        {task.assignee ? (
          <Avatar
            name={task.assignee.full_name || task.assignee.email}
            src={task.assignee.avatar_url}
            size="sm"
          />
        ) : (
          canManage && (
            <span className="flex size-8 items-center justify-center rounded-full border border-dashed text-[var(--text-muted)] hover:border-pink-500 hover:text-pink-500">
              <UserPlus className="size-3.5" />
            </span>
          )
        )}
      </button>
    </li>
  );
}

function AddTaskSheet({
  open,
  onClose,
  eventId,
  team,
  departmentId,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  team: TeamMember[];
  departmentId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addEventTask(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Task added");
        onClose();
      }
    });
  }

  if (!open) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Add task">
      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="department_id" value={departmentId ?? ""} />

        <Field label="Task" required>
          <Input name="title" required autoFocus placeholder="What needs doing?" />
        </Field>

        <Field label="Category">
          <Select name="category" defaultValue="other">
            {Object.entries(WORK_CATEGORY).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Due">
          <Input name="due_at" type="datetime-local" />
        </Field>

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
