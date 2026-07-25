"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createBrandAsset } from "./actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const CATEGORIES = [
  ["logo", "Logo"],
  ["template", "Template"],
  ["photo", "Photo"],
  ["document", "Document"],
  ["presentation", "Deck"],
  ["video", "Video"],
  ["icon", "Icon"],
  ["font", "Font"],
  ["other", "Other"],
] as const;

export function UploadAsset({
  departments,
  canPin,
}: {
  departments: { id: string; name: string }[];
  canPin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }

    startTransition(async () => {
      setUploading(true);
      const supabase = createClient();
      const category = String(formData.get("category") ?? "other");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${category}/${crypto.randomUUID()}-${safeName}`;

      const { error } = await supabase.storage.from("brand").upload(path, file, {
        cacheControl: "3600",
      });
      setUploading(false);

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      formData.set("file_path", path);
      formData.set("file_size", String(file.size));
      formData.set("mime_type", file.type);

      const result = await createBrandAsset(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Added to the library");
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
        Add
      </Button>

      {open && (
        <Sheet
          open
          onClose={() => setOpen(false)}
          title="Add to brand library"
          description="Anything the team should be reusing instead of remaking."
        >
          <form action={submit} className="space-y-4">
            <div>
              <p className="mb-1.5 block text-sm font-medium">File</p>
              {file ? (
                <div className="surface flex items-center gap-3 rounded-xl p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{file.name}</span>
                    <span className="muted text-xs">
                      {formatFileSize(file.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    aria-label="Remove file"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="surface flex w-full flex-col items-center gap-1.5 rounded-xl border-dashed p-6 transition hover:border-pink-300"
                >
                  <Upload className="size-5 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium">Choose a file</span>
                  <span className="muted text-xs">Up to 100 MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setFile(chosen);
                }}
              />
            </div>

            <Field label="Name" required>
              <Input
                name="name"
                required
                defaultValue={file ? file.name.replace(/\.[^.]+$/, "") : ""}
                key={file?.name ?? "empty"}
                placeholder="e.g. Event poster template — A3"
              />
            </Field>

            <Field label="What is it for?">
              <Textarea
                name="description"
                rows={2}
                placeholder="When should someone reach for this?"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <Select name="category" defaultValue="other">
                  {CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Department">
                <Select name="department_id" defaultValue="">
                  <option value="">Everyone</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Tags" hint="Comma separated. These are what search looks at.">
              <Input name="tags" placeholder="poster, event, print" />
            </Field>

            {canPin && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-sunken)] p-3">
                <input
                  type="checkbox"
                  name="is_pinned"
                  className="mt-0.5 size-4 shrink-0 accent-pink-500"
                />
                <span className="text-sm">
                  <span className="font-medium">Pin to the top</span>
                  <span className="muted block text-xs">
                    For the handful of things everyone needs constantly.
                  </span>
                </span>
              </label>
            )}

            <Button type="submit" block loading={busy} className="mt-2">
              {uploading ? "Uploading…" : pending ? "Saving…" : "Add to library"}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
