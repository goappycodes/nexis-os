import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { NavIcon } from "@/components/shell/nav-icon";
import type { Department } from "@/lib/types";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("departments")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  const departments = (data ?? []) as Department[];

  // Head counts and open-work counts in two queries rather than 2N.
  const [{ data: members }, { data: openTasks }] = await Promise.all([
    supabase.from("profiles").select("primary_department_id").eq("is_active", true),
    supabase.from("tasks").select("department_id").not("status", "in", "(done,cancelled)"),
  ]);

  const headcount = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.primary_department_id) {
      headcount.set(m.primary_department_id, (headcount.get(m.primary_department_id) ?? 0) + 1);
    }
  }

  const workload = new Map<string, number>();
  for (const t of openTasks ?? []) {
    if (t.department_id) {
      workload.set(t.department_id, (workload.get(t.department_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {departments.map((dept) => (
          <Card key={dept.id} className="p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: dept.color }}
              >
                <NavIcon name={dept.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{dept.name}</p>
                {dept.description && (
                  <p className="muted mt-1 text-xs leading-snug">{dept.description}</p>
                )}
                <p className="muted mt-2 text-xs">
                  {headcount.get(dept.id) ?? 0} people · {workload.get(dept.id) ?? 0} open tasks
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
