"use client";

import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APPROVAL_STATUS } from "@/lib/constants";
import { relativeDay } from "@/lib/utils";
import type { Creative } from "@/lib/types";

type CreativeRow = Creative & { creator: { full_name: string; email: string } | null };

export function CreativeGrid({ creatives }: { creatives: CreativeRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {creatives.map((creative) => (
        <CreativeCard key={creative.id} creative={creative} />
      ))}
    </div>
  );
}

function CreativeCard({ creative }: { creative: CreativeRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const meta = APPROVAL_STATUS[creative.status];
  const isImage = ["image", "poster", "banner", "carousel", "story"].includes(creative.type);

  // Buckets are private, so thumbnails need a signed URL. Fetched per card on
  // mount rather than server-side, to keep the list render fast.
  useEffect(() => {
    if (!creative.file_path || !isImage) return;
    let cancelled = false;

    const supabase = createClient();
    supabase.storage
      .from("creatives")
      .createSignedUrl(creative.file_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [creative.file_path, isImage]);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-[var(--surface-sunken)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={creative.title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--text-muted)]">
            {creative.type === "video" || creative.type === "reel" ? (
              <Play className="size-7" />
            ) : creative.type === "brochure" ? (
              <FileText className="size-7" />
            ) : (
              <ImageIcon className="size-7" />
            )}
          </div>
        )}

        <div className="absolute left-1.5 top-1.5">
          <Badge className={`${meta.className} shadow-sm`} dot={meta.dot}>
            {meta.label}
          </Badge>
        </div>

        {creative.version > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            v{creative.version}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="truncate text-xs font-medium leading-tight">{creative.title}</p>
        <p className="muted mt-0.5 truncate text-[11px]">
          {creative.channel ? `${creative.channel} · ` : ""}
          {relativeDay(creative.created_at)}
        </p>
      </div>
    </Card>
  );
}
