"use client";

import { useEffect, useState, useTransition } from "react";
import { Banknote, FileText, Receipt, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deleteExpense, markExpensePaid, submitExpense } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { EXPENSE_CATEGORY, EXPENSE_STATUS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Expense, Profile } from "@/lib/types";

type ExpenseRow = Expense & {
  requester: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
  department: { id: string; name: string; color: string } | null;
  event: { id: string; name: string } | null;
};

export function ExpenseList({
  expenses,
  currentUserId,
  canSettle,
}: {
  expenses: ExpenseRow[];
  currentUserId: string;
  canSettle: boolean;
}) {
  const [detail, setDetail] = useState<ExpenseRow | null>(null);
  const [settling, setSettling] = useState<ExpenseRow | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(expense: ExpenseRow) {
    startTransition(async () => {
      const result = await submitExpense(expense.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Sent for approval");
    });
  }

  function remove(expense: ExpenseRow) {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Deleted");
        setDetail(null);
      }
    });
  }

  function settle(formData: FormData) {
    if (!settling) return;
    startTransition(async () => {
      const result = await markExpensePaid(
        settling.id,
        String(formData.get("payment_method") ?? ""),
        String(formData.get("payment_ref") ?? "")
      );
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Marked as paid");
        setSettling(null);
      }
    });
  }

  return (
    <>
      <Card className="divide-y overflow-hidden">
        {expenses.map((expense) => {
          const meta = EXPENSE_STATUS[expense.status];
          const isOwn = expense.requested_by === currentUserId;

          return (
            <div key={expense.id} className="p-4">
              <button
                onClick={() => setDetail(expense)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-sunken)]">
                  <Receipt className="size-4 text-[var(--text-muted)]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{expense.title}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(expense.amount)}
                    </span>
                  </span>

                  <span className="muted mt-1 block truncate text-xs">
                    {EXPENSE_CATEGORY[expense.category]}
                    {expense.vendor ? ` · ${expense.vendor}` : ""}
                    {` · ${formatDate(expense.expense_date)}`}
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className={meta.className} dot={meta.dot}>
                      {meta.label}
                    </Badge>
                    {expense.requester && (
                      <span className="muted inline-flex items-center gap-1.5 text-xs">
                        <Avatar
                          name={expense.requester.full_name || expense.requester.email}
                          src={expense.requester.avatar_url}
                          size="xs"
                        />
                        {expense.requester.full_name || expense.requester.email}
                      </span>
                    )}
                  </span>
                </span>
              </button>

              {/* Inline actions for the two moves people make most. */}
              {(isOwn && (expense.status === "draft" || expense.status === "changes_requested")) ||
              (canSettle && expense.status === "approved") ? (
                <div className="mt-3 flex gap-2 pl-13">
                  {isOwn && (expense.status === "draft" || expense.status === "changes_requested") && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => submit(expense)}>
                      <Send className="size-3.5" />
                      Send for approval
                    </Button>
                  )}
                  {canSettle && expense.status === "approved" && (
                    <Button size="sm" variant="success" onClick={() => setSettling(expense)}>
                      <Banknote className="size-3.5" />
                      Mark paid
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>

      {detail && (
        <ExpenseDetail
          expense={detail}
          isOwn={detail.requested_by === currentUserId}
          pending={pending}
          onDelete={() => remove(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      <Sheet
        open={settling !== null}
        onClose={() => setSettling(null)}
        title="Mark as paid"
        description={settling ? `${settling.title} — ${formatMoney(settling.amount)}` : undefined}
      >
        <form action={settle} className="space-y-4">
          <Field label="Payment method">
            <Select name="payment_method" defaultValue="Bank transfer">
              {["Bank transfer", "UPI", "Cash", "Cheque", "Card"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Reference" hint="UTR, cheque number or transaction id.">
            <Input name="payment_ref" placeholder="e.g. UTR123456789" />
          </Field>

          <Button type="submit" block loading={pending} className="mt-2">
            Confirm payment
          </Button>
        </form>
      </Sheet>
    </>
  );
}

function ExpenseDetail({
  expense,
  isOwn,
  pending,
  onDelete,
  onClose,
}: {
  expense: ExpenseRow;
  isOwn: boolean;
  pending: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const meta = EXPENSE_STATUS[expense.status];

  useEffect(() => {
    if (!expense.receipt_path) return;
    let cancelled = false;

    createClient()
      .storage.from("receipts")
      .createSignedUrl(expense.receipt_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setReceiptUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [expense.receipt_path]);

  const isPdf = expense.receipt_path?.toLowerCase().endsWith(".pdf");

  return (
    <Sheet open onClose={onClose} title={expense.title}>
      <div className="space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
          <Badge className={meta.className} dot={meta.dot}>
            {meta.label}
          </Badge>
        </div>

        {expense.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{expense.description}</p>
        )}

        <dl className="divide-y rounded-xl border">
          <Row label="Category">{EXPENSE_CATEGORY[expense.category]}</Row>
          <Row label="Date">{formatDate(expense.expense_date)}</Row>
          {expense.vendor && <Row label="Vendor">{expense.vendor}</Row>}
          <Row label="Type">
            {expense.is_reimbursement ? "Reimbursement" : "Vendor payment"}
          </Row>
          {expense.department && <Row label="Department">{expense.department.name}</Row>}
          {expense.event && <Row label="Event">{expense.event.name}</Row>}
          {expense.requester && (
            <Row label="Raised by">
              {expense.requester.full_name || expense.requester.email}
            </Row>
          )}
          {expense.paid_at && (
            <>
              <Row label="Paid on">{formatDate(expense.paid_at)}</Row>
              {expense.payment_method && <Row label="Method">{expense.payment_method}</Row>}
              {expense.payment_ref && <Row label="Reference">{expense.payment_ref}</Row>}
            </>
          )}
        </dl>

        {expense.receipt_path && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Receipt
            </p>
            {receiptUrl ? (
              isPdf ? (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface flex items-center gap-3 rounded-xl p-3 hover:border-pink-300"
                >
                  <FileText className="size-5 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium">Open receipt (PDF)</span>
                </a>
              ) : (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt="Receipt"
                    className="w-full rounded-xl border object-contain"
                  />
                </a>
              )
            ) : (
              <div className="skeleton h-40 rounded-xl" />
            )}
          </div>
        )}

        {isOwn && expense.status === "draft" && (
          <Button variant="outline" block loading={pending} onClick={onDelete} className="text-red-600">
            <Trash2 className="size-4" />
            Delete draft
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <dt className="muted shrink-0 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{children}</dd>
    </div>
  );
}
