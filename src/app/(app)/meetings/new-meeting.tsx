"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createMeeting } from "./actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/misc";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type TeamMember = Pick<Profile, "id" | "full_name" | "email" | "avatar_url" | "role"> & {
  primary_department_id: string | null;
};

export function NewMeeting({
  departments,
  team,
  events,
  defaultDepartmentId,
}: {
  departments: { id: string; name: string }[];
  team: TeamMember[];
  events: { id: string; name: string }[];
  defaultDepartmentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createMeeting(undefined, formData);
      // On success createMeeting redirects, so anything returned is a failure.
      if (result?.error) toast.error(result.error);
    });
  }

  const filtered = team.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  /** Invite a whole department in one tap — the common case. */
  function toggleDepartment(departmentId: string) {
    const ids = team.filter((m) => m.primary_department_id === departmentId).map((m) => m.id);
    const allIn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allIn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New
      </Button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Log a meeting">
          <form action={submit} className="space-y-4">
            {selected.map((id) => (
              <input key={id} type="hidden" name="attendees" value={id} />
            ))}

            <Field label="What is the meeting about?" required>
              <Input name="title" required autoFocus placeholder="e.g. Marketing weekly review" />
            </Field>

            <Field label="Agenda" hint="What needs to be covered. Attendees see this up front.">
              <Textarea name="agenda" rows={3} placeholder="1. Round 5 numbers&#10;2. Open House creative sign-off" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" required>
                <Input name="starts_at" type="datetime-local" required />
              </Field>
              <Field label="Ends">
                <Input name="ends_at" type="datetime-local" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Where">
                <Input name="location" placeholder="e.g. Apex Hall" />
              </Field>
              <Field label="Video link">
                <Input name="meeting_link" type="url" placeholder="https://meet.google.com/…" />
              </Field>
            </div>

            {/* Attendees */}
            <div>
              <p className="mb-1.5 block text-sm font-medium">
                Who should be there
                {selected.length > 0 && (
                  <span className="muted ml-1.5 font-normal">{selected.length} selected</span>
                )}
              </p>

              <div className="mb-2 flex flex-wrap gap-1.5">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDepartment(d.id)}
                    className="surface rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:border-pink-300"
                  >
                    + {d.name}
                  </button>
                ))}
              </div>

              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the team…"
                  className="h-10 min-h-10 pl-10"
                  type="search"
                />
              </div>

              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-1">
                {filtered.map((member) => {
                  const isSelected = selected.includes(member.id);
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((prev) =>
                            isSelected ? prev.filter((id) => id !== member.id) : [...prev, member.id]
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
                          isSelected ? "bg-pink-50 dark:bg-pink-900/20" : "hover:bg-[var(--surface-sunken)]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border-2 transition",
                            isSelected
                              ? "border-pink-500 bg-pink-500"
                              : "border-[var(--border-subtle)]"
                          )}
                        >
                          {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                        <Avatar
                          name={member.full_name || member.email}
                          src={member.avatar_url}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {member.full_name || member.email}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="muted px-2 py-3 text-center text-xs">No one matches that.</li>
                )}
              </ul>
              <p className="muted mt-1.5 text-xs">
                Everyone selected gets a WhatsApp invitation immediately.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <Select name="department_id" defaultValue={defaultDepartmentId ?? ""}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Related event">
                <Select name="event_id" defaultValue="">
                  <option value="">None</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Button type="submit" block loading={pending} className="mt-2">
              {pending ? "Creating…" : "Create and invite"}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
