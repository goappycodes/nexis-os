/**
 * The voice of Nexis OS.
 *
 * The tone target is the Nexis brand voice — direct, warm, second person,
 * short sentences with full stops as beats. Encouraging, not saccharine.
 * "Nice. That's the venue locked." beats "Congratulations on your achievement!"
 *
 * Nothing here is random per render: messages are chosen from a seed so the
 * same task doesn't change its wording between a server render and a client
 * one, and the daily quote is the same for the whole team all day. Shared
 * things are what make a workplace feel like a workplace.
 */

export type Quote = { text: string; author: string };

/** Short, attributed, and chosen to suit a school that teaches by doing. */
export const QUOTES: Quote[] = [
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Ideas are easy. Implementation is hard.", author: "Guy Kawasaki" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Dream, dream, dream. Dreams transform into thoughts.", author: "A. P. J. Abdul Kalam" },
  { text: "Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { text: "If you want to go far, go together.", author: "African proverb" },
  { text: "Amateurs wait for inspiration. The rest of us just get to work.", author: "Chuck Close" },
  { text: "Quality is never an accident. It is always the result of intelligent effort.", author: "John Ruskin" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Details matter. It's worth waiting to get it right.", author: "Steve Jobs" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
  { text: "Work hard in silence. Let success make the noise.", author: "Frank Ocean" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
];

/**
 * Same quote for everyone, all day, changing at midnight — so it can actually
 * be a thing people mention to each other.
 */
export function quoteOfTheDay(date = new Date()): Quote {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  return QUOTES[dayNumber % QUOTES.length];
}

/* ── Task completion ──────────────────────────────────────────────────────── */

const TASK_DONE = [
  "Nice. That's one down.",
  "Done and dusted.",
  "That's the way.",
  "Ticked off. Onwards.",
  "Good work.",
  "One less thing.",
  "Clean. Next.",
  "Sorted.",
  "Momentum.",
  "Chipping away nicely.",
];

const TASK_DONE_LATE = [
  "Got there. That's what counts.",
  "Late but landed. Good.",
  "Cleared. Nothing left hanging.",
  "Off the overdue list.",
];

/** Cycles by index so consecutive completions don't repeat the same line. */
export function taskDoneMessage(seed: number, wasOverdue = false) {
  const pool = wasOverdue ? TASK_DONE_LATE : TASK_DONE;
  return pool[Math.abs(seed) % pool.length];
}

/* ── Checklist progress ───────────────────────────────────────────────────── */

/** Reads the state of a checklist and says something true about it. */
export function progressMessage(done: number, total: number) {
  if (total === 0) return "Nothing on the list yet.";

  const remaining = total - done;
  const pct = (done / total) * 100;

  if (remaining === 0) return "Every step complete. Outstanding.";
  if (remaining === 1) return "One step left. Almost there.";
  if (remaining <= 3) return `${remaining} steps to go. The end is in sight.`;
  if (pct >= 75) return `${remaining} left. Final stretch.`;
  if (pct >= 50) return `${done} done, ${remaining} to go. Past halfway.`;
  if (pct >= 25) return `${done} done. Good rhythm — keep it going.`;
  if (done > 0) return `${done} done, ${remaining} to go. Off the mark.`;
  return `${total} steps mapped out. Start anywhere.`;
}

/* ── Dashboard ────────────────────────────────────────────────────────────── */

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good evening";
}

/** A line under the greeting that reflects what today actually looks like. */
export function dayOutlook({
  open,
  overdue,
  dueToday,
  approvals,
}: {
  open: number;
  overdue: number;
  dueToday: number;
  approvals: number;
}) {
  if (overdue > 0 && overdue >= dueToday) {
    return overdue === 1
      ? "One thing slipped past its date. Worth clearing first."
      : `${overdue} things slipped past their dates. Worth clearing those first.`;
  }
  if (dueToday > 0) {
    return dueToday === 1
      ? "One thing due today. Very doable."
      : `${dueToday} things due today. Very doable.`;
  }
  if (approvals > 0) {
    return approvals === 1
      ? "One thing is waiting on your call."
      : `${approvals} things are waiting on your call.`;
  }
  if (open > 0) {
    return "Nothing urgent today. Good day to get ahead.";
  }
  return "Your plate is clear. Enjoy it, you earned it.";
}

/** Celebrates a week's output without inventing numbers. */
export function weeklyMomentum(completed: number) {
  if (completed === 0) return null;
  if (completed === 1) return "You closed 1 task this week. It starts somewhere.";
  if (completed < 5) return `You closed ${completed} tasks this week. Steady.`;
  if (completed < 10) return `You closed ${completed} tasks this week. Strong week.`;
  if (completed < 20) return `${completed} tasks closed this week. Seriously good going.`;
  return `${completed} tasks closed this week. That is a machine at work.`;
}

/* ── Empty states ─────────────────────────────────────────────────────────── */

export const EMPTY_STATES = {
  noOpenWork: {
    title: "Your plate is clear",
    body: "Nothing assigned to you right now. Take the win, then go get ahead of next week.",
  },
  noOverdue: {
    title: "Nothing overdue",
    body: "You're on top of every deadline. That's harder than it sounds.",
  },
  allDone: {
    title: "Every step complete",
    body: "The whole checklist is closed out. That is a well-run event.",
  },
  noApprovals: {
    title: "Nothing waiting on you",
    body: "Your approvals queue is empty. The team isn't blocked on anything.",
  },
  noEvents: {
    title: "No events on the horizon",
    body: "When you create one, Nexis OS lays out all 38 steps so nothing gets forgotten.",
  },
  noCampaigns: {
    title: "This month is a blank page",
    body: "Add a campaign and start shaping what the month should look like.",
  },
} as const;
