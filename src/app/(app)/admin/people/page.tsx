import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import type { Department, Profile } from "@/lib/types";
import { PeopleManager } from "./people-manager";

export const metadata = { title: "People & roles" };

export default async function AdminPeoplePage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/team");

  const supabase = await createClient();

  const [{ data: people }, { data: departments }] = await Promise.all([
    supabase.from("profiles").select("*").order("role").order("full_name"),
    supabase.from("departments").select("*").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People &amp; roles</h1>
        <p className="muted mt-1 text-sm">
          Change what people can do and which department they belong to.
        </p>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium">Adding someone new</p>
        <p className="muted mt-1 text-xs leading-relaxed">
          New accounts are created from the command line so a password is never
          emailed around:
        </p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-3 text-xs">
          node scripts/create-user.mjs their@email.com &quot;Their Name&quot; member 9733127000
        </code>
      </Card>

      <PeopleManager
        people={(people ?? []) as Profile[]}
        departments={(departments ?? []) as Department[]}
        currentUserId={user.id}
      />
    </div>
  );
}
