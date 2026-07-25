"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { submitForApproval } from "../approvals/actions";
import { formatMoney } from "@/lib/utils";
import type { ExpenseCategory } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/**
 * Raise an expense claim, optionally sending it straight into review.
 *
 * The receipt is uploaded from the browser to Storage first; only the path
 * arrives here.
 */
export async function createExpense(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!title) return { error: "Give the expense a title." };
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const departmentId = String(formData.get("department_id") ?? "") || null;
  const approverId = String(formData.get("approver_id") ?? "") || null;
  const submit = formData.get("submit_for_approval") === "on";

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      amount,
      category: (String(formData.get("category") ?? "other") || "other") as ExpenseCategory,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      expense_date: String(formData.get("expense_date") ?? "") || new Date().toISOString().slice(0, 10),
      is_reimbursement: formData.get("is_reimbursement") === "on",
      department_id: departmentId,
      event_id: String(formData.get("event_id") ?? "") || null,
      campaign_id: String(formData.get("campaign_id") ?? "") || null,
      receipt_path: String(formData.get("receipt_path") ?? "") || null,
      requested_by: user.id,
      approver_id: approverId,
      status: submit ? "pending" : "draft",
    })
    .select("id")
    .single();

  if (error || !expense) {
    return { error: error?.message ?? "Could not save the expense." };
  }

  if (submit) {
    const result = await submitForApproval({
      entityType: "expense",
      entityId: expense.id,
      title: `${title} — ${formatMoney(amount)}`,
      departmentId,
      assignedTo: approverId,
    });
    if (result?.error) return result;
  }

  revalidatePath("/expenses");
  revalidatePath("/approvals");
  return { ok: true };
}

/** Push a draft, or something sent back for changes, into review. */
export async function submitExpense(expenseId: string): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("id, title, amount, department_id, approver_id, requested_by, status")
    .eq("id", expenseId)
    .single();

  if (!expense) return { error: "That expense no longer exists." };
  if (expense.requested_by !== user.id) return { error: "This isn't your claim to submit." };
  if (expense.status === "pending") return { error: "It is already under review." };

  const { error } = await supabase
    .from("expenses")
    .update({ status: "pending" })
    .eq("id", expenseId);

  if (error) return { error: error.message };

  const result = await submitForApproval({
    entityType: "expense",
    entityId: expense.id,
    title: `${expense.title} — ${formatMoney(expense.amount)}`,
    departmentId: expense.department_id,
    assignedTo: expense.approver_id,
  });
  if (result?.error) return result;

  revalidatePath("/expenses");
  revalidatePath("/approvals");
  return { ok: true };
}

/**
 * Mark an approved expense as settled. Finance-only, and deliberately
 * separate from approval: approving is agreeing to spend, paying is the money
 * actually leaving.
 */
export async function markExpensePaid(
  expenseId: string,
  method: string,
  reference: string
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("status, requested_by, title, amount")
    .eq("id", expenseId)
    .single();

  if (!expense) return { error: "That expense no longer exists." };
  if (expense.status !== "approved") {
    return { error: "Only an approved expense can be marked paid." };
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: user.id,
      payment_method: method || null,
      payment_ref: reference || null,
    })
    .eq("id", expenseId);

  // RLS blocks anyone who isn't Finance or a manager of the department.
  if (error) return { error: "You don't have permission to settle expenses." };

  if (expense.requested_by) {
    await supabase.from("notifications").insert({
      user_id: expense.requested_by,
      title: "Expense paid",
      body: `${expense.title} — ${formatMoney(expense.amount)} has been settled.`,
      url: "/expenses",
      entity_type: "expense",
      entity_id: expenseId,
    });
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { error: "Only a draft you raised can be deleted." };

  revalidatePath("/expenses");
  return { ok: true };
}
