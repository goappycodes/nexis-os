import type {
  ApprovalStatus,
  CampaignStatus,
  EventStatus,
  TaskPriority,
  TaskStatus,
  WorkCategory,
} from "@/lib/types";

/**
 * Presentation metadata for every enum in the system.
 *
 * Single source of truth so a status looks and reads identically on the
 * dashboard, in a list, and on a detail page — one of the consistency problems
 * this OS exists to solve.
 */

type Meta = { label: string; className: string; dot: string };

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  todo:        { label: "To do",       className: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100", dot: "bg-ink-400" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", dot: "bg-blue-500" },
  blocked:     { label: "Blocked",     className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", dot: "bg-amber-500" },
  done:        { label: "Done",        className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", dot: "bg-green-500" },
  cancelled:   { label: "Cancelled",   className: "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-400", dot: "bg-ink-300" },
};

export const TASK_PRIORITY: Record<TaskPriority, Meta> = {
  low:    { label: "Low",    className: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-200", dot: "bg-ink-300" },
  normal: { label: "Normal", className: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100", dot: "bg-ink-400" },
  high:   { label: "High",   className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200", dot: "bg-orange-500" },
  urgent: { label: "Urgent", className: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200", dot: "bg-pink-500" },
};

export const EVENT_STATUS: Record<EventStatus, Meta> = {
  draft:     { label: "Draft",     className: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-200", dot: "bg-ink-300" },
  planning:  { label: "Planning",  className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", dot: "bg-blue-500" },
  ready:     { label: "Ready",     className: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200", dot: "bg-lime-500" },
  live:      { label: "Live",      className: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200", dot: "bg-pink-500" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", className: "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-400", dot: "bg-ink-300" },
};

export const APPROVAL_STATUS: Record<ApprovalStatus, Meta> = {
  draft:             { label: "Draft",            className: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-200", dot: "bg-ink-300" },
  pending:           { label: "Awaiting approval", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", dot: "bg-amber-500" },
  approved:          { label: "Approved",         className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", dot: "bg-green-500" },
  changes_requested: { label: "Changes requested", className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200", dot: "bg-orange-500" },
  rejected:          { label: "Rejected",         className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", dot: "bg-red-500" },
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, Meta> = {
  planned:     { label: "Planned",     className: "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100", dot: "bg-ink-400" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", dot: "bg-blue-500" },
  live:        { label: "Live",        className: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200", dot: "bg-pink-500" },
  completed:   { label: "Completed",   className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", dot: "bg-green-500" },
  cancelled:   { label: "Cancelled",   className: "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-400", dot: "bg-ink-300" },
};

/** Lucide icon name per work category, for checklist grouping. */
export const WORK_CATEGORY: Record<WorkCategory, { label: string; icon: string }> = {
  printables:    { label: "Printables",    icon: "printer" },
  venue:         { label: "Venue",         icon: "map-pin" },
  stage_setup:   { label: "Stage setup",   icon: "presentation" },
  logistics:     { label: "Logistics",     icon: "truck" },
  invitations:   { label: "Invitations",   icon: "mail" },
  announcements: { label: "Announcements", icon: "megaphone" },
  marketing:     { label: "Marketing",     icon: "trending-up" },
  campaigns:     { label: "Campaigns",     icon: "target" },
  budget:        { label: "Budget",        icon: "wallet" },
  registrations: { label: "Registrations", icon: "clipboard-list" },
  hospitality:   { label: "Hospitality",   icon: "coffee" },
  documentation: { label: "Documentation", icon: "file-text" },
  other:         { label: "Other",         icon: "circle-dashed" },
};

export const ROLE_LABEL = {
  super_admin: "Super admin",
  manager: "Manager",
  member: "Team member",
} as const;

export const MARKETING_CHANNELS = [
  "Instagram",
  "Facebook",
  "WhatsApp",
  "LinkedIn",
  "YouTube",
  "Google Ads",
  "Meta Ads",
  "Website",
  "Email",
  "Print",
  "Outdoor",
  "School outreach",
] as const;
