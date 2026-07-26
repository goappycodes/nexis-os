import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Nexis wordmark, pulled from the live nexisschool.com media library.
 *
 * Two files rather than one recoloured with CSS filters: the brand rules say
 * dark logo on light, white logo on dark, and a filter-inverted mark is not
 * the same artwork.
 */
export function NexisLogo({
  variant = "dark",
  className,
  priority = false,
}: {
  variant?: "dark" | "white";
  className?: string;
  priority?: boolean;
}) {
  const src = variant === "white" ? "/brand/logo-white.png" : "/brand/logo.png";

  return (
    <Image
      src={src}
      alt="NEXIS School of Business"
      width={636}
      height={223}
      priority={priority}
      // Already compressed to 9-26 KB, so running them through Vercel's image
      // optimiser would burn transform quota for no gain.
      unoptimized
      // Width is set by the caller; height follows the aspect ratio.
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}

/** Square mark, for tight spaces where the full wordmark will not fit. */
export function NexisMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={256}
      height={256}
      unoptimized
      className={cn("object-contain", className)}
    />
  );
}
