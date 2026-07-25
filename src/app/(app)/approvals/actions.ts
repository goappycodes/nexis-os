"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notifyNow, TEMPLATES } from "@/lib/messaging/reminders";
import type { ApprovalEntityType, ApprovalStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** Entity tables that carry their own mirrored `status` column. */
const ENTITY_TABLE: Partial<Record<ApprovalEntityType, "creatives" | "scripts">> = {
  creative: "creatives",
  script: "scripts",
};

/**
 * Raise an approval request and mark the underlying entity pending.
 *
 * The entity keeps its own status so lists can filter without joining, while
 * approval_requests holds the review trail.
 */
export async function submitForApproval({
  entityType,
  entityId,
  title,
  departmentId,
  assignedTo,
  note,
}: {
  entityType: ApprovalEntityType;
  entityId: string;
  title: string;
  departmentId: string | null;
  assignedTo: string | null;
  note?: string;
}): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  // Bump the version so a resubmission after "changes requested" is a new
  // round of review rather than an edit of the old one.
  const { data: previous } = await supabase
    .from("approval_requests")
    .select("version")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("version", { ascending: false })
    .limit(1);

  const version = (previous?.[0]?.version ?? 0) + 1;

  const { error } = await supabase.from("approval_requests").insert({
    entity_type: entityType,
    entity_id: entityId,
    title,
    department_id: departmentId,
    requested_by: user.id,
    assigned_to: assignedTo,
    status: "pending",
    version,
    note: note || null,
  });

  if (error) return { error: error.message };

  const table = ENTITY_TABLE[entityType];
  if (table) {
    await supabase.from(table).update({ status: "pending", version }).eq("id", entityId);
  }

  if (assignedTo) {
    await supabase.from("notifications").insert({
      user_id: assignedTo,
      title: "New approval request",
      body: title,
      url: "/approvals",
      entity_type: entityType,
      entity_id: entityId,
    });

    await notifyNow({
      userId: assignedTo,
      template: TEMPLATES.approvalPending,
      variables: [title, user.full_name || user.email, entityType],
      body: `${title} is waiting for your approval on Nexis OS.`,
      entityType,
      entityId,
    });
  }

  revalidatePath("/approvals");
  revalidatePath("/marketing");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Record a decision. Only approve / request changes / reject are valid here —
 * a reviewer cannot push something back to draft.
 */
export async function decideApproval(
  requestId: string,
  decision: Extract<ApprovalStatus, "approved" | "changes_requested" | "rejected">,
  comment?: string
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("approval_requests")
    .select("id, entity_type, entity_id, requested_by, title, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "That approval request no longer exists." };
  if (request.status !== "pending") {
    return { error: "This request has already been decided." };
  }

  const { error } = await supabase
    .from("approval_requests")
    .update({ status: decision, decided_by: user.id, decided_at: new Date().toISOString() })
    .eq("id", requestId);

  // RLS rejects the update when the user isn't an eligible reviewer.
  if (error) return { error: "You don't have permission to decide this request." };

  if (comment?.trim()) {
    await supabase.from("approval_comments").insert({
      request_id: requestId,
      author_id: user.id,
      body: comment.trim(),
      decision,
    });
  }

  const table = ENTITY_TABLE[request.entity_type as ApprovalEntityType];
  if (table) {
    await supabase.from(table).update({ status: decision }).eq("id", request.entity_id);
  }

  if (request.requested_by) {
    const label =
      decision === "approved"
        ? "approved"
        : decision === "rejected"
          ? "rejected"
          : "sent back for changes";

    await supabase.from("notifications").insert({
      user_id: request.requested_by,
      title: `Your submission was ${label}`,
      body: request.title,
      url: "/marketing",
      entity_type: request.entity_type,
      entity_id: request.entity_id,
    });

    await notifyNow({
      userId: request.requested_by,
      template: TEMPLATES.approvalDecision,
      variables: [
        request.title,
        decision === "changes_requested" ? "Changes requested" : label.replace(/^\w/, (c) => c.toUpperCase()),
        user.full_name || user.email,
      ],
      body: `Your submission "${request.title}" was ${label}.`,
      entityType: request.entity_type,
      entityId: request.entity_id,
    });
  }

  await supabase.from("activity_log").insert({
    actor_id: user.id,
    action: `approval.${decision}`,
    entity_type: request.entity_type,
    entity_id: request.entity_id,
    summary: `${decision.replace("_", " ")}: ${request.title}`,
  });

  revalidatePath("/approvals");
  revalidatePath("/marketing");
  revalidatePath("/");
  return { ok: true };
}

export async function addApprovalComment(
  requestId: string,
  body: string
): Promise<ActionState> {
  const user = await requireUser();
  if (!body.trim()) return { error: "Write something first." };

  const supabase = await createClient();
  const { error } = await supabase.from("approval_comments").insert({
    request_id: requestId,
    author_id: user.id,
    body: body.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath("/approvals");
  return { ok: true };
}
