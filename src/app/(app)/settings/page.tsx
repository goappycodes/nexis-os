import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { ROLE_LABEL } from "@/lib/constants";
import { SettingsForm } from "./settings-form";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Your profile</p>
        <SettingsForm
          profile={{
            full_name: user.full_name,
            phone: user.phone,
            job_title: user.job_title,
            primary_department_id: user.primary_department_id,
            whatsapp_opt_in: user.whatsapp_opt_in,
          }}
          departments={departments ?? []}
        />
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Change password</p>
        <PasswordForm />
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="mb-3 text-sm font-semibold">Account</p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="muted">Email</dt>
            <dd className="truncate">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="muted">Role</dt>
            <dd>{ROLE_LABEL[user.role]}</dd>
          </div>
        </dl>
        <p className="muted mt-3 text-xs">
          Your email and role can only be changed by a super admin.
        </p>
      </Card>
    </div>
  );
}
