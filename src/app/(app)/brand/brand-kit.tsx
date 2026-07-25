"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrandToken } from "@/lib/types";

/**
 * The visual brand reference.
 *
 * Colours are click-to-copy: the fastest way to stop people eyeballing the
 * pink is to make the correct hex one tap away, everywhere they work.
 */
export function BrandKit({ tokens }: { tokens: BrandToken[] }) {
  const colors = tokens.filter((t) => t.kind === "color");
  const fonts = tokens.filter((t) => t.kind === "font");
  const rules = tokens.filter((t) => t.kind === "rule");

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading>Colour</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          {colors.map((token) => (
            <ColorSwatch key={token.id} token={token} />
          ))}
        </div>
      </section>

      {fonts.length > 0 && (
        <section>
          <SectionHeading>Typography</SectionHeading>
          {fonts.map((token) => (
            <Card key={token.id} className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">{token.name}</p>
                <CopyButton value={token.name} label="Copy" />
              </div>
              {token.description && <p className="muted mt-1 text-sm">{token.description}</p>}

              {/* Specimen — seeing the weights beats reading the numbers. */}
              <div className="mt-4 space-y-2 border-t pt-4">
                <p className="text-2xl font-bold leading-tight">
                  India&apos;s Most Practical Business School
                </p>
                <p className="text-base font-semibold">Learn by doing. Work from day 1.</p>
                <p className="muted text-sm">
                  Body copy sits at 400 weight. Headings run 600 to 700. The rhythm is
                  short sentences with full stops as beats.
                </p>
                <p className="muted text-xs">Weights available: {token.value}</p>
              </div>

              {token.usage_note && (
                <p className="mt-3 rounded-xl bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed">
                  {token.usage_note}
                </p>
              )}
            </Card>
          ))}
        </section>
      )}

      {rules.length > 0 && (
        <section>
          <SectionHeading>Rules</SectionHeading>
          <Card className="divide-y overflow-hidden">
            {rules.map((token) => (
              <div key={token.id} className="p-4">
                <p className="text-sm font-semibold">{token.name}</p>
                {token.description && (
                  <p className="mt-1 text-sm leading-relaxed">{token.description}</p>
                )}
                {token.usage_note && (
                  <p className="muted mt-1.5 text-xs leading-relaxed">{token.usage_note}</p>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      {children}
    </h2>
  );
}

function ColorSwatch({ token }: { token: BrandToken }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(token.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={copy}
        className="block h-24 w-full transition hover:brightness-95"
        style={{ backgroundColor: token.value }}
        aria-label={`Copy ${token.name} hex code ${token.value}`}
      />
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {token.name}
            {token.is_primary && (
              <span className="ml-1.5 rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:bg-pink-900 dark:text-pink-100">
                core
              </span>
            )}
          </p>
          <button
            onClick={copy}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs transition",
              copied
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                : "bg-[var(--surface-sunken)] hover:text-pink-500"
            )}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : token.value}
          </button>
        </div>
        {token.description && <p className="muted mt-1 text-xs">{token.description}</p>}
        {token.usage_note && (
          <p className="muted mt-1.5 text-xs leading-relaxed">{token.usage_note}</p>
        )}
      </div>
    </Card>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--surface-sunken)] px-2 py-1 text-xs transition hover:text-pink-500"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}
