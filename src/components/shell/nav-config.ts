/**
 * Navigation map.
 *
 * `primary` is what appears in the mobile bottom bar — capped at five, because
 * more than that becomes unhittable with a thumb. Everything else lives in
 * "More" on mobile and in the full sidebar on desktop.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Lucide icon name; resolved in nav-icon.tsx */
  icon: string;
  /** Hide from members who aren't managers. */
  managerOnly?: boolean;
  superAdminOnly?: boolean;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "house" },
  { href: "/events", label: "Events", icon: "calendar-days" },
  { href: "/marketing", label: "Marketing", icon: "megaphone" },
  { href: "/approvals", label: "Approvals", icon: "check-circle-2" },
  { href: "/my-work", label: "My work", icon: "list-checks" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/boards", label: "Boards", icon: "kanban" },
  { href: "/calendar", label: "Calendar", icon: "calendar-range" },
  { href: "/team", label: "Team", icon: "users" },
  { href: "/departments", label: "Departments", icon: "building-2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/people", label: "People & roles", icon: "user-cog", superAdminOnly: true },
  { href: "/admin/playbooks", label: "Event playbooks", icon: "book-open", managerOnly: true },
  { href: "/admin/messaging", label: "Message log", icon: "message-circle", superAdminOnly: true },
];

export function visibleNav(
  items: NavItem[],
  opts: { isManager: boolean; isSuperAdmin: boolean }
) {
  return items.filter((item) => {
    if (item.superAdminOnly && !opts.isSuperAdmin) return false;
    if (item.managerOnly && !opts.isManager) return false;
    return true;
  });
}
