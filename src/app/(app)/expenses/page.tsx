import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatMoney } from "@/lib/utils";
import type { Expense, Profile } from "@/lib/types";
import { ExpenseActions } from "./expense-actions";
import { ExpenseList } from "./expense-list";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: departments }, { data: team }, { data: events }, { data: campaigns }] =
    await Promise.all([
      supabase.from("departments").select("id, name").eq("is_active", true).order("sort_order"),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("events").select("id, name").order("starts_at", { ascending: false }).limit(40),
      supabase
        .from("marketing_campaigns")
        .select("id, name")
        .order("month", { ascending: false })
        .limit(40),
    ]);

  const approvers = (team ?? []).filter(
    (p) => p.role === "super_admin" || p.role === "manager"
  ) as unknown as Pick<Profile, "id" | "full_name" | "email">[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <ExpenseActions
          departments={departments ?? []}
          approvers={approvers}
          events={(events ?? []) as { id: string; name: string }[]}
          campaigns={(campaigns ?? []) as { id: string; name: string }[]}
          defaultDepartmentId={user.primary_department_id}
        />
      </div>

      <ExpenseSummary />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterLink label="All" value="all" active={filter} />
        <FilterLink label="Mine" value="mine" active={filter} />
        <FilterLink label="Awaiting approval" value="pending" active={filter} />
        <FilterLink label="Approved" value="approved" active={filter} />
        <FilterLink label="Paid" value="paid" active={filter} />
      </div>

      <Expenses filter={filter} />
    </div>
  );
}

function FilterLink({ label, value, active }: { label: string; value: string; active: string }) {
  const isActive = active === value;
  return (
    <a
      href={`/expenses?filter=${value}`}
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

/** Money at each stage of the pipeline — what Finance actually wants to see. */
async function ExpenseSummary() {
  const supabase = await createClient();

  // RLS already limits this to what the viewer is allowed to see, so the
  // totals are correct per role without extra filtering.
  const { data } = await supabase.from("expenses").select("amount, status");

  const rows = (data ?? []) as { amount: number; status: string }[];
  const sum = (status: string) =>
    rows.filter((r) => r.status === status).reduce((total, r) => total + Number(r.amount), 0);

  const stats = [
    { label: "Awaiting approval", value: sum("pending"), tone: "text-amber-600" },
    { label: "Approved, unpaid", value: sum("approved"), tone: "text-blue-600" },
    { label: "Paid", value: sum("paid"), tone: "" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-3.5">
          <p className={`text-lg font-semibold leading-none ${s.tone}`}>
            {formatMoney(s.value)}
          </p>
          <p className="muted mt-1.5 text-xs leading-tight">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}

async function Expenses({ filter }: { filter: string }) {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      "*, requester:profiles!expenses_requested_by_fkey(id, full_name, email, avatar_url), " +
        "department:departments(id, name, color), event:events(id, name)"
    );

  if (filter === "mine") query = query.eq("requested_by", user.id);
  else if (filter === "pending") query = query.eq("status", "pending");
  else if (filter === "approved") query = query.eq("status", "approved");
  else if (filter === "paid") query = query.eq("status", "paid");

  const { data } = await query.order("created_at", { ascending: false }).limit(80);

  const expenses = (data ?? []) as unknown as (Expense & {
    requester: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    department: { id: string; name: string; color: string } | null;
    event: { id: string; name: string } | null;
  })[];

  if (expenses.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No expenses here"
          description="Raise a claim or a vendor payment request and it goes straight to the right approver."
        />
      </Card>
    );
  }

  return (
    <ExpenseList
      expenses={expenses}
      currentUserId={user.id}
      canSettle={isManager(user)}
    />
  );
}
