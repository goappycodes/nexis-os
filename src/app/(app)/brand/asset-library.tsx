"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Pin,
  Search,
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { deleteBrandAsset, getAssetDownloadUrl, togglePinned } from "./actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { EmptyLibraryIllustration } from "@/components/ui/illustrations";
import { cn, formatFileSize } from "@/lib/utils";
import type { BrandAsset, BrandAssetCategory } from "@/lib/types";

const CATEGORY_LABEL: Record<BrandAssetCategory, string> = {
  logo: "Logos",
  template: "Templates",
  photo: "Photos",
  document: "Documents",
  presentation: "Decks",
  video: "Video",
  icon: "Icons",
  font: "Fonts",
  other: "Other",
};

function categoryIcon(category: BrandAssetCategory) {
  if (category === "photo") return ImageIcon;
  if (category === "video") return Film;
  if (category === "font") return Type;
  if (category === "logo" || category === "icon") return Shapes;
  return FileText;
}

export function AssetLibrary({
  assets,
  signedUrls,
  category,
  query,
  canManage,
  currentUserId,
}: {
  assets: BrandAsset[];
  /** Thumbnail URLs, signed server-side in one batch. */
  signedUrls: Record<string, string>;
  category: string;
  query: string;
  canManage: boolean;
  currentUserId: string;
}) {
  const [search, setSearch] = useState(query);
  const [activeCategory, setActiveCategory] = useState(category);

  // Filtering is client-side: the library is small enough that a round trip
  // per keystroke would be slower and cost function invocations for nothing.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (activeCategory !== "all" && asset.category !== activeCategory) return false;
      if (!q) return true;
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.description?.toLowerCase().includes(q) ||
        asset.tags.some((tag) => tag.includes(q))
      );
    });
  }, [assets, activeCategory, search]);

  const categories = useMemo(() => {
    const present = new Set(assets.map((a) => a.category));
    return (Object.keys(CATEGORY_LABEL) as BrandAssetCategory[]).filter((c) => present.has(c));
  }, [assets]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or tag…"
          className="pl-10"
          type="search"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FilterChip
          label="All"
          active={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
        />
        {categories.map((c) => (
          <FilterChip
            key={c}
            label={CATEGORY_LABEL[c]}
            active={activeCategory === c}
            onClick={() => setActiveCategory(c)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            illustration={<EmptyLibraryIllustration className="w-36" />}
            title={search ? "Nothing matches" : "No assets yet"}
            description={
              search
                ? "Try a different word, or clear the search."
                : "Upload the logos, templates and photos everyone keeps asking for."
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              previewUrl={signedUrls[asset.file_path] ?? null}
              canManage={canManage}
              isOwn={asset.uploaded_by === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-xs font-medium transition",
        active
          ? "bg-ink-800 text-white dark:bg-white dark:text-ink-800"
          : "surface hover:border-pink-300"
      )}
    >
      {label}
    </button>
  );
}

function AssetCard({
  asset,
  previewUrl,
  canManage,
  isOwn,
}: {
  asset: BrandAsset;
  previewUrl: string | null;
  canManage: boolean;
  isOwn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = categoryIcon(asset.category);

  function download() {
    startTransition(async () => {
      const result = await getAssetDownloadUrl(asset.id, asset.file_path);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("url" in result && result.url) window.open(result.url, "_blank");
    });
  }

  function pin() {
    startTransition(async () => {
      const result = await togglePinned(asset.id, !asset.is_pinned);
      if (result?.error) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteBrandAsset(asset.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Removed");
    });
  }

  return (
    <Card className="group overflow-hidden">
      <div className="relative aspect-square bg-[var(--surface-sunken)]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={asset.name}
            loading="lazy"
            className={cn(
              "size-full",
              // Logos are usually transparent PNGs — contain avoids cropping
              // them, while photos look better filling the tile.
              asset.category === "logo" || asset.category === "icon"
                ? "bg-white object-contain p-4"
                : "object-cover"
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--text-muted)]">
            <Icon className="size-7" />
          </div>
        )}

        {asset.is_pinned && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <Pin className="size-2.5" />
            Pinned
          </span>
        )}

        {/* Actions sit on the tile so a download is one tap from the grid. */}
        <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1.5">
          <button
            onClick={download}
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/85 disabled:opacity-60"
          >
            <Download className="size-3" />
            Download
          </button>
          {canManage && (
            <button
              onClick={pin}
              disabled={pending}
              aria-label={asset.is_pinned ? "Unpin" : "Pin"}
              className="flex size-7 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur transition hover:bg-black/85"
            >
              <Pin className={cn("size-3", asset.is_pinned && "fill-current")} />
            </button>
          )}
          {(isOwn || canManage) && (
            <button
              onClick={remove}
              disabled={pending}
              aria-label="Remove"
              className="flex size-7 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur transition hover:bg-red-600"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="p-2.5">
        <p className="truncate text-xs font-medium leading-tight">{asset.name}</p>
        <p className="muted mt-0.5 truncate text-[11px]">
          {CATEGORY_LABEL[asset.category]}
          {asset.file_size ? ` · ${formatFileSize(asset.file_size)}` : ""}
          {asset.download_count > 0 ? ` · ${asset.download_count} downloads` : ""}
        </p>
        {asset.tags.length > 0 && (
          <p className="muted mt-1 truncate text-[10px]">
            {asset.tags.map((t) => `#${t}`).join(" ")}
          </p>
        )}
      </div>
    </Card>
  );
}
