"use client";

/**
 * Data layer GV ĐĂNG KÝ NGHỈ / ĐỀ XUẤT ĐỔI BUỔI (migration 0015).
 *
 * Luồng: GV tạo yêu cầu cho một buổi mình dạy ('leave' xin nghỉ,
 * 'reschedule' đề xuất ngày/giờ mới) → admin duyệt ở /admin/requests:
 * xếp GV dạy thay / hủy buổi / áp lịch mới (cập nhật buổi học TRƯỚC,
 * chốt yêu cầu SAU — nếu trùng lịch GV/phòng thì lỗi 23P01 nổ ngay ở
 * bước cập nhật buổi, yêu cầu vẫn còn pending để xử lý lại).
 * Thông báo cho admin/GV/HV/PH do trigger DB tự sinh.
 */

import { getSupabase } from "./supabase";

export type ChangeRequestType = "leave" | "reschedule";
export type ChangeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ChangeRequestResolution = "substitute" | "cancel_session" | "reschedule";

export const REQUEST_TYPE_LABELS: Record<ChangeRequestType, string> = {
  leave: "Xin nghỉ buổi dạy",
  reschedule: "Đề xuất đổi buổi",
};

export const REQUEST_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã rút",
};

export const RESOLUTION_LABELS: Record<ChangeRequestResolution, string> = {
  substitute: "Xếp GV dạy thay",
  cancel_session: "Hủy buổi học",
  reschedule: "Đổi sang lịch mới",
};

export interface ChangeRequestRow {
  id: string;
  session_id: string;
  type: ChangeRequestType;
  reason: string | null;
  proposed_date: string | null;
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  status: ChangeRequestStatus;
  resolution: ChangeRequestResolution | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  teacher: { id: string; name: string } | null;
  substitute_teacher: { id: string; name: string } | null;
  session: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    class: { id: string; name: string } | null;
  } | null;
}

const REQUEST_SELECT = `
  id, session_id, type, reason, proposed_date, proposed_start_time, proposed_end_time,
  status, resolution, resolution_note, resolved_at, created_at,
  teacher:profiles!session_change_requests_teacher_id_fkey ( id, name ),
  substitute_teacher:profiles!session_change_requests_substitute_teacher_id_fkey ( id, name ),
  session:sessions ( id, date, start_time, end_time, status, class:classes ( id, name ) )
`;

/** Yêu cầu của một GV (trang /teacher/requests). */
export async function fetchMyChangeRequests(teacherId: string): Promise<ChangeRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("session_change_requests")
    .select(REQUEST_SELECT)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as ChangeRequestRow[];
}

/** Yêu cầu theo trạng thái (trang admin). */
export async function fetchChangeRequests(
  statuses: ChangeRequestStatus[],
): Promise<ChangeRequestRow[]> {
  const { data, error } = await getSupabase()
    .from("session_change_requests")
    .select(REQUEST_SELECT)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as unknown as ChangeRequestRow[];
}

export interface CreateChangeRequestInput {
  session_id: string;
  teacher_id: string;
  type: ChangeRequestType;
  reason: string | null;
  proposed_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
}

/** GV gửi yêu cầu — trigger DB tự báo admin/staff. */
export async function createChangeRequest(input: CreateChangeRequestInput) {
  const { error } = await getSupabase().from("session_change_requests").insert(input);
  if (error) throw error;
}

/** GV rút yêu cầu khi còn chờ duyệt. */
export async function cancelChangeRequest(id: string) {
  const { error } = await getSupabase()
    .from("session_change_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

/* ============ Admin duyệt ============ */

/** Chốt yêu cầu sau khi đã cập nhật buổi học (trigger báo GV + HV/PH). */
async function resolveRequest(
  id: string,
  patch: {
    status: "approved" | "rejected";
    resolution?: ChangeRequestResolution;
    substitute_teacher_id?: string;
    resolution_note: string | null;
    resolved_by: string;
  },
) {
  const { error } = await getSupabase()
    .from("session_change_requests")
    .update({ ...patch, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
}

/** Duyệt xin nghỉ: gán GV dạy thay cho buổi (23P01 nếu GV thay trùng lịch). */
export async function approveWithSubstitute(
  req: ChangeRequestRow,
  substituteTeacherId: string,
  note: string | null,
  resolvedBy: string,
) {
  const { error } = await getSupabase()
    .from("sessions")
    .update({ teacher_id: substituteTeacherId })
    .eq("id", req.session_id);
  if (error) throw error;
  await resolveRequest(req.id, {
    status: "approved",
    resolution: "substitute",
    substitute_teacher_id: substituteTeacherId,
    resolution_note: note,
    resolved_by: resolvedBy,
  });
}

/** Duyệt xin nghỉ: hủy buổi học (trigger tự báo HV/PH buổi bị hủy). */
export async function approveCancelSession(
  req: ChangeRequestRow,
  note: string | null,
  resolvedBy: string,
) {
  const { error } = await getSupabase()
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", req.session_id);
  if (error) throw error;
  await resolveRequest(req.id, {
    status: "approved",
    resolution: "cancel_session",
    resolution_note: note,
    resolved_by: resolvedBy,
  });
}

/** Duyệt đổi buổi: áp ngày/giờ đề xuất vào buổi (trigger tự báo HV/PH). */
export async function approveReschedule(
  req: ChangeRequestRow,
  note: string | null,
  resolvedBy: string,
) {
  if (!req.proposed_date || !req.proposed_start_time || !req.proposed_end_time) {
    throw new Error("Yêu cầu không có lịch đề xuất.");
  }
  const { error } = await getSupabase()
    .from("sessions")
    .update({
      date: req.proposed_date,
      start_time: req.proposed_start_time,
      end_time: req.proposed_end_time,
    })
    .eq("id", req.session_id);
  if (error) throw error;
  await resolveRequest(req.id, {
    status: "approved",
    resolution: "reschedule",
    resolution_note: note,
    resolved_by: resolvedBy,
  });
}

/** Từ chối yêu cầu (buổi học giữ nguyên). */
export async function rejectChangeRequest(id: string, note: string | null, resolvedBy: string) {
  await resolveRequest(id, { status: "rejected", resolution_note: note, resolved_by: resolvedBy });
}

/** Số yêu cầu chờ duyệt (badge trên dashboard admin). */
export async function fetchPendingRequestCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("session_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}
