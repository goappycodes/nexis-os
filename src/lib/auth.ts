import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Department, Profile } from "@/lib/types";

export type SessionUser = Profile & {
  department: Department | null;
  /** Departments where this user carries manager rights. */
  managedDepartmentIds: string[];
};

/**
 * The signed-in user's profile, or null. Use in layouts/pages that render for
 * both states; use requireUser() when a session is mandatory.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, department:departments!profiles_primary_department_id_fkey(*)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("department_members")
    .select("department_id, is_manager")
    .eq("user_id", user.id);

  return {
    ...(profile as unknown as Profile),
    department: (profile as unknown as { department: Department | null }).department ?? null,
    managedDepartmentIds: (memberships ?? [])
      .filter((m) => m.is_manager)
      .map((m) => m.department_id),
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.is_active) redirect("/login?error=deactivated");
  return user;
}

/** Org-wide manager, or manager of at least one department. */
export function isManager(user: SessionUser) {
  return (
    user.role === "super_admin" ||
    user.role === "manager" ||
    user.managedDepartmentIds.length > 0
  );
}

export function isSuperAdmin(user: SessionUser) {
  return user.role === "super_admin";
}

/** Can this user approve work belonging to `departmentId`? */
export function canApprove(user: SessionUser, departmentId: string | null) {
  if (user.role === "super_admin" || user.role === "manager") return true;
  if (!departmentId) return false;
  return user.managedDepartmentIds.includes(departmentId);
}

export async function requireManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isManager(user)) redirect("/?error=forbidden");
  return user;
}
