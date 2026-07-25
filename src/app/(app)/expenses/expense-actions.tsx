"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createExpense } from "./actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EXPENSE_CATEGORY } from "@/lib/constants";
import type { Profile } from "@/lib/types";

type Option = { id: string; name: string };

export function ExpenseActions({
  departments,
  approvers,
  events,
  campaigns,
  defaultDepartmentId,
}: {
  departments: Option[];
  approvers: Pick<Profile, "id" | "full_name" | "email">[];
  events: Option[];
  campaigns: Option[];
  defaultDepartmentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitForApproval, setSubmitForApproval] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      let receiptPath = "";

      if (file) {
        setUploading(true);
        const supabase = createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;

        const { error } = await supabase.storage.from("receipts").upload(path, file);
        setUploading(false);

        if (error) {
          toast.error(`Receipt upload failed: ${error.message}`);
          return;
        }
        receiptPath = path;
      }

      formData.set("receipt_path", receiptPath);
      const result = await createExpense(undefined, formData);

      if (result?.error) toast.error(result.error);
      else {
        toast.success(submitForApproval ? "Sent for approval" : "Saved as draft");
        setFile(null);
        setOpen(false);
      }
    });
  }

  const busy = pending || uploading;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New
      </Button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} title="New expense">
          <form action={submit} className="space-y-4">
            <Field label="What is this for?" required>
              <Input name="title" required autoFocus placeholder="e.g. Standee printing for Open House" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (₹)" required>
                <Input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  required
                  placeholder="4500"
                />
              </Field>
              <Field label="Date" required>
                <Input
                  name="expense_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select name="category" defaultValue="other">
                  {Object.entries(EXPENSE_CATEGORY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vendor">
                <Input name="vendor" placeholder="e.g. Siliguri Print House" />
              </Field>
            </div>

            <Field label="Details">
              <Textarea name="description" rows={2} placeholder="Anything the approver should know…" />
            </Field>

            {/* Receipt */}
            <div>
              <p className="mb-1.5 block text-sm font-medium">Receipt</p>
              {file ? (
                <div className="surface flex items-center gap-3 rounded-xl p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{file.name}</span>
                    <span className="muted text-xs">{(file.size / 1024).toFixed(0)} KB</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    aria-label="Remove receipt"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="surface flex w-full flex-col items-center gap-1.5 rounded-xl border-dashed p-5 transition hover:border-pink-300"
                >
                  <Upload className="size-5 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium">Attach receipt</span>
                  <span className="muted text-xs">Photo or PDF · up to 10 MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <Select name="department_id" defaultValue={defaultDepartmentId ?? ""}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Event">
                <Select name="event_id" defaultValue="">
                  <option value="">None</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Campaign">
              <Select name="campaign_id" defaultValue="">
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-sunken)] p-3">
              <input
                type="checkbox"
                name="is_reimbursement"
                defaultChecked
                className="mt-0.5 size-4 shrink-0 accent-pink-500"
              />
              <span className="text-sm">
                <span className="font-medium">Reimburse me</span>
                <span className="muted block text-xs">
                  Uncheck if the vendor should be paid directly.
                </span>
              </span>
            </label>

            <div className="space-y-3 rounded-xl bg-[var(--surface-sunken)] p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="submit_for_approval"
                  checked={submitForApproval}
                  onChange={(e) => setSubmitForApproval(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-pink-500"
                />
                <span className="text-sm">
                  <span className="font-medium">Send for approval now</span>
                  <span className="muted block text-xs">Otherwise it is saved as a draft.</span>
                </span>
              </label>

              {submitForApproval && (
                <Field label="Approver">
                  <Select name="approver_id" defaultValue={approvers[0]?.id ?? ""}>
                    <option value="">Anyone with approval rights</option>
                    {approvers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name || a.email}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <Button type="submit" block loading={busy} className="mt-2">
              {uploading ? "Uploading receipt…" : pending ? "Saving…" : "Save expense"}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
