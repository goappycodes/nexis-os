"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, PRIMARY_NAV, SECONDARY_NAV, visibleNav } from "./nav-config";
import { NavIcon } from "./nav-icon";

/** Desktop sidebar. Hidden below `lg`, where BottomNav takes over. */
export function Sidebar({
  isManager,
  isSuperAdmin,
  pendingApprovals = 0,
}: {
  isManager: boolean;
  isSuperAdmin: boolean;
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const admin = visibleNav(ADMIN_NAV, { isManager, isSuperAdmin });

  const renderItems = (items: typeof PRIMARY_NAV) =>
    items.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      const badge = item.href === "/approvals" ? pendingApprovals : 0;

      return (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-pink-500 text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
            )}
          >
            <NavIcon name={item.icon} className="size-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
            {badge > 0 && (
              <span
                className={cn(
                  "ml-auto flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-white/25 text-white" : "bg-pink-500 text-white"
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        </li>
      );
    });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-[var(--surface-raised)] lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-pink-500 text-base font-bold text-white">
          N
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Nexis OS</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <ul className="space-y-1">{renderItems(PRIMARY_NAV)}</ul>

        <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Workspace
        </p>
        <ul className="space-y-1">{renderItems(SECONDARY_NAV)}</ul>

        {admin.length > 0 && (
          <>
            <p className="px-3 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Admin
            </p>
            <ul className="space-y-1">{renderItems(admin)}</ul>
          </>
        )}
      </nav>
    </aside>
  );
}
