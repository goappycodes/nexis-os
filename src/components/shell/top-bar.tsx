"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, MoreHorizontal } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/constants";
import type { AppRole } from "@/lib/types";
import { ADMIN_NAV, SECONDARY_NAV, visibleNav } from "./nav-config";
import { NavIcon } from "./nav-icon";
import { NexisLogo } from "./logo";

export function TopBar({
  name,
  email,
  role,
  avatarUrl,
  departmentName,
  isManager,
  isSuperAdmin,
}: {
  name: string;
  email: string;
  role: AppRole;
  avatarUrl: string | null;
  departmentName: string | null;
  isManager: boolean;
  isSuperAdmin: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const secondary = visibleNav(SECONDARY_NAV, { isManager, isSuperAdmin });
  const admin = visibleNav(ADMIN_NAV, { isManager, isSuperAdmin });

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-[var(--surface-raised)]/90 backdrop-blur-lg">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          {/* Wordmark only on mobile — the sidebar carries it on desktop. */}
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <NexisLogo className="h-6 dark:hidden" priority />
            <NexisLogo variant="white" className="hidden h-6 dark:block" priority />
            <span className="muted text-xs font-medium tracking-tight">OS</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setMenuOpen(true)}
              className="flex size-10 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)] lg:hidden"
              aria-label="More"
            >
              <MoreHorizontal className="size-5" />
            </button>

            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-full transition hover:opacity-80"
              aria-label="Account menu"
            >
              <Avatar name={name} src={avatarUrl} size="sm" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[var(--surface-sunken)] p-3">
          <Avatar name={name} src={avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium">{name || email}</p>
            <p className="muted truncate text-xs">
              {ROLE_LABEL[role]}
              {departmentName ? ` · ${departmentName}` : ""}
            </p>
          </div>
        </div>

        {/* On desktop these already live in the sidebar; the sheet is the only
            route to them on mobile. */}
        <div className="lg:hidden">
          <ul className="space-y-1">
            {secondary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--surface-sunken)]"
                >
                  <NavIcon name={item.icon} className="size-[18px]" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {admin.length > 0 && (
            <>
              <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Admin
              </p>
              <ul className="space-y-1">
                {admin.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--surface-sunken)]"
                    >
                      <NavIcon name={item.icon} className="size-[18px]" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <form action={signOut} className="mt-5 border-t pt-5">
          <Button type="submit" variant="outline" block>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </Sheet>
    </>
  );
}
