"use client";

import { MonthStripBase } from "@/components/shell/month-strip-base";

export function MonthStrip({ active, tab }: { active: string; tab: string }) {
  return (
    <MonthStripBase
      active={active}
      href={(month) => `/marketing?month=${month}&tab=${tab}`}
    />
  );
}
