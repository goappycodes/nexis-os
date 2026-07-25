import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import type { Profile, Task } from "@/lib/types";
import { MyWorkList } from "./my-work-list";

export const metadata = { title: "My work" };

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "open" } = await searchParams;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">My work</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterLink label="Open" value="open" active={filter} />
        <FilterLink label="Overdue" value="overdue" active={filter} />
        <FilterLink label="This week" value="week" active={filter} />
        <FilterLink label="Done" value="done" active={filter} />
      </div>

      <Suspense key={filter} fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <WorkList filter={filter} />
      </Suspense>
    </div>
  );
}

function FilterLink({ label, value, active }: { label: string; value: string; active: string }) {
  const isActive = active === value;
  return (
    <a
      href={`/my-work?filter=${value}`}
      className={
        isActive
          ? "shrink-0 rounded-full bg-ink-800 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-800"
          : "surface shrink-0 rounded-full px-4 py-2 text-xs font-medium hover:border-pink-300"
      }
    >
      {label}
    </a>
  );
}

async function WorkList({ filter }: { filter: string }) {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, email), event:events(id, name, slug)"
    )
    .eq("assignee_id", user.id);

  const now = new Date().toISOString();

  if (filter === "done") {
    query = query.eq("status", "done").order("completed_at", { ascending: false });
  } else if (filter === "overdue") {
    query = query
      .not("status", "in", "(done,cancelled)")
      .lt("due_at", now)
      .order("due_at", { ascending: true });
  } else if (filter === "week") {
    const weekOut = new Date(Date.now() + 7 * 86_400_000).toISOString();
    query = query
      .not("status", "in", "(done,cancelled)")
      .gte("due_at", now)
      .lte("due_at", weekOut)
      .order("due_at", { ascending: true });
  } else {
    query = query
      .not("status", "in", "(done,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false });
  }

  const [{ data }, { data: team }] = await Promise.all([
    query.limit(100),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const tasks = (data ?? []) as unknown as (Task & {
    assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
    event: { id: string; name: string; slug: string } | null;
  })[];

  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title={
            filter === "overdue"
              ? "Nothing overdue"
              : filter === "done"
                ? "Nothing completed yet"
                : "Nothing on your plate"
          }
          description={
            filter === "overdue"
              ? "You're on top of your deadlines."
              : "Tasks assigned to you will show up here."
          }
        />
      </Card>
    );
  }

  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", tasks.map((t) => t.id));

  const commentCounts: Record<string, number> = {};
  for (const row of commentRows ?? []) {
    commentCounts[row.task_id] = (commentCounts[row.task_id] ?? 0) + 1;
  }

  return (
    <MyWorkList
      tasks={tasks}
      team={(team ?? []) as unknown as Pick<Profile, "id" | "full_name" | "avatar_url" | "email">[]}
      currentUserId={user.id}
      commentCounts={commentCounts}
    />
  );
}
