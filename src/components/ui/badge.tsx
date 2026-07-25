import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  dot,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { dot?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        className
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />}
      {props.children}
    </span>
  );
}
