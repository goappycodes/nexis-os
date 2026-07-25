import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, canApprove } from "@/lib/auth";
import type { Board, BoardColumn, Profile, Task } from "@/lib/types";
import { BoardView } from "./board-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("boards").select("name").eq("id", id).single();
  return { title: data?.name ?? "Board" };
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("boards")
    .select("*, department:departments(id, name, color)")
    .eq("id", id)
    .single();

  if (!board) notFound();

  const typed = board as unknown as Board & {
    department: { id: string; name: string; color: string } | null;
  };

  const [{ data: columns }, { data: tasks }, { data: team }] = await Promise.all([
    supabase.from("board_columns").select("*").eq("board_id", id).order("sort_order"),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url, email)")
      .eq("board_id", id)
      .order("sort_order"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const boardTasks = (tasks ?? []) as unknown as (Task & {
    assignee: Pick<Profile, "id" | "full_name" | "avatar_url" | "email"> | null;
  })[];

  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", boardTasks.map((t) => t.id));

  const commentCounts: Record<string, number> = {};
  for (const row of commentRows ?? []) {
    commentCounts[row.task_id] = (commentCounts[row.task_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <Link
        href="/boards"
        className="muted inline-flex items-center gap-1.5 text-sm hover:text-[var(--text-strong)]"
      >
        <ArrowLeft className="size-4" />
        Boards
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{typed.name}</h1>
        {typed.description && <p className="muted mt-1 text-sm">{typed.description}</p>}
      </div>

      <BoardView
        boardId={typed.id}
        columns={(columns ?? []) as BoardColumn[]}
        tasks={boardTasks}
        team={(team ?? []) as unknown as Pick<Profile, "id" | "full_name" | "avatar_url" | "email">[]}
        departmentId={typed.department?.id ?? null}
        currentUserId={user.id}
        commentCounts={commentCounts}
        canManage={canApprove(user, typed.department?.id ?? null) || typed.created_by === user.id}
      />
    </div>
  );
}
