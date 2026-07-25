"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Top-of-screen navigation progress bar.
 *
 * A "snake" of brand pink runs along the top edge while the next route is
 * being rendered on the server. App Router navigations do the work before
 * anything on screen changes, so without this the app looks frozen after a
 * tap — this is the difference between "loading" and "broken" to a user.
 *
 * Deliberately avoids useSearchParams: that hook forces a Suspense boundary
 * around the whole layout. Query-only navigations (filter tabs) are caught by
 * polling location.href, which only runs while the bar is actually visible.
 */
export function SnakeLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const crawl = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchUrl = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  function stopTimers() {
    if (crawl.current) clearInterval(crawl.current);
    if (watchUrl.current) clearInterval(watchUrl.current);
    crawl.current = null;
    watchUrl.current = null;
  }

  function finish() {
    stopTimers();
    setProgress(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }

  // A path change means the new route has rendered.
  useEffect(() => {
    finish();
    return () => {
      if (hide.current) clearTimeout(hide.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function start() {
      if (hide.current) clearTimeout(hide.current);
      stopTimers();

      const from = window.location.href;
      startedAt.current = Date.now();
      setVisible(true);
      setProgress(8);

      // Decelerating crawl: quick off the mark, asymptotic near the end, so it
      // never claims to be finished before the page actually is.
      crawl.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.6, (90 - p) / 12)));
      }, 90);

      // Catches filter changes, where the path stays the same. Also acts as a
      // dead-man's switch so a failed navigation can't leave the bar stuck.
      watchUrl.current = setInterval(() => {
        if (window.location.href !== from || Date.now() - startedAt.current > 15000) {
          finish();
        }
      }, 120);
    }

    function onClick(event: MouseEvent) {
      // Modified clicks open a new tab rather than navigating here.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same destination: nothing will change, so don't flash the bar.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      start();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      role="progressbar"
      aria-label="Loading page"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="relative h-full bg-gradient-to-r from-pink-600 via-pink-500 to-pink-400 shadow-[0_0_10px_rgba(239,58,93,.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      >
        {/* The snake's head: a glowing tip that keeps pulsing even when
            progress stalls, so a slow route still reads as alive. */}
        <span className="absolute right-0 top-0 h-full w-24 animate-[snakeGlow_1s_ease-in-out_infinite] bg-gradient-to-r from-transparent to-white/70" />
        <span className="absolute right-0 top-0 h-full w-6 bg-white/90 blur-[3px]" />
      </div>

      <style>{`
        @keyframes snakeGlow {
          0%, 100% { opacity: .35 }
          50%      { opacity: 1 }
        }
      `}</style>
    </div>
  );
}
