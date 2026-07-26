/**
 * Month-key helpers.
 *
 * The calendar takes its month from the URL, which means it can be anything a
 * user or a stale link supplies. An unparseable value used to produce an
 * Invalid Date and crash the whole page on the client, so parsing is funnelled
 * through here and always returns something usable.
 */

/** "2026-07" */
export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parse a "yyyy-mm" key, falling back to the current month for anything
 * malformed, out of range, or missing.
 */
export function parseMonthKey(value: string | undefined | null): {
  key: string;
  year: number;
  month: number;
} {
  const fallback = new Date();

  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    // Guard the range too: "2026-00" and "2026-99" both parse but neither is
    // a real month, and Date would silently roll them into another year.
    if (year >= 1970 && year <= 2200 && month >= 1 && month <= 12) {
      return { key: value, year, month };
    }
  }

  return {
    key: monthKey(fallback),
    year: fallback.getFullYear(),
    month: fallback.getMonth() + 1,
  };
}
