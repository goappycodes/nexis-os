import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isSuperAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { cn, formatDateTime, relativeDay } from "@/lib/utils";
import type { Reminder } from "@/lib/types";

export const metadata = { title: "Message log" };

export default async function MessagingPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/");

  const supabase = await createClient();

  const [{ data: messages }, { data: pending }] = await Promise.all([
    supabase.from("message_log").select("*").order("created_at", { ascending: false }).limit(80),
    supabase
      .from("reminders")
      .select("*, user:profiles(full_name, email)")
      .eq("status", "pending")
      .order("send_at")
      .limit(30),
  ]);

  const queued = (pending ?? []) as unknown as (Reminder & {
    user: { full_name: string; email: string } | null;
  })[];

  const dryRun = process.env.MSG91_DRY_RUN !== "false";
  const configured = Boolean(process.env.MSG91_AUTH_KEY);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Message log</h1>
        <p className="muted mt-1 text-sm">Every WhatsApp and SMS the OS has sent.</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              configured && !dryRun ? "bg-green-500" : "bg-amber-500"
            )}
            aria-hidden
          />
          <p className="text-sm font-medium">
            {!configured
              ? "MSG91 not configured"
              : dryRun
                ? "Dry run — messages are logged, not sent"
                : "Live — messages are being delivered"}
          </p>
        </div>
        {(!configured || dryRun) && (
          <p className="muted mt-2 text-xs leading-relaxed">
            Set <code>MSG91_AUTH_KEY</code>, <code>MSG91_WHATSAPP_INTEGRATED_NUMBER</code> and{" "}
            <code>MSG91_DRY_RUN=false</code> in your environment to start sending.
          </p>
        )}
      </Card>

      {queued.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Queued ({queued.length})
          </h2>
          <Card className="divide-y overflow-hidden">
            {queued.map((reminder) => (
              <div key={reminder.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{reminder.body ?? reminder.template}</p>
                  <p className="muted mt-0.5 text-xs">
                    {reminder.user?.full_name || reminder.user?.email || "—"} ·{" "}
                    {formatDateTime(reminder.send_at)}
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {reminder.channel}
                </Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Sent
        </h2>
        {(messages?.length ?? 0) === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageCircle className="size-6" />}
              title="No messages yet"
              description="Reminders sent through MSG91 appear here with their delivery status."
            />
          </Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {messages!.map((message) => (
              <div key={message.id} className="flex items-start gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{message.body ?? message.template}</p>
                  <p className="muted mt-0.5 text-xs">
                    {message.recipient} · {message.channel} · {relativeDay(message.created_at)}
                  </p>
                </div>
                <Badge
                  className={
                    message.status === "sent"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                      : message.status === "dry_run"
                        ? "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-100"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  }
                >
                  {message.status}
                </Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
