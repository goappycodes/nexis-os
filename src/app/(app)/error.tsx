"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error boundary for the app shell.
 *
 * Without this, any client-side exception replaces the entire screen with
 * Next's raw "Application error" text and the user is stuck. Here they keep
 * the navigation, get told what happened in plain language, and have a way
 * out that doesn't involve retyping the URL.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the Vercel function logs with the digest, which is the only
    // way to tie a user's report back to a specific minified stack.
    console.error("[nexis-os]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-2">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-500 dark:bg-pink-900/30">
          <RefreshCw className="size-5" />
        </div>

        <h1 className="text-lg font-semibold">That page didn&apos;t load</h1>
        <p className="muted mt-2 text-sm leading-relaxed">
          Something went wrong rendering this screen. Your work is safe — nothing was
          lost. Try again, and if it keeps happening tell whoever looks after Nexis OS.
        </p>

        {error.digest && (
          <p className="muted mt-3 font-mono text-[11px]">Reference: {error.digest}</p>
        )}

        <div className="mt-5 flex gap-2">
          <Button onClick={reset} className="flex-1">
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Link href="/" className="flex-1">
            <Button variant="outline" block>
              <House className="size-4" />
              Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
