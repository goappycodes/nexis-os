import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Team" };

const ROLE_STYLE = {
  super_admin: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-100",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  member: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100",
} as const;

export default async function TeamPage() {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*, department:departments!profiles_primary_department_id_fkey(name, color)")
    .eq("is_active", true)
    .order("role")
    .order("full_name");

  const people = (data ?? []) as unknown as (Profile & {
    department: { name: string; color: string } | null;
  })[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="muted mt-1 text-sm">
          {people.length} {people.length === 1 ? "person" : "people"} on Nexis OS
        </p>
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-6" />} title="No one here yet" />
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-3 p-4">
              <Avatar
                name={person.full_name || person.email}
                src={person.avatar_url}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">
                  {person.full_name || person.email}
                </p>
                <p className="muted truncate text-xs">
                  {person.job_title ? `${person.job_title} · ` : ""}
                  {person.email}
                </p>
                {person.department && (
                  <p className="muted mt-0.5 text-xs">{person.department.name}</p>
                )}
              </div>
              <Badge className={ROLE_STYLE[person.role]}>{ROLE_LABEL[person.role]}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
