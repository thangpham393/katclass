"use client";

/**
 * Data layer THÔNG BÁO IN-APP (migration 0013).
 * Thông báo do trigger DB tự sinh: bài tập mới, xếp học bù,
 * con vắng mặt (gửi phụ huynh), gói buổi sắp hết.
 * RLS: ai nhận người đó đọc/đánh dấu đã đọc.
 */

import { getSupabase } from "./supabase";

export type NotificationType =
  | "homework_new"
  | "makeup_scheduled"
  | "child_absent"
  | "package_low"
  | "schedule_change" // buổi học đổi lịch / hủy / đổi GV (HV + PH)
  | "request_new" // GV gửi yêu cầu nghỉ/đổi buổi (admin/staff)
  | "request_resolved" // kết quả duyệt yêu cầu (GV)
  | "generic";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(profileId: string, limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await getSupabase()
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("recipient_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as NotificationRow[];
}

export async function fetchUnreadCount(profileId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", profileId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(profileId: string) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profileId)
    .is("read_at", null);
  if (error) throw error;
}
