"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserActive, updateUserDepartment, updateUserRole } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Select } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppRole, Department, Profile } from "@/lib/types";

const ROLE_STYLE: Record<AppRole, string> = {
  super_admin: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-100",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  member: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100",
};

export function PeopleManager({
  people,
  departments,
  currentUserId,
}: {
  people: Profile[];
  departments: Department[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pending, startTransition] = useTransition();

  const deptName = (id: string | null) =>
    departments.find((d) => d.id === id)?.name ?? "No department";

  function save(formData: FormData) {
    if (!editing) return;
    const role = String(formData.get("role") ?? "member") as AppRole;
    const departmentId = String(formData.get("department_id") ?? "") || null;

    startTransition(async () => {
      if (role !== editing.role) {
        const result = await updateUserRole(editing.id, role);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
      }
      if (departmentId !== editing.primary_department_id) {
        const result = await updateUserDepartment(editing.id, departmentId);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Updated");
      setEditing(null);
    });
  }

  function toggleActive(person: Profile) {
    startTransition(async () => {
      const result = await setUserActive(person.id, !person.is_active);
      if (result?.error) toast.error(result.error);
      else toast.success(person.is_active ? "Deactivated" : "Reactivated");
    });
  }

  return (
    <>
      <Card className="divide-y overflow-hidden">
        {people.map((person) => (
          <div
            key={person.id}
            className={cn("flex items-center gap-3 p-4", !person.is_active && "opacity-55")}
          >
            <Avatar name={person.full_name || person.email} src={person.avatar_url} size="md" />

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight">
                {person.full_name || person.email}
                {person.id === currentUserId && (
                  <span className="muted ml-1.5 text-xs font-normal">you</span>
                )}
              </p>
              <p className="muted truncate text-xs">{person.email}</p>
              <p className="muted mt-0.5 text-xs">
                {deptName(person.primary_department_id)}
                {!person.is_active && " · deactivated"}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge className={ROLE_STYLE[person.role]}>{ROLE_LABEL[person.role]}</Badge>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(person)}
                  className="text-xs font-medium text-pink-500 hover:underline"
                >
                  Edit
                </button>
                {person.id !== currentUserId && (
                  <>
                    <span className="muted text-xs" aria-hidden>
                      ·
                    </span>
                    <button
                      onClick={() => toggleActive(person)}
                      disabled={pending}
                      className="muted text-xs font-medium hover:underline"
                    >
                      {person.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit access"
        description={editing?.full_name || editing?.email}
      >
        {editing && (
          <form action={save} className="space-y-4">
            <Field
              label="Role"
              hint="Super admins manage people and settings. Managers approve work and assign tasks."
            >
              <Select name="role" defaultValue={editing.role}>
                <option value="member">Team member</option>
                <option value="manager">Manager</option>
                <option value="super_admin">Super admin</option>
              </Select>
            </Field>

            <Field label="Primary department">
              <Select name="department_id" defaultValue={editing.primary_department_id ?? ""}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" block loading={pending} className="mt-2">
              Save
            </Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
