"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { invalidate } from "@/lib/reference-data";
import { toE164 } from "@/lib/utils";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function updateProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Your name can't be empty." };

  const rawPhone = String(formData.get("phone") ?? "").trim();
  // Store E.164 so the reminder engine can dial it without re-parsing.
  const phone = rawPhone ? toE164(rawPhone) : null;
  if (rawPhone && !phone) {
    return { error: "That phone number doesn't look right. Use a 10-digit mobile number." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      job_title: String(formData.get("job_title") ?? "").trim() || null,
      primary_department_id: String(formData.get("primary_department_id") ?? "") || null,
      whatsapp_opt_in: formData.get("whatsapp_opt_in") === "on",
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  invalidate("team");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
