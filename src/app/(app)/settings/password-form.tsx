"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateOwnPassword, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updateOwnPassword,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    else {
      toast.success("Password updated");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <Field label="New password" required hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      <Field label="Confirm new password" required>
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      <Button type="submit" variant="outline" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
