"use client";

/**
 * CỔNG PHỤ HUYNH BẰNG ĐƯỜNG DẪN (migration 0041).
 *
 * Phía admin chỉ có 4 việc: xem link, bật/tắt, đổi token, biết phụ huynh
 * đã mở lần cuối lúc nào. Toàn bộ phần đọc dữ liệu của phụ huynh nằm ở
 * /api/parent-portal (service role) — file này không đụng tới.
 */

import { getSupabase } from "./supabase";

export type ParentShareLink = {
  student_id: string;
  token: string;
  enabled: boolean;
  created_at: string;
  rotated_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
};

/** Đường dẫn tuyệt đối gửi cho phụ huynh (dùng cả cho QR). */
export function parentShareUrl(token: string): string {
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/parent/s/${token}`;
}

function newToken(): string {
  return crypto.randomUUID();
}

export async function fetchParentShareLink(
  studentId: string,
): Promise<ParentShareLink | null> {
  const { data, error } = await getSupabase()
    .from("parent_share_links")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return (data as ParentShareLink) ?? null;
}

/** Có sẵn thì trả về, chưa có thì tạo mới — gọi khi admin mở hộp thoại. */
export async function ensureParentShareLink(
  studentId: string,
  createdBy: string | null,
): Promise<ParentShareLink> {
  const existing = await fetchParentShareLink(studentId);
  if (existing) return existing;

  const { data, error } = await getSupabase()
    .from("parent_share_links")
    .insert({ student_id: studentId, token: newToken(), created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as ParentShareLink;
}

/** Đổi token: link cũ chết ngay, dùng khi lỡ gửi nhầm người. */
export async function rotateParentShareToken(
  studentId: string,
): Promise<ParentShareLink> {
  const { data, error } = await getSupabase()
    .from("parent_share_links")
    .update({
      token: newToken(),
      rotated_at: new Date().toISOString(),
      last_viewed_at: null,
      view_count: 0,
    })
    .eq("student_id", studentId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ParentShareLink;
}

export async function setParentShareEnabled(
  studentId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from("parent_share_links")
    .update({ enabled })
    .eq("student_id", studentId);
  if (error) throw error;
}
