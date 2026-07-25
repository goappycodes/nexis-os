import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { NewEventForm } from "./new-event-form";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: departments }, { data: playbooks }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("event_playbooks").select("id, name, description, is_default").order("name"),
  ]);

  // Show the step count so the user knows what they're opting into.
  const { data: counts } = await supabase.from("event_playbook_items").select("playbook_id");
  const stepCounts = new Map<string, number>();
  for (const row of counts ?? []) {
    stepCounts.set(row.playbook_id, (stepCounts.get(row.playbook_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/events"
        className="muted inline-flex items-center gap-1.5 text-sm hover:text-[var(--text-strong)]"
      >
        <ArrowLeft className="size-4" />
        Events
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
        <p className="muted mt-1 text-sm">
          Pick a playbook and the full checklist is created for you, dated back from the event.
        </p>
      </div>

      <NewEventForm
        departments={departments ?? []}
        playbooks={(playbooks ?? []).map((p) => ({
          ...p,
          steps: stepCounts.get(p.id) ?? 0,
        }))}
        defaultDepartmentId={user.primary_department_id}
      />
    </div>
  );
}
