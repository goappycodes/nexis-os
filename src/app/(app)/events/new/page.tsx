import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDepartments, getPlaybooks } from "@/lib/reference-data";
import { NewEventForm } from "./new-event-form";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  const user = await requireUser();
  // Both cached: this page costs no database round trips once warm.
  const [departments, playbooks] = await Promise.all([getDepartments(), getPlaybooks()]);

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
        departments={departments}
        playbooks={playbooks}
        defaultDepartmentId={user.primary_department_id}
      />
    </div>
  );
}
