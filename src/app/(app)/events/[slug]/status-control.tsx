"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateEventStatus } from "../actions";
import { EVENT_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/types";

const FLOW: EventStatus[] = ["draft", "planning", "ready", "live", "completed"];

export function EventStatusControl({
  eventId,
  current,
}: {
  eventId: string;
  current: EventStatus;
}) {
  const [pending, startTransition] = useTransition();

  function setStatus(status: EventStatus) {
    if (status === current) return;
    startTransition(async () => {
      const result = await updateEventStatus(eventId, status);
      if (result?.error) toast.error(result.error);
      else toast.success(`Moved to ${EVENT_STATUS[status].label}`);
    });
  }

  return (
    <div>
      <p className="muted mb-2 text-xs font-semibold uppercase tracking-wide">Status</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FLOW.map((status) => {
          const meta = EVENT_STATUS[status];
          const active = status === current;
          return (
            <button
              key={status}
              onClick={() => setStatus(status)}
              disabled={pending}
              aria-pressed={active}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:opacity-60",
                active
                  ? "border-pink-500 bg-pink-500 text-white"
                  : "surface hover:border-pink-300"
              )}
            >
              {meta.label}
            </button>
          );
        })}
        <button
          onClick={() => setStatus("cancelled")}
          disabled={pending}
          aria-pressed={current === "cancelled"}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition disabled:opacity-60",
            current === "cancelled"
              ? "border-red-500 bg-red-500 text-white"
              : "surface text-[var(--text-muted)] hover:border-red-300"
          )}
        >
          Cancelled
        </button>
      </div>
    </div>
  );
}
