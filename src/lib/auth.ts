import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Department, Profile } from "@/lib/types";

export type SessionUser = Profile & {
  department: Department | null;
  /** Departments where this user carries manager rights. */
  managedDepartmentIds: string[];
  /** Approvals assigned to this user and still pending — drives the nav badge. */
  pendingApprovals: number;
};

type SessionBundle = {
  profile: Profile;
  department: Department | null;
  managed_department_ids: string[];
  pending_approvals: number;
};

/**
 * The signed-in user's profile, or null. Use in layouts/pages that render for
 * both states; use requireUser() when a session is mandatory.
 */
/**
 * One round trip for the whole session context.
 *
 * The middleware has already validated the JWT for this request, so we skip a
 * second auth.getUser() call and let the database resolve auth.uid() itself.
 * React's cache() then dedupes across the layout and the page, so a full page
 * render costs exactly one database call for session context.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("session_bundle");
  if (error || !data) return null;

  const bundle = data as unknown as SessionBundle;
  if (!bundle?.profile) return null;

  return {
    ...bundle.profile,
    department: bundle.department ?? null,
    managedDepartmentIds: bundle.managed_department_ids ?? [],
    pendingApprovals: Number(bundle.pending_approvals ?? 0),
  };
});

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
