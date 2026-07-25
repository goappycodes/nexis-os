import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { NavIcon } from "@/components/shell/nav-icon";
import { WORK_CATEGORY } from "@/lib/constants";
import type { EventPlaybook, EventPlaybookItem, WorkCategory } from "@/lib/types";

export const metadata = { title: "Event playbooks" };

export default async function PlaybooksPage() {
  const user = await requireUser();
  if (!isManager(user)) redirect("/");

  const supabase = await createClient();

  const [{ data: playbooks }, { data: items }] = await Promise.all([
    supabase.from("event_playbooks").select("*").order("name"),
    supabase.from("event_playbook_items").select("*").order("sort_order"),
  ]);

  const list = (playbooks ?? []) as EventPlaybook[];
  const allItems = (items ?? []) as EventPlaybookItem[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Event playbooks</h1>
        <p className="muted mt-1 text-sm">
          The preset formula behind every event. Each step becomes a task, dated
          relative to the event.
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="size-6" />} title="No playbooks yet" />
        </Card>
      ) : (
        list.map((playbook) => {
          const own = allItems.filter((i) => i.playbook_id === playbook.id);

          // Group by category, ordered by how early the first step falls.
          const grouped = new Map<WorkCategory, EventPlaybookItem[]>();
          for (const item of own) {
            grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
          }
          const ordered = [...grouped.entries()].sort(
            ([, a], [, b]) =>
              Math.min(...a.map((i) => i.offset_days)) -
              Math.min(...b.map((i) => i.offset_days))
          );

          return (
            <div key={playbook.id} className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{playbook.name}</p>
                    {playbook.description && (
                      <p className="muted mt-1 text-sm">{playbook.description}</p>
                    )}
                  </div>
                  {playbook.is_default && (
                    <span className="shrink-0 rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-700 dark:bg-pink-900 dark:text-pink-100">
                      Default
                    </span>
                  )}
                </div>
                <p className="muted mt-2 text-xs">{own.length} steps</p>
              </Card>

              {ordered.map(([category, categoryItems]) => (
                <Card key={category} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-900/30">
                      <NavIcon name={WORK_CATEGORY[category].icon} className="size-4" />
                    </span>
                    <p className="text-sm font-semibold">{WORK_CATEGORY[category].label}</p>
                  </div>

                  <ul className="divide-y border-t">
                    {categoryItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="muted w-16 shrink-0 pt-0.5 text-xs tabular-nums">
                          {item.offset_days === 0
                            ? "Event day"
                            : item.offset_days < 0
                              ? `${Math.abs(item.offset_days)}d before`
                              : `${item.offset_days}d after`}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug">{item.title}</span>
                          {item.description && (
                            <span className="muted mt-0.5 block text-xs leading-snug">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
