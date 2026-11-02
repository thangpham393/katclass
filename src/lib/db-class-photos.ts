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

/**
 * Ảnh chân dung mới nhất của từng học viên, lấy từ ảnh đã cắt trong các lớp
 * (class_photos) — để danh sách Học viên / hồ sơ hiện đúng ảnh vừa cập nhật
 * trong lớp, kể cả khi hồ sơ chưa có ảnh đại diện. RLS chỉ trả ảnh của lớp
 * người xem được quản lý ảnh; không có ảnh nào thì trả map rỗng.
 */
export async function fetchStudentPhotoUrls(studentIds?: string[]): Promise<Map<string, string>> {
  const sb = getSupabase();
  let q = sb.from("class_photos").select("photo_key, path, updated_at").neq("photo_key", "group");
  if (studentIds) {
    if (!studentIds.length) return new Map();
    q = q.in("photo_key", studentIds);
  }
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(5000);
  if (error) throw error;
  const latest = new Map<string, string>();
  for (const p of data as { photo_key: string; path: string }[]) {
    if (!latest.has(p.photo_key)) latest.set(p.photo_key, p.path);
  }
  if (!latest.size) return new Map();
  const keys = [...latest.keys()];
  const signed = await sb.storage.from(BUCKET).createSignedUrls(keys.map((k) => latest.get(k)!), 21600);
  if (signed.error) throw signed.error;
  const urls = new Map<string, string>();
  keys.forEach((k, i) => {
    const url = signed.data[i]?.signedUrl;
    if (url) urls.set(k, url);
  });
  return urls;
}
