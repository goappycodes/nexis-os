"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isManager } from "@/lib/auth";
import { invalidate } from "@/lib/reference-data";
import type { BrandAssetCategory } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function createBrandAsset(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const filePath = String(formData.get("file_path") ?? "");
  if (!name) return { error: "Give the asset a name." };
  if (!filePath) return { error: "Choose a file to upload." };

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const { error } = await supabase.from("brand_assets").insert({
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    category: (String(formData.get("category") ?? "other") || "other") as BrandAssetCategory,
    file_path: filePath,
    file_size: Number(formData.get("file_size") ?? 0) || null,
    mime_type: String(formData.get("mime_type") ?? "") || null,
    department_id: String(formData.get("department_id") ?? "") || null,
    tags,
    is_pinned: formData.get("is_pinned") === "on" && isManager(user),
    uploaded_by: user.id,
  });

  if (error) return { error: error.message };

  invalidate("brand");
  revalidatePath("/brand");
  return { ok: true };
}

export async function togglePinned(assetId: string, pinned: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!isManager(user)) return { error: "Only a manager can pin assets." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_assets")
    .update({ is_pinned: pinned })
    .eq("id", assetId);

  if (error) return { error: error.message };

  invalidate("brand");
  revalidatePath("/brand");
  return { ok: true };
}

export async function deleteBrandAsset(assetId: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("brand_assets")
    .select("file_path")
    .eq("id", assetId)
    .single();

  const { error } = await supabase.from("brand_assets").delete().eq("id", assetId);
  if (error) return { error: "You can only remove assets you uploaded." };

  // Best effort — an orphaned object is better than a broken row.
  if (asset?.file_path) {
    await supabase.storage.from("brand").remove([asset.file_path]);
  }

  invalidate("brand");
  revalidatePath("/brand");
  return { ok: true };
}

/** Signed download link, and a note that someone actually used the asset. */
export async function getAssetDownloadUrl(assetId: string, path: string) {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("brand").createSignedUrl(path, 3600, {
    download: true,
  });
  if (error || !data) return { error: "Could not create a download link." };

  // Download counts show which assets are actually pulling their weight.
  await supabase.rpc("record_asset_download", { asset_id: assetId });

  return { url: data.signedUrl };
}
