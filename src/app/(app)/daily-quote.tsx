import { Quote as QuoteIcon } from "lucide-react";
import { quoteOfTheDay } from "@/lib/encouragement";

/**
 * The same quote for the whole team, all day.
 *
 * Small thing, but it is the one piece of the OS that isn't a task or a
 * deadline — a reason to open the app that isn't work chasing you.
 */
export function DailyQuote() {
  const quote = quoteOfTheDay();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink-800 p-5 text-white dark:bg-ink-700">
      {/* Brand wash — pink bleeding in from the corner. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, #EF3A5D 0%, transparent 70%)" }}
        aria-hidden
      />
      <QuoteIcon className="mb-2.5 size-4 text-pink-400" aria-hidden />
      <p className="relative text-[15px] font-medium leading-snug">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="relative mt-2 text-xs text-ink-300">{quote.author}</p>
    </div>
  );
}
