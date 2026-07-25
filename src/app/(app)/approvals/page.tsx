import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { ApprovalRequest, Creative, Expense, Profile, Script } from "@/lib/types";
import { ApprovalCard } from "./approval-card";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "mine" } = await searchParams;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterLink label="For me" value="mine" active={filter} />
        <FilterLink label="All pending" value="pending" active={filter} />
        <FilterLink label="My submissions" value="submitted" active={filter} />
        <FilterLink label="Decided" value="decided" active={filter} />
      </div>

      <ApprovalList filter={filter} />
    </div>
  );
}

function FilterLink({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: string;
}) {
  const isActive = active === value;
  return (
    <a
      href={`/approvals?filter=${value}`}
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

async function ApprovalList({ filter }: { filter: string }) {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("approval_requests")
    .select(
      "*, requester:profiles!approval_requests_requested_by_fkey(id, full_name, email, avatar_url), " +
        "reviewer:profiles!approval_requests_assigned_to_fkey(id, full_name, email, avatar_url), " +
        "department:departments(id, name, color)"
    );

  if (filter === "mine") {
    query = query.eq("assigned_to", user.id).eq("status", "pending");
  } else if (filter === "pending") {
    query = query.eq("status", "pending");
  } else if (filter === "submitted") {
    query = query.eq("requested_by", user.id);
  } else {
    query = query.neq("status", "pending");
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(60);

  const requests = (data ?? []) as unknown as (ApprovalRequest & {
    requester: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    reviewer: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    department: { id: string; name: string; color: string } | null;
  })[];

  if (requests.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title={
            filter === "mine"
              ? "Nothing waiting on you"
              : filter === "submitted"
                ? "You haven't submitted anything"
                : "Nothing here yet"
          }
          description={
            filter === "mine"
              ? "When a teammate sends a creative or script for approval, it lands here."
              : "Creatives and scripts sent for approval show up in this list."
          }
        />
      </Card>
    );
  }

  // Pull the underlying entities in batched queries rather than per row.
  const idsOf = (type: string) =>
    requests.filter((r) => r.entity_type === type).map((r) => r.entity_id);

  const creativeIds = idsOf("creative");
  const scriptIds = idsOf("script");
  const expenseIds = idsOf("expense");

  const [{ data: creatives }, { data: scripts }, { data: expenses }] = await Promise.all([
    creativeIds.length
      ? supabase.from("creatives").select("*").in("id", creativeIds)
      : Promise.resolve({ data: [] as Creative[] }),
    scriptIds.length
      ? supabase.from("scripts").select("*").in("id", scriptIds)
      : Promise.resolve({ data: [] as Script[] }),
    expenseIds.length
      ? supabase.from("expenses").select("*").in("id", expenseIds)
      : Promise.resolve({ data: [] as Expense[] }),
  ]);

  const creativeMap = new Map((creatives ?? []).map((c) => [c.id, c as Creative]));
  const scriptMap = new Map((scripts ?? []).map((s) => [s.id, s as Script]));
  const expenseMap = new Map((expenses ?? []).map((e) => [e.id, e as Expense]));

  const canDecide = isManager(user);

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <ApprovalCard
          key={request.id}
          request={request}
          creative={creativeMap.get(request.entity_id) ?? null}
          script={scriptMap.get(request.entity_id) ?? null}
          expense={expenseMap.get(request.entity_id) ?? null}
          canDecide={canDecide && request.status === "pending"}
          isOwnSubmission={request.requested_by === user.id}
        />
      ))}
    </div>
  );
}
