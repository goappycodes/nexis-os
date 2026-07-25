import { requireUser, isManager } from "@/lib/auth";
import { getBrandAssets, getBrandTokens, getDepartments } from "@/lib/reference-data";
import { BrandKit } from "./brand-kit";
import { AssetLibrary } from "./asset-library";
import { UploadAsset } from "./upload-asset";

export const metadata = { title: "Brand" };

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; q?: string }>;
}) {
  const { tab = "kit", category = "all", q = "" } = await searchParams;
  const user = await requireUser();

  // All three are cached org-wide reference data, so this page costs no
  // database round trips once warm.
  const [tokens, assets, departments] = await Promise.all([
    getBrandTokens(),
    getBrandAssets(),
    getDepartments(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brand</h1>
          <p className="muted mt-1 text-sm">
            One source of truth for how Nexis looks and sounds.
          </p>
        </div>
        <UploadAsset departments={departments} canPin={isManager(user)} />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabLink label="Brand kit" value="kit" active={tab} />
        <TabLink label={`Assets (${assets.length})`} value="assets" active={tab} />
      </div>

      {tab === "assets" ? (
        <AssetLibrary
          assets={assets}
          category={category}
          query={q}
          canManage={isManager(user)}
          currentUserId={user.id}
        />
      ) : (
        <BrandKit tokens={tokens} />
      )}
    </div>
  );
}

function TabLink({ label, value, active }: { label: string; value: string; active: string }) {
  const isActive = active === value;
  return (
    <a
      href={`/brand?tab=${value}`}
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
