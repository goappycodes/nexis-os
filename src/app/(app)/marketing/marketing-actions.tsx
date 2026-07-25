"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Image as ImageIcon, Megaphone, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createCampaign, createCreative, createScript } from "./actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MARKETING_CHANNELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

type Option = { id: string; name: string };
type Approver = Pick<Profile, "id" | "full_name" | "email">;

export function MarketingActions({
  departments,
  approvers,
  events,
  campaigns,
  defaultDepartmentId,
  defaultMonth,
}: {
  departments: Option[];
  approvers: Approver[];
  events: Option[];
  campaigns: Option[];
  defaultDepartmentId: string | null;
  defaultMonth: string;
}) {
  const [open, setOpen] = useState<null | "menu" | "campaign" | "creative" | "script">(null);

  return (
    <>
      <Button size="sm" onClick={() => setOpen("menu")}>
        <Plus className="size-4" />
        New
      </Button>

      <Sheet open={open === "menu"} onClose={() => setOpen(null)} title="Add to marketing">
        <ul className="space-y-2">
          <ActionRow
            icon={<Megaphone className="size-5" />}
            title="Campaign"
            description="Plan a campaign for the month"
            onClick={() => setOpen("campaign")}
          />
          <ActionRow
            icon={<ImageIcon className="size-5" />}
            title="Creative"
            description="Upload a design and send it for approval"
            onClick={() => setOpen("creative")}
          />
          <ActionRow
            icon={<FileText className="size-5" />}
            title="Script"
            description="Write a script and send it for approval"
            onClick={() => setOpen("script")}
          />
        </ul>
      </Sheet>

      <CampaignSheet
        open={open === "campaign"}
        onClose={() => setOpen(null)}
        departments={departments}
        events={events}
        defaultDepartmentId={defaultDepartmentId}
        defaultMonth={defaultMonth}
      />
      <CreativeSheet
        open={open === "creative"}
        onClose={() => setOpen(null)}
        departments={departments}
        approvers={approvers}
        events={events}
        campaigns={campaigns}
        defaultDepartmentId={defaultDepartmentId}
      />
      <ScriptSheet
        open={open === "script"}
        onClose={() => setOpen(null)}
        approvers={approvers}
        events={events}
        campaigns={campaigns}
        defaultDepartmentId={defaultDepartmentId}
      />
    </>
  );
}

function ActionRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:border-pink-300"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-500 dark:bg-pink-900/30">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{title}</span>
          <span className="muted block text-xs">{description}</span>
        </span>
      </button>
    </li>
  );
}

/* ── Campaign ─────────────────────────────────────────────────────────────── */

function CampaignSheet({
  open,
  onClose,
  departments,
  events,
  defaultDepartmentId,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  departments: Option[];
  events: Option[];
  defaultDepartmentId: string | null;
  defaultMonth: string;
}) {
  const [pending, startTransition] = useTransition();
  const [channels, setChannels] = useState<string[]>([]);

  if (!open) return null;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createCampaign(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Campaign added");
        setChannels([]);
        onClose();
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="New campaign">
      <form action={submit} className="space-y-4">
        {channels.map((c) => (
          <input key={c} type="hidden" name="channels" value={c} />
        ))}

        <Field label="Campaign name" required>
          <Input name="name" required autoFocus placeholder="e.g. August admissions push" />
        </Field>

        <Field label="Month" required>
          <Input name="month" type="month" defaultValue={defaultMonth} required />
        </Field>

        <Field label="Objective">
          <Textarea name="objective" rows={2} placeholder="What should this achieve?" />
        </Field>

        <div>
          <p className="mb-1.5 block text-sm font-medium">Channels</p>
          <div className="flex flex-wrap gap-2">
            {MARKETING_CHANNELS.map((channel) => {
              const selected = channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setChannels((prev) =>
                      selected ? prev.filter((c) => c !== channel) : [...prev, channel]
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    selected ? "border-pink-500 bg-pink-500 text-white" : "surface hover:border-pink-300"
                  )}
                >
                  {channel}
                </button>
              );
            })}
          </div>
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
          <Field label="Budget (₹)">
            <Input name="budget_amount" type="number" min="0" inputMode="decimal" placeholder="25000" />
          </Field>
        </div>

        <Field label="Linked event">
          <Select name="event_id" defaultValue="">
            <option value="">None</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" block loading={pending} className="mt-2">
          Add campaign
        </Button>
      </form>
    </Sheet>
  );
}

