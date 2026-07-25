"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createBoard } from "./actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export function BoardActions({
  departments,
  defaultDepartmentId,
}: {
  departments: { id: string; name: string }[];
  defaultDepartmentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createBoard(undefined, formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Board created");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New board"
        description="Starts with To do, In progress, Review and Done."
      >
        <form action={submit} className="space-y-4">
          <Field label="Board name" required>
            <Input name="name" required autoFocus placeholder="e.g. Marketing sprint" />
          </Field>

          <Field label="Description">
            <Textarea name="description" rows={2} placeholder="What is this board for?" />
          </Field>

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

          <Button type="submit" block loading={pending} className="mt-2">
            Create board
          </Button>
        </form>
      </Sheet>
    </>
  );
}
