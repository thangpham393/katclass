"use client";

/**
 * Data layer HỌC VIÊN BÁO NGHỈ & ĐĂNG KÝ HỌC BÙ (migration 0029).
 *
 * Luồng: học viên (hoặc phụ huynh) gửi đơn xin nghỉ cho một buổi sắp tới,
 * kèm ca học bù mong muốn → hành chính duyệt ở /admin/makeup → trigger DB
 * tự điểm danh "vắng có phép" cho buổi đó → trigger cũ sinh lượt học bù →
 * hành chính xếp bù như thường (thấy sẵn ca học viên muốn học).
 *
 * Học viên KHÔNG ghi thẳng vào attendance hay makeup_credits: đơn chỉ là
 * đơn, mọi thay đổi lịch vẫn do trung tâm chốt.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";

export type AbsenceStatus = "pending" | "approved" | "rejected" | "cancelled";

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Không duyệt",
  cancelled: "Đã rút đơn",
};

export interface AbsenceRequestRow {
  id: string;
  student_id: string;
  session_id: string;
  reason: string | null;
  preferred_session_id: string | null;
  status: AbsenceStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  student: { id: string; name: string; avatar: string | null; student_code: string | null } | null;
  session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
  preferred_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
}

const ABSENCE_SELECT = `
  id, student_id, session_id, reason, preferred_session_id, status,
  resolution_note, resolved_at, created_at,
  student:profiles!student_absence_requests_student_id_fkey!inner ( id, name, avatar, student_code ),
  session:sessions!student_absence_requests_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) ),
  preferred_session:sessions!student_absence_requests_preferred_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) )
`;

/** Đơn của một học viên (khu học viên / cổng phụ huynh). */
export async function fetchMyAbsenceRequests(studentId: string): Promise<AbsenceRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("student_absence_requests")
    .select(ABSENCE_SELECT)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as AbsenceRequestRow[];
}

/** Đơn theo trạng thái cho hành chính (lọc theo chi nhánh đang xem). */
export async function fetchAbsenceRequests(
  statuses: AbsenceStatus[],
): Promise<AbsenceRequestRow[]> {
  const { data, error } = await branchFilter(
    getSupabase().from("student_absence_requests").select(ABSENCE_SELECT).in("status", statuses),
    "student.branch_id",
  )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as unknown as AbsenceRequestRow[];
}

/** Số đơn xin nghỉ đang chờ duyệt (badge menu + thẻ trang học bù). */
export async function fetchPendingAbsenceCount(): Promise<number> {
  const { count, error } = await branchFilter(
    getSupabase()
      .from("student_absence_requests")
      .select("id, student:profiles!student_absence_requests_student_id_fkey!inner ( id )", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),
    "student.branch_id",
  );
  if (error) throw error;
  return count ?? 0;
}

export async function createAbsenceRequest(input: {
  student_id: string;
  session_id: string;
  reason: string | null;
  preferred_session_id: string | null;
}): Promise<void> {
  const { error } = await getSupabase().from("student_absence_requests").insert(input);
  if (error) throw error;
}

/** Học viên rút đơn khi còn chờ duyệt. */
export async function cancelAbsenceRequest(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("student_absence_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

/** Hành chính chốt đơn — duyệt thì trigger tự điểm danh vắng có phép. */
export async function resolveAbsenceRequest(
  id: string,
  status: "approved" | "rejected",
  note: string | null,
  resolvedBy: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("student_absence_requests")
    .update({
      status,
      resolution_note: note?.trim() || null,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

/* ============ Ca học bù có thể chọn ============ */

export interface AvailableSessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_name: string;
  course_name: string | null;
  level: string | null;
  teacher_name: string | null;
  room_name: string | null;
  class_size: number;
}

/**
 * Các buổi sắp tới học viên được phép chọn làm ca bù. Học viên không đọc
 * được bảng sessions của lớp khác (RLS), nên đi qua hàm
 * `available_makeup_sessions` — chỉ trả về đúng các cột cần để chọn ca.
 */
export async function fetchAvailableMakeupSessions(
  studentId: string,
  days = 30,
): Promise<AvailableSessionRow[]> {
  const { data, error } = await getSupabase().rpc("available_makeup_sessions", {
    sid: studentId,
    days,
  });
  if (error) throw error;
  return (data ?? []) as AvailableSessionRow[];
}

/* ============ Lượt học bù của học viên ============ */

export interface MyMakeupCreditRow {
  id: string;
  status: "pending" | "scheduled" | "attended" | "expired" | "cancelled";
  note: string | null;
  created_at: string;
  missed_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
  makeup_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
  preferred_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
}

const MY_MAKEUP_SELECT = `
  id, status, note, created_at,
  missed_session:sessions!makeup_credits_missed_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) ),
  makeup_session:sessions!makeup_credits_makeup_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) ),
  preferred_session:sessions!makeup_credits_preferred_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) )
`;

/** Lượt học bù của chính học viên (RLS lo quyền). */
export async function fetchMyMakeupCredits(studentId: string): Promise<MyMakeupCreditRow[]> {
  const { data, error } = await getSupabase()
    .from("makeup_credits")
    .select(MY_MAKEUP_SELECT)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as MyMakeupCreditRow[];
}

/** Số lượt học bù của học viên còn chờ xếp (badge menu "Đăng ký học bù"). */
export async function fetchMyPendingMakeupCount(studentId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("makeup_credits")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

/** Học viên chọn ca bù mong muốn cho một lượt đang chờ xếp. */
export async function proposeMakeupSlot(creditId: string, sessionId: string | null): Promise<void> {
  const { error } = await getSupabase().rpc("propose_makeup_slot", {
    credit: creditId,
    sess: sessionId,
  });
  if (error) throw error;
}
