"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { signIn, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-100">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="you@nexisschool.com"
          className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-white outline-none transition placeholder:text-ink-400 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-100">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 pr-12 text-white outline-none transition placeholder:text-ink-400 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-300 hover:text-white"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" block loading={pending} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="pt-2 text-center text-sm text-ink-400">
        No account yet? Ask a super admin to add you.
      </p>
    </form>
  );
}
