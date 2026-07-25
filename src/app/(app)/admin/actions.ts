"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { invalidate } from "@/lib/reference-data";
import type { AppRole } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function updateUserRole(userId: string, role: AppRole): Promise<ActionState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) return { error: "Only a super admin can change roles." };

  // Guard against the last super admin demoting themselves and locking
  // everyone out of user management.
  if (userId === user.id && role !== "super_admin") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return { error: "You are the only super admin. Promote someone else first." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  invalidate("team");
  revalidatePath("/admin/people");
  revalidatePath("/team");
  return { ok: true };
}

export async function updateUserDepartment(
  userId: string,
  departmentId: string | null
): Promise<ActionState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) return { error: "Only a super admin can reassign departments." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ primary_department_id: departmentId })
    .eq("id", userId);

  if (error) return { error: error.message };

  invalidate("team");
  revalidatePath("/admin/people");
  revalidatePath("/team");
  return { ok: true };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) return { error: "Only a super admin can deactivate people." };
  if (userId === user.id) return { error: "You can't deactivate your own account." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { error: error.message };

  invalidate("team");
  revalidatePath("/admin/people");
  revalidatePath("/team");
  return { ok: true };
}

/** Grant or revoke manager rights over a single department. */
export async function setDepartmentManager(
  userId: string,
  departmentId: string,
  isManager: boolean
): Promise<ActionState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) return { error: "Only a super admin can assign department managers." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("department_members")
    .upsert(
      { user_id: userId, department_id: departmentId, is_manager: isManager },
      { onConflict: "department_id,user_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { ok: true };
}