/* ── Creative ─────────────────────────────────────────────────────────────── */

function CreativeSheet({
  open,
  onClose,
  departments,
  approvers,
  events,
  campaigns,
  defaultDepartmentId,
}: {
  open: boolean;
  onClose: () => void;
  departments: Option[];
  approvers: Approver[];
  events: Option[];
  campaigns: Option[];
  defaultDepartmentId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function submit(formData: FormData) {
    startTransition(async () => {
      let filePath = "";

      // Upload straight from the browser to Storage — the file never touches
      // the Next.js server, which keeps large videos off the request path.
      if (file) {
        setUploading(true);
        const supabase = createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;

        const { error } = await supabase.storage.from("creatives").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        setUploading(false);

        if (error) {
          toast.error(`Upload failed: ${error.message}`);
          return;
        }
        filePath = path;
      }

      formData.set("file_path", filePath);
      const result = await createCreative(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Creative saved");
        setFile(null);
        onClose();
      }
    });
  }

  const busy = pending || uploading;

  return (
    <Sheet open={open} onClose={onClose} title="New creative">
      <form action={submit} className="space-y-4">
        <div>
          <p className="mb-1.5 block text-sm font-medium">File</p>
          {file ? (
            <div className="surface flex items-center gap-3 rounded-xl p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-pink-500 dark:bg-pink-900/30">
                <ImageIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{file.name}</span>
                <span className="muted text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                aria-label="Remove file"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="surface flex w-full flex-col items-center gap-2 rounded-xl border-dashed p-6 transition hover:border-pink-300"
            >
              <Upload className="size-5 text-[var(--text-muted)]" />
              <span className="text-sm font-medium">Choose a file</span>
              <span className="muted text-xs">Image, video or PDF · up to 50 MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Field label="Title" required>
          <Input name="title" required placeholder="e.g. Open House announcement poster" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select name="type" defaultValue="image">
              {["image", "video", "reel", "carousel", "story", "poster", "banner", "brochure", "other"].map(
                (t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                )
              )}
            </Select>
          </Field>
          <Field label="Channel">
            <Select name="channel" defaultValue="">
              <option value="">None</option>
              {MARKETING_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Caption">
          <Textarea name="caption" rows={3} placeholder="The copy that goes with this creative…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <input type="hidden" name="department_id" value={defaultDepartmentId ?? ""} />

        <ApprovalBlock approvers={approvers} />

        <Button type="submit" block loading={busy} className="mt-2">
          {uploading ? "Uploading…" : pending ? "Saving…" : "Save creative"}
        </Button>
      </form>
    </Sheet>
  );
}

/* ── Script ───────────────────────────────────────────────────────────────── */

function ScriptSheet({
  open,
  onClose,
  approvers,
  events,
  campaigns,
  defaultDepartmentId,
}: {
  open: boolean;
  onClose: () => void;
  approvers: Approver[];
  events: Option[];
  campaigns: Option[];
  defaultDepartmentId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createScript(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Script saved");
        onClose();
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="New script">
      <form action={submit} className="space-y-4">
        <Field label="Title" required>
          <Input name="title" required autoFocus placeholder="e.g. Open House reel voiceover" />
        </Field>

        <Field label="Type">
          <Select name="type" defaultValue="other">
            {["reel", "ad", "announcement", "call", "email", "whatsapp", "speech", "other"].map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Script" required>
          <Textarea name="body" rows={8} required placeholder="Write the full script here…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <input type="hidden" name="department_id" value={defaultDepartmentId ?? ""} />

        <ApprovalBlock approvers={approvers} />

        <Button type="submit" block loading={pending} className="mt-2">
          Save script
        </Button>
      </form>
    </Sheet>
  );
}

/** Shared "send for approval" block used by both creatives and scripts. */
function ApprovalBlock({ approvers }: { approvers: Approver[] }) {
  const [submit, setSubmit] = useState(true);

  return (
    <div className="space-y-3 rounded-xl bg-[var(--surface-sunken)] p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="submit_for_approval"
          checked={submit}
          onChange={(e) => setSubmit(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-pink-500"
        />
        <span className="text-sm">
          <span className="font-medium">Send for approval now</span>
          <span className="muted block text-xs">
            Otherwise it is saved as a draft you can submit later.
          </span>
        </span>
      </label>

      {submit && (
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
  );
}
