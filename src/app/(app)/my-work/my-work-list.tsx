"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { toggleTask } from "../events/actions";
import { Card } from "@/components/ui/card";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { TASK_PRIORITY } from "@/lib/constants";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import type { Profile, Task } from "@/lib/types";

type WorkTask = Task & {
  assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
  event: { id: string; name: string; slug: string } | null;
};

export function MyWorkList({
  tasks,
  team,
  currentUserId,
  commentCounts,
}: {
  tasks: WorkTask[];
  team: Pick<Profile, "id" | "full_name" | "avatar_url" | "email">[];
  currentUserId: string;
  commentCounts: Record<string, number>;
}) {
  const [, startTransition] = useTransition();
  const [detail, setDetail] = useState<WorkTask | null>(null);

  const [optimistic, apply] = useOptimistic(
    tasks,
    (current, update: { id: string; done: boolean }) =>
      current.map((t) =>
        t.id === update.id ? { ...t, status: update.done ? "done" : "todo" } : t
      )
  );

  function handleToggle(task: WorkTask) {
    const next = task.status !== "done";
    startTransition(async () => {
      apply({ id: task.id, done: next });
      const result = await toggleTask(task.id, next);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <>
      <Card className="divide-y overflow-hidden">
        {optimistic.map((task) => {
          const done = task.status === "done";
          const overdue = !done && task.due_at && daysUntil(task.due_at) < 0;
          const count = commentCounts[task.id] ?? 0;

          return (
            <div key={task.id} className="flex items-start gap-3 p-4">
              <button
                onClick={() => handleToggle(task)}
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

              <button onClick={() => setDetail(task)} className="min-w-0 flex-1 text-left">
                <div className="flex items-start gap-2">
                  <span
                    className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TASK_PRIORITY[task.priority].dot)}
                    aria-hidden
                  />
                  <p className={cn("text-sm leading-snug", done && "muted line-through")}>
                    {task.title}
                  </p>
                </div>

                <div className="muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-3.5 text-xs">
                  {task.due_at && (
                    <span className={cn(overdue && "font-medium text-red-600")}>
                      {overdue ? "Overdue · " : "Due "}
                      {formatDate(task.due_at)}
                    </span>
                  )}
                  {count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {count}
                    </span>
                  )}
                </div>
              </button>

              {task.event && (
                <Link
                  href={`/events/${task.event.slug}`}
                  className="muted mt-0.5 max-w-24 shrink-0 truncate text-xs hover:text-pink-500"
                  title={task.event.name}
                >
                  {task.event.name}
                </Link>
              )}
            </div>
          );
        })}
      </Card>

      <TaskDetailSheet
        task={detail}
        team={team}
        currentUserId={currentUserId}
        canEdit
        onClose={() => setDetail(null)}
      />
    </>
  );
}
