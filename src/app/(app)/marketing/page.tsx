import { Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { APPROVAL_STATUS, CAMPAIGN_STATUS } from "@/lib/constants";
import { formatMoney, relativeDay } from "@/lib/utils";
import type { Creative, MarketingCampaign, Profile, Script } from "@/lib/types";
import { MonthStrip } from "./month-strip";
import { MarketingActions } from "./marketing-actions";
import { CreativeGrid } from "./creative-grid";

export const metadata = { title: "Marketing" };

/** "2026-08" for the month input and query filtering. */
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  const { month, tab = "calendar" } = await searchParams;
  const active = month ?? monthKey(new Date());

  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: departments }, { data: team }, { data: events }, { data: campaigns }] =
    await Promise.all([
      supabase.from("departments").select("id, name").eq("is_active", true).order("sort_order"),
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("events")
        .select("id, name")
        .gte("starts_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
        .order("starts_at", { ascending: false })
        .limit(50),
      supabase.from("marketing_campaigns").select("id, name").order("month", { ascending: false }),
    ]);

  // Only managers and above can be picked as an approver.
  const approvers = (team ?? []).filter(
    (p) => p.role === "super_admin" || p.role === "manager"
  ) as unknown as Pick<Profile, "id" | "full_name" | "email">[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
        <MarketingActions
          departments={departments ?? []}
          approvers={approvers}
          events={(events ?? []) as { id: string; name: string }[]}
          campaigns={(campaigns ?? []) as { id: string; name: string }[]}
          defaultDepartmentId={user.primary_department_id}
          defaultMonth={active}
        />
      </div>

      <MonthStrip active={active} tab={tab} />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabLink label="Calendar" tab="calendar" active={tab} month={active} />
        <TabLink label="Creatives" tab="creatives" active={tab} month={active} />
        <TabLink label="Scripts" tab="scripts" active={tab} month={active} />
      </div>

        {tab === "creatives" ? (
          <CreativesTab month={active} />
        ) : tab === "scripts" ? (
          <ScriptsTab month={active} />
        ) : (
          <CalendarTab month={active} />
        )}
    </div>
  );
}

function TabLink({
  label,
  tab,
  active,
  month,
}: {
  label: string;
  tab: string;
  active: string;
  month: string;
}) {
  const isActive = active === tab;
  return (
    <a
      href={`/marketing?month=${month}&tab=${tab}`}
      className={
        isActive
          ? "shrink-0 rounded-full bg-ink-800 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-800"
          : "surface shrink-0 rounded-full px-4 py-2 text-xs font-medium hover:border-pink-300"
      }
    >
      {label}
    </a>
  );
}

/* ── Calendar (campaigns for the month) ───────────────────────────────────── */

async function CalendarTab({ month }: { month: string }) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("marketing_campaigns")
    .select("*, owner:profiles!marketing_campaigns_owner_id_fkey(full_name, email), event:events(name, slug)")
    .eq("month", `${month}-01`)
    .order("created_at", { ascending: false });

  const campaigns = (data ?? []) as unknown as (MarketingCampaign & {
    owner: { full_name: string; email: string } | null;
    event: { name: string; slug: string } | null;
  })[];

  if (campaigns.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="Nothing planned this month"
          description="Add a campaign to start building the marketing plan for this month."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => {
        const meta = CAMPAIGN_STATUS[campaign.status];
        return (
          <Card key={campaign.id} className="p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{campaign.name}</p>
                {campaign.objective && (
                  <p className="muted mt-1 text-sm">{campaign.objective}</p>
                )}
              </div>
              <Badge className={meta.className} dot={meta.dot}>
                {meta.label}
              </Badge>
            </div>

            {campaign.channels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {campaign.channels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs"
                  >
                    {channel}
                  </span>
                ))}
              </div>
            )}

            <div className="muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {campaign.owner && <span>{campaign.owner.full_name || campaign.owner.email}</span>}
              {campaign.budget_amount !== null && (
                <span>{formatMoney(campaign.budget_amount)}</span>
              )}
              {campaign.event && <span>Event: {campaign.event.name}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Creatives ────────────────────────────────────────────────────────────── */

async function CreativesTab({ month }: { month: string }) {
  const supabase = await createClient();

  const start = `${month}-01T00:00:00.000Z`;
  const [year, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, m, 1)).toISOString();

  const { data } = await supabase
    .from("creatives")
    .select("*, creator:profiles!creatives_created_by_fkey(full_name, email)")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  const creatives = (data ?? []) as unknown as (Creative & {
    creator: { full_name: string; email: string } | null;
  })[];

  if (creatives.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No creatives this month"
          description="Upload a creative and send it straight into the approval queue."
        />
      </Card>
    );
  }

  return <CreativeGrid creatives={creatives} />;
}

/* ── Scripts ──────────────────────────────────────────────────────────────── */

async function ScriptsTab({ month }: { month: string }) {
  const supabase = await createClient();

  const start = `${month}-01T00:00:00.000Z`;
  const [year, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, m, 1)).toISOString();

  const { data } = await supabase
    .from("scripts")
    .select("*, creator:profiles!scripts_created_by_fkey(full_name, email)")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  const scripts = (data ?? []) as unknown as (Script & {
    creator: { full_name: string; email: string } | null;
  })[];

  if (scripts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No scripts this month"
          description="Every script that goes out should be approved here first."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {scripts.map((script) => {
        const meta = APPROVAL_STATUS[script.status];
        return (
          <Card key={script.id} className="p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{script.title}</p>
                <p className="muted mt-0.5 text-xs capitalize">
                  {script.type} · v{script.version} ·{" "}
                  {script.creator?.full_name || script.creator?.email} ·{" "}
                  {relativeDay(script.created_at)}
                </p>
              </div>
              <Badge className={meta.className} dot={meta.dot}>
                {meta.label}
              </Badge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">
              {script.body.length > 320 ? `${script.body.slice(0, 320)}…` : script.body}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
