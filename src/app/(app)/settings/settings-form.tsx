"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export function SettingsForm({
  profile,
  departments,
}: {
  profile: {
    full_name: string;
    phone: string | null;
    job_title: string | null;
    primary_department_id: string | null;
    whatsapp_opt_in: boolean;
  };
  departments: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfile,
    undefined
  );

  useEffect(() => {
    if (state?.ok) toast.success("Profile saved");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <Field label="Full name" required>
        <Input name="full_name" defaultValue={profile.full_name} required />
      </Field>

      <Field label="Job title">
        <Input name="job_title" defaultValue={profile.job_title ?? ""} placeholder="e.g. Marketing Manager" />
      </Field>

      <Field
        label="WhatsApp number"
        hint="Used for reminders. A 10-digit Indian mobile number is fine."
      >
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={profile.phone ?? ""}
          placeholder="9733127000"
        />
      </Field>

      <Field label="Primary department">
        <Select name="primary_department_id" defaultValue={profile.primary_department_id ?? ""}>
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-sunken)] p-3">
        <input
          type="checkbox"
          name="whatsapp_opt_in"
          defaultChecked={profile.whatsapp_opt_in}
          className="mt-0.5 size-4 shrink-0 accent-pink-500"
        />
        <span className="text-sm">
          <span className="font-medium">Send me WhatsApp reminders</span>
          <span className="muted block text-xs">
            Task deadlines, approvals waiting on you, and event countdowns.
          </span>
        </span>
      </label>

      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
