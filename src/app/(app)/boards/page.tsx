import { Kanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Progress } from "@/components/ui/misc";
import type { Board } from "@/lib/types";
import { BoardActions } from "./board-actions";

export const metadata = { title: "Boards" };

export default async function BoardsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: boards }, { data: departments }] = await Promise.all([
    supabase
      .from("boards")
      .select("*, department:departments(name, color)")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const list = (boards ?? []) as unknown as (Board & {
    department: { name: string; color: string } | null;
  })[];

  const { data: taskRows } = await supabase
    .from("tasks")
    .select("board_id, status")
    .not("board_id", "is", null);

  const stats = new Map<string, { done: number; total: number }>();
  for (const row of taskRows ?? []) {
    if (!row.board_id || row.status === "cancelled") continue;
    const entry = stats.get(row.board_id) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (row.status === "done") entry.done += 1;
    stats.set(row.board_id, entry);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Boards</h1>
        {isManager(user) && (
          <BoardActions
            departments={departments ?? []}
            defaultDepartmentId={user.primary_department_id}
          />
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Kanban className="size-6" />}
            title="No boards yet"
            description="Boards hold ad-hoc work that isn't tied to an event — like a Trello board for your department."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((board) => {
            const s = stats.get(board.id) ?? { done: 0, total: 0 };
            return (
              <a key={board.id} href={`/boards/${board.id}`}>
                <Card className="h-full p-4 transition hover:border-pink-300">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: board.department?.color ?? "#EF3A5D" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{board.name}</p>
                      {board.description && (
                        <p className="muted mt-1 text-xs leading-snug">{board.description}</p>
                      )}
                      <p className="muted mt-2 text-xs">
                        {board.department?.name ?? "No department"} · {s.total} tasks
                      </p>
                      {s.total > 0 && (
                        <div className="mt-2.5">
                          <Progress value={(s.done / s.total) * 100} />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
