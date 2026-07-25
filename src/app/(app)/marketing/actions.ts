"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { submitForApproval } from "../approvals/actions";
import type { CampaignStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function createCampaign(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const month = String(formData.get("month") ?? "");
  if (!name) return { error: "Give the campaign a name." };
  if (!month) return { error: "Pick the month this belongs to." };

  const channels = formData.getAll("channels").map(String).filter(Boolean);
  const budget = String(formData.get("budget_amount") ?? "");

  const { error } = await supabase.from("marketing_campaigns").insert({
    name,
    // The month input gives "2026-08"; store the first of that month.
    month: `${month}-01`,
    objective: String(formData.get("objective") ?? "").trim() || null,
    channels,
    department_id: String(formData.get("department_id") ?? "") || null,
    event_id: String(formData.get("event_id") ?? "") || null,
    owner_id: user.id,
    created_by: user.id,
    budget_amount: budget ? Number(budget) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "planned",
  });

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return { ok: true };
}

export async function updateCampaignStatus(campaignId: string, status: CampaignStatus) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ status })
    .eq("id", campaignId);

  if (error) return { error: error.message };
  revalidatePath("/marketing");
  return { ok: true };
}

/**
 * Register an uploaded creative and immediately raise it for approval.
 *
 * The file itself is uploaded straight from the browser to Supabase Storage so
 * it never passes through the server; we only record the resulting path.
 */
export async function createCreative(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the creative a title." };

  const departmentId = String(formData.get("department_id") ?? "") || null;
  const approverId = String(formData.get("approver_id") ?? "") || null;
  const submit = formData.get("submit_for_approval") === "on";

  const { data: creative, error } = await supabase
    .from("creatives")
    .insert({
      title,
      type: (String(formData.get("type") ?? "image") || "image") as never,
      channel: String(formData.get("channel") ?? "").trim() || null,
      caption: String(formData.get("caption") ?? "").trim() || null,
      file_path: String(formData.get("file_path") ?? "") || null,
      campaign_id: String(formData.get("campaign_id") ?? "") || null,
      event_id: String(formData.get("event_id") ?? "") || null,
      department_id: departmentId,
      created_by: user.id,
      status: submit ? "pending" : "draft",
    })
    .select("id")
    .single();

  if (error || !creative) return { error: error?.message ?? "Could not save the creative." };

  if (submit) {
    const result = await submitForApproval({
      entityType: "creative",
      entityId: creative.id,
      title,
      departmentId,
      assignedTo: approverId,
    });
    if (result?.error) return result;
  }

  revalidatePath("/marketing");
  return { ok: true };
}

export async function createScript(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Give the script a title." };
  if (!body) return { error: "The script is empty." };

  const departmentId = String(formData.get("department_id") ?? "") || null;
  const approverId = String(formData.get("approver_id") ?? "") || null;
  const submit = formData.get("submit_for_approval") === "on";

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      title,
      body,
      type: (String(formData.get("type") ?? "other") || "other") as never,
      campaign_id: String(formData.get("campaign_id") ?? "") || null,
      event_id: String(formData.get("event_id") ?? "") || null,
      department_id: departmentId,
      created_by: user.id,
      status: submit ? "pending" : "draft",
    })
    .select("id")
    .single();

  if (error || !script) return { error: error?.message ?? "Could not save the script." };

  if (submit) {
    const result = await submitForApproval({
      entityType: "script",
      entityId: script.id,
      title,
      departmentId,
      assignedTo: approverId,
    });
    if (result?.error) return result;
  }

  revalidatePath("/marketing");
  return { ok: true };
}

/** Push an existing draft (or a rejected item) into review. */
export async function resubmitForApproval(
  entityType: "creative" | "script",
  entityId: string,
  title: string,
  departmentId: string | null,
  approverId: string | null
) {
  return submitForApproval({ entityType, entityId, title, departmentId, assignedTo: approverId });
}

/** Signed URL for a private storage object. Expires in an hour. */
export async function getSignedUrl(path: string): Promise<string | null> {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase.storage.from("creatives").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteCampaign(campaignId: string) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("marketing_campaigns").delete().eq("id", campaignId);
  if (error) return { error: error.message };

  revalidatePath("/marketing");
  redirect("/marketing");
}
