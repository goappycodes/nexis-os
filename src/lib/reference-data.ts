import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  BrandAsset,
  BrandToken,
  Department,
  EventPlaybook,
  EventPlaybookItem,
  Profile,
} from "@/lib/types";

/**
 * Cached org-wide reference data.
 *
 * These are the tables every page reads and almost nobody writes: departments,
 * the team directory, event playbooks, brand tokens. Fetching them per request
 * was costing a round trip to Mumbai on every single page render.
 *
 * Two rules make this safe:
 *
 *  1. Only data that is identical for every signed-in user goes in here. Nothing
 *     user-scoped is ever cached — tasks, approvals and expenses stay uncached
 *     and RLS-filtered, so a cache can never leak one person's work to another.
 *
 *  2. Because the value is the same for everyone, these read through the admin
 *     client. RLS would otherwise vary the result per caller and poison the
 *     shared cache.
 *
 * Each entry carries a tag so a write can invalidate it immediately rather than
 * waiting out the TTL.
 */

export const CACHE_TAGS = {
  departments: "departments",
  team: "team",
  playbooks: "playbooks",
  brand: "brand",
} as const;

const HOUR = 3600;

export const getDepartments = unstable_cache(
  async (): Promise<Pick<Department, "id" | "name" | "slug" | "color" | "icon" | "description">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("departments")
      .select("id, name, slug, color, icon, description")
      .eq("is_active", true)
      .order("sort_order");
    return data ?? [];
  },
  ["departments"],
  { revalidate: 24 * HOUR, tags: [CACHE_TAGS.departments] }
);

/**
 * The active team, for assignment pickers and approver dropdowns.
 * Shorter TTL than departments — people join and change roles more often.
 */
export const getTeam = unstable_cache(
  async (): Promise<Pick<Profile, "id" | "full_name" | "email" | "avatar_url" | "role" | "primary_department_id">[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, primary_department_id")
      .eq("is_active", true)
      .order("full_name");
    return data ?? [];
  },
  ["team"],
  { revalidate: HOUR, tags: [CACHE_TAGS.team] }
);

/** Managers and super admins — who can be picked as an approver. */
export async function getApprovers() {
  const team = await getTeam();
  return team.filter((p) => p.role === "super_admin" || p.role === "manager");
}

export const getPlaybooks = unstable_cache(
  async (): Promise<(EventPlaybook & { steps: number })[]> => {
    const supabase = createAdminClient();
    const [{ data: playbooks }, { data: items }] = await Promise.all([
      supabase.from("event_playbooks").select("*").order("name"),
      supabase.from("event_playbook_items").select("playbook_id"),
    ]);

    const counts = new Map<string, number>();
    for (const item of items ?? []) {
      counts.set(item.playbook_id, (counts.get(item.playbook_id) ?? 0) + 1);
    }

    return (playbooks ?? []).map((p) => ({
      ...(p as EventPlaybook),
      steps: counts.get(p.id) ?? 0,
    }));
  },
  ["playbooks"],
  { revalidate: 24 * HOUR, tags: [CACHE_TAGS.playbooks] }
);

export const getPlaybookItems = unstable_cache(
  async (): Promise<EventPlaybookItem[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("event_playbook_items")
      .select("*")
      .order("sort_order");
    return (data ?? []) as EventPlaybookItem[];
  },
  ["playbook-items"],
  { revalidate: 24 * HOUR, tags: [CACHE_TAGS.playbooks] }
);

export const getBrandTokens = unstable_cache(
  async (): Promise<BrandToken[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("brand_tokens")
      .select("*")
      .order("kind")
      .order("sort_order");
    return (data ?? []) as BrandToken[];
  },
  ["brand-tokens"],
  { revalidate: 24 * HOUR, tags: [CACHE_TAGS.brand] }
);

export const getBrandAssets = unstable_cache(
  async (): Promise<BrandAsset[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("brand_assets")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    return (data ?? []) as BrandAsset[];
  },
  ["brand-assets"],
  { revalidate: 6 * HOUR, tags: [CACHE_TAGS.brand] }
);

/** Call after any write that changes cached reference data. */
export function invalidate(tag: keyof typeof CACHE_TAGS) {
  revalidateTag(CACHE_TAGS[tag]);
}
