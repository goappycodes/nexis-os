"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-config";
import { NavIcon } from "./nav-icon";

/** Fixed thumb-reach navigation. Mobile only — hidden from `lg` up. */
export function BottomNav({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface-raised)]/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg">
        {PRIMARY_NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const badge = item.href === "/approvals" ? pendingApprovals : 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 pt-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-pink-500" : "text-[var(--text-muted)]"
                )}
              >
                <span className="relative">
                  <NavIcon name={item.icon} className="size-[22px]" />
                  {badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
                {active && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-pink-500" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
