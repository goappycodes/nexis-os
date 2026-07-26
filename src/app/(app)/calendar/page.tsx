import { requireUser } from "@/lib/auth";
import { getAgenda, type AgendaKind } from "@/lib/agenda";
import { parseMonthKey } from "@/lib/month";
import { MonthCalendar } from "./month-calendar";

export const metadata = { title: "Calendar" };

const ALL_KINDS: AgendaKind[] = [
  "event",
  "meeting",
  "task",
  "campaign",
  "approval",
  "reminder",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; show?: string; mine?: string }>;
}) {
  const { month, show = "all", mine } = await searchParams;
  // Anything malformed falls back to the current month rather than producing
  // an Invalid Date and taking the page down.
  const { key: active, year, month: m } = parseMonthKey(month);
  const onlyMine = mine === "1";

  const user = await requireUser();

  // Pad the window by a week so entries in the greyed-out neighbouring days at
  // the edges of the grid still appear.
  const from = new Date(year, m - 1, 1 - 7);
  const to = new Date(year, m, 1 + 7);

  const entries = await getAgenda({
    from,
    to,
    userId: user.id,
    onlyMine,
    kinds:
      show === "all" || !ALL_KINDS.includes(show as AgendaKind)
        ? ALL_KINDS
        : [show as AgendaKind],
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      <MonthCalendar
        month={active}
        entries={entries}
        show={ALL_KINDS.includes(show as AgendaKind) ? show : "all"}
        onlyMine={onlyMine}
      />
    </div>
  );
}
