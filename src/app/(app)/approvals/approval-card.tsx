"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, FileText, Image as ImageIcon, MessageSquare, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { decideApproval } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { APPROVAL_STATUS, EXPENSE_CATEGORY } from "@/lib/constants";
import { formatDate, formatMoney, relativeDay } from "@/lib/utils";
import type { ApprovalRequest, Creative, Expense, Profile, Script } from "@/lib/types";

type Request = ApprovalRequest & {
  requester: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
  reviewer: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
  department: { id: string; name: string; color: string } | null;
};

export function ApprovalCard({
  request,
  creative,
  script,
  expense,
  canDecide,
  isOwnSubmission,
}: {
  request: Request;
  creative: Creative | null;
  script: Script | null;
  expense: Expense | null;
  canDecide: boolean;
  isOwnSubmission: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  const meta = APPROVAL_STATUS[request.status];

  useEffect(() => {
    if (!creative?.file_path) return;
    let cancelled = false;

    createClient()
      .storage.from("creatives")
      .createSignedUrl(creative.file_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPreviewUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [creative?.file_path]);

  function decide(
    decision: "approved" | "changes_requested" | "rejected",
    comment?: string
  ) {
    startTransition(async () => {
      const result = await decideApproval(request.id, decision, comment);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(
          decision === "approved"
            ? "Approved"
            : decision === "rejected"
              ? "Rejected"
              : "Sent back for changes"
        );
        setChangesOpen(false);
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-4">
        {/* Thumbnail */}
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-sunken)]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : expense ? (
            <Receipt className="size-6 text-[var(--text-muted)]" />
          ) : script ? (
            <FileText className="size-6 text-[var(--text-muted)]" />
          ) : (
            <ImageIcon className="size-6 text-[var(--text-muted)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-medium leading-tight">{request.title || "Untitled"}</p>
            <Badge className={meta.className} dot={meta.dot}>
              {meta.label}
            </Badge>
          </div>

          <p className="muted mt-1 text-xs capitalize">
            {request.entity_type}
            {request.version > 1 && ` · v${request.version}`}
            {request.department && ` · ${request.department.name}`}
          </p>

          <div className="muted mt-2 flex items-center gap-1.5 text-xs">
            {request.requester && (
              <>
                <Avatar
                  name={request.requester.full_name || request.requester.email}
                  src={request.requester.avatar_url}
                  size="xs"
                />
                <span className="truncate">
                  {request.requester.full_name || request.requester.email}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="shrink-0">{relativeDay(request.created_at)}</span>
          </div>
        </div>
      </div>

      {script && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setScriptOpen(true)}
            className="w-full rounded-xl bg-[var(--surface-sunken)] p-3 text-left"
          >
            <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-muted)]">
              {script.body}
            </p>
            <span className="mt-1.5 inline-block text-xs font-medium text-pink-500">
              Read full script
            </span>
          </button>
        </div>
      )}

      {creative?.caption && (
        <div className="px-4 pb-3">
          <p className="muted line-clamp-2 text-xs leading-relaxed">{creative.caption}</p>
        </div>
      )}

      {/* An approver deciding on money needs the amount and what it is for
          without opening anything. */}
      {expense && (
        <div className="px-4 pb-3">
          <div className="flex items-baseline justify-between gap-3 rounded-xl bg-[var(--surface-sunken)] px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-lg font-semibold tabular-nums">
                {formatMoney(expense.amount)}
              </span>
              <span className="muted block truncate text-xs">
                {EXPENSE_CATEGORY[expense.category]}
                {expense.vendor ? ` · ${expense.vendor}` : ""}
                {` · ${formatDate(expense.expense_date)}`}
              </span>
            </span>
            <span className="muted shrink-0 text-xs">
              {expense.is_reimbursement ? "Reimbursement" : "Vendor payment"}
            </span>
          </div>
          {expense.description && (
            <p className="muted mt-2 line-clamp-2 text-xs leading-relaxed">
              {expense.description}
            </p>
          )}
        </div>
      )}

      {canDecide && (
        <div className="flex gap-2 border-t p-3">
          <Button
            variant="success"
            size="sm"
            className="flex-1"
            loading={pending}
            onClick={() => decide("approved")}
          >
            <Check className="size-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => setChangesOpen(true)}
          >
            <MessageSquare className="size-4" />
            Changes
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reject"
            disabled={pending}
            onClick={() => decide("rejected")}
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {!canDecide && request.status === "changes_requested" && isOwnSubmission && (
        <div className="border-t bg-orange-50 px-4 py-3 dark:bg-orange-950/30">
          <p className="text-xs font-medium text-orange-800 dark:text-orange-200">
            Changes requested — upload a new version to resubmit.
          </p>
        </div>
      )}

      {/* Request-changes sheet */}
      <Sheet
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        title="Request changes"
        description={request.title}
      >
        <form
          action={(formData) => decide("changes_requested", String(formData.get("comment") ?? ""))}
          className="space-y-4"
        >
          <Textarea
            name="comment"
            rows={5}
            required
            autoFocus
            placeholder="What needs to change? Be specific — this is what the designer will work from."
          />
          <Button type="submit" block loading={pending}>
            Send back for changes
          </Button>
        </form>
      </Sheet>

      {/* Full script sheet */}
      {script && (
        <Sheet
          open={scriptOpen}
          onClose={() => setScriptOpen(false)}
          title={script.title}
          description={`${script.type} · v${script.version}`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{script.body}</p>
        </Sheet>
      )}
    </Card>
  );
}
