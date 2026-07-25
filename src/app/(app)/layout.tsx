import { requireUser, isManager, isSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const manager = isManager(user);
  const superAdmin = isSuperAdmin(user);

  // Approval count drives the nav badge — the number the team should be
  // looking at first thing every morning.
  const supabase = await createClient();
  const { count } = await supabase
    .from("approval_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("assigned_to", user.id);

  const pendingApprovals = count ?? 0;

  return (
    <div className="min-h-dvh">
      <Sidebar
        isManager={manager}
        isSuperAdmin={superAdmin}
        pendingApprovals={pendingApprovals}
      />

      <div className="lg:pl-60">
        <TopBar
          name={user.full_name || user.email}
          email={user.email}
          role={user.role}
          avatarUrl={user.avatar_url}
          departmentName={user.department?.name ?? null}
          isManager={manager}
          isSuperAdmin={superAdmin}
        />

        {/* pb-24 clears the fixed bottom nav on mobile. */}
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav pendingApprovals={pendingApprovals} />
    </div>
  );
}
