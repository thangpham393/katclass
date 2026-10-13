"use client";

import { getSupabase } from "./supabase";

const BUCKET = "class-photos";
export interface ClassPhoto { key: string; path: string; url: string }

export async function fetchClassPhotos(classId: string): Promise<ClassPhoto[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("class_photos").select("photo_key, path").eq("class_id", classId);
  if (error) throw error;
  if (!data.length) return [];
  const signed = await sb.storage.from(BUCKET).createSignedUrls(data.map(p => p.path), 21600);
  if (signed.error) throw signed.error;
  return data.map((p, i) => {
    const url = signed.data[i]?.signedUrl;
    if (!url) throw new Error("Không tải được ảnh lớp. Vui lòng thử lại.");
    return { key: p.photo_key, path: p.path, url };
  });
}

/** Unique upload paths let a failed save retry without overwriting existing portraits. */
export async function saveClassPhotos(classId: string, drafts: Record<string, Blob | null>) {
  const sb = getSupabase();
  const uploaded: string[] = [];
  const changes: Record<string, string | null> = {};
  try {
    for (const [key, blob] of Object.entries(drafts)) {
      if (!blob) { changes[key] = null; continue; }
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${classId}/${key}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      uploaded.push(path);
      changes[key] = path;
    }
  } catch (error) {
    if (uploaded.length) await sb.storage.from(BUCKET).remove(uploaded);
    throw error;
  }
  // Keep uploaded files if the RPC response is lost: the transaction may have committed.
  const { error } = await sb.rpc("save_class_photos", { cid: classId, changes });
  if (error) {
    // SQL errors prove the transaction rolled back; transport failures do not.
    if (/^[0-9A-Z]{5}$/.test(error.code ?? "") && uploaded.length) await sb.storage.from(BUCKET).remove(uploaded);
    throw error;
  }
}
