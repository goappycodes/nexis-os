"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A short confetti burst for genuine milestones — finishing an event checklist,
 * clearing your queue. Deliberately rare: if everything is a celebration then
 * nothing is.
 *
 * Pure CSS particles rather than a canvas library, so it costs nothing in
 * bundle size and disappears entirely for anyone who prefers reduced motion.
 */

const COLORS = ["#EF3A5D", "#FF0049", "#D5FE00", "#F7F0E7", "#FB6789"];

export function Confetti({
  active,
  pieces = 40,
  onDone,
}: {
  active: boolean;
  pieces?: number;
  onDone?: () => void;
}) {
  const [show, setShow] = useState(false);

  // Fixed per mount so a re-render doesn't reshuffle mid-flight.
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.8 + Math.random() * 1.2,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 180,
        spin: (Math.random() - 0.5) * 900,
        round: Math.random() > 0.6,
      })),
    [pieces]
  );

  useEffect(() => {
    if (!active) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone?.();
      return;
    }

    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 3200);

    return () => clearTimeout(timer);
  }, [active, onDone]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-hidden>
      {bits.map((bit) => (
        <span
          key={bit.id}
          style={{
            left: `${bit.left}%`,
            width: bit.size,
            height: bit.size * (bit.round ? 1 : 1.6),
            backgroundColor: bit.color,
            borderRadius: bit.round ? "50%" : "2px",
            animationDelay: `${bit.delay}s`,
            animationDuration: `${bit.duration}s`,
            // Custom properties feed the keyframes so each piece flies its own path.
            ["--drift" as string]: `${bit.drift}px`,
            ["--spin" as string]: `${bit.spin}deg`,
          }}
          className="absolute -top-4 animate-[confettiFall_linear_forwards]"
        />
      ))}

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1 }
          85%  { opacity: 1 }
          100% { transform: translate3d(var(--drift), 105vh, 0) rotate(var(--spin)); opacity: 0 }
        }
      `}</style>
    </div>
  );
}
