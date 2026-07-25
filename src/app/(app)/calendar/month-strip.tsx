"use client";

import { MonthStripBase } from "@/components/shell/month-strip-base";

export function CalendarMonthStrip({ active }: { active: string }) {
  return <MonthStripBase active={active} href={(month) => `/calendar?month=${month}`} />;
}
