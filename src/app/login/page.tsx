import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col bg-ink-800 text-white">
      {/* Brand panel. On desktop it sits beside the form; on mobile, above it. */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-8">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-pink-500 text-lg font-bold">
              N
            </span>
            <span className="text-xl font-semibold tracking-tight">Nexis OS</span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-ink-200">
            One place for events, marketing and everything the Nexis team ships.
          </p>
        </div>

        {error === "deactivated" && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Your account has been deactivated. Please contact a super admin.
          </div>
        )}

        <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
          <LoginForm next={next} />
        </Suspense>

        <p className="mt-8 text-center text-xs text-ink-400">
          NEXIS School of Business · Siliguri
        </p>
      </div>
    </main>
  );
}
