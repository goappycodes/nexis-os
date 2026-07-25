"use client";

import { useActionState, useState } from "react";
import { Check, ListChecks } from "lucide-react";
import { createEvent, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Playbook = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  steps: number;
};

export function NewEventForm({
  departments,
  playbooks,
  defaultDepartmentId,
}: {
  departments: { id: string; name: string }[];
  playbooks: Playbook[];
  defaultDepartmentId: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createEvent, undefined);
  const [playbookId, setPlaybookId] = useState<string>(
    playbooks.find((p) => p.is_default)?.id ?? ""
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="playbook_id" value={playbookId} />

      <Card className="space-y-4 p-4 sm:p-5">
        <Field label="Event name" required>
          <Input name="name" required placeholder="e.g. Nexis Open House 2026" autoFocus />
        </Field>

        <Field label="Description" hint="What is this event for?">
          <Textarea name="description" rows={3} placeholder="A short brief for the team…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" required>
            <Input name="starts_at" type="datetime-local" required />
          </Field>
          <Field label="Ends">
            <Input name="ends_at" type="datetime-local" />
          </Field>
        </div>

        <Field label="Venue">
          <Input name="venue" placeholder="e.g. Apex Hall, Nexis Campus" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owning department">
            <Select name="department_id" defaultValue={defaultDepartmentId ?? ""}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected attendees">
            <Input name="expected_attendees" type="number" min="0" inputMode="numeric" placeholder="150" />
          </Field>
        </div>

        <Field label="Budget (₹)">
          <Input name="budget_amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="50000" />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-sunken)] p-3">
          <input
            type="checkbox"
            name="registration_enabled"
            className="mt-0.5 size-4 shrink-0 accent-pink-500"
          />
          <span className="text-sm">
            <span className="font-medium">Collect registrations</span>
            <span className="muted block text-xs">
              Opens a public registration form for this event.
            </span>
          </span>
        </label>
      </Card>

      {playbooks.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Playbook</p>
          <p className="muted mb-3 text-xs">
            The preset formula. Every step becomes a task, dated relative to the event.
          </p>

          <div className="space-y-2">
            {playbooks.map((p) => {
              const selected = playbookId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlaybookId(selected ? "" : p.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20"
                      : "surface hover:border-pink-300"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                      selected ? "border-pink-500 bg-pink-500" : "border-[var(--border-subtle)]"
                    )}
                  >
                    {selected && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}</span>
                    {p.description && (
                      <span className="muted mt-0.5 block text-xs">{p.description}</span>
                    )}
                    <span className="muted mt-1.5 inline-flex items-center gap-1 text-xs font-medium">
                      <ListChecks className="size-3.5" />
                      {p.steps} steps
                    </span>
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPlaybookId("")}
              aria-pressed={playbookId === ""}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition",
                playbookId === ""
                  ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20"
                  : "surface hover:border-pink-300"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                  playbookId === "" ? "border-pink-500 bg-pink-500" : "border-[var(--border-subtle)]"
                )}
              >
                {playbookId === "" && <Check className="size-3 text-white" strokeWidth={3} />}
              </span>
              <span className="text-sm font-medium">Start empty — I&apos;ll add tasks myself</span>
            </button>
          </div>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}

      <div className="sticky bottom-20 lg:bottom-4">
        <Button type="submit" size="lg" block loading={pending}>
          {pending ? "Creating…" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
