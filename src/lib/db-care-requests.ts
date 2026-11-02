"use client";

/**
 * PHIẾU CHĂM SÓC HỌC VIÊN (migration 0061).
 *
 * Phiếu nguồn "Điểm danh" do trigger DB tự mở khi học viên vắng từ 2 buổi
 * liên tiếp; ghi một lần liên hệ ở trang Vắng liên tiếp cũng tự đẩy phiếu
 * sang Đang xử lý / Đã xong. Các nguồn khác do nhân viên/giáo viên tạo tay.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";

export type CareStatus = "new" | "in_progress" | "done" | "cancelled";
export type CareSource = "attendance" | "test" | "homework" | "tuition" | "teacher" | "other";

export const CARE_STATUS_LABELS: Record<CareStatus, string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  done: "Đã xong",
  cancelled: "Huỷ",
};

export const CARE_SOURCE_LABELS: Record<CareSource, string> = {
  attendance: "Điểm danh",
  test: "Kiểm tra",
  homework: "Bài tập",
  tuition: "Học phí",
  teacher: "Giáo viên đề xuất",
  other: "Khác",
};

/** Hạn mặc định khi tạo tay: chừng này ngày kể từ hôm nay. */
export const CARE_DEFAULT_DUE_DAYS = 2;

export interface CareRequestRow {
  id: string;
  no: number;
  student_id: string;
  class_id: string | null;
  source: CareSource;
  issue: string;
  status: CareStatus;
  assignee_id: string | null;
  due_date: string | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  student: { id: string; name: string; student_code: string | null; phone: string | null } | null;
  class: { id: string; name: string; teacher: { id: string; name: string } | null } | null;
  assignee: { id: string; name: string } | null;
  creator: { id: string; name: string } | null;
}

const CARE_SELECT = `
  id, no, student_id, class_id, source, issue, status, assignee_id, due_date, note,
  created_at, resolved_at,
  student:profiles!care_requests_student_id_fkey ( id, name, student_code, phone ),
  class:classes ( id, name, teacher:profiles!classes_teacher_id_fkey ( id, name ) ),
  assignee:profiles!care_requests_assignee_id_fkey ( id, name ),
  creator:profiles!care_requests_created_by_fkey ( id, name )
`;

/** Mã hiển thị: YC0001. */
export function careCode(no: number): string {
  return `YC${String(no).padStart(4, "0")}`;
}

export function isCareOpen(s: CareStatus): boolean {
  return s === "new" || s === "in_progress";
}

/** Đang mở mà đã qua hạn (hạn là hết ngày `due_date`). */
export function isCareOverdue(r: Pick<CareRequestRow, "status" | "due_date">, today: string): boolean {
  return isCareOpen(r.status) && !!r.due_date && r.due_date < today;
}

/**
 * Phiếu theo chi nhánh đang xem. `openOnly` → chỉ phiếu Mới / Đang xử lý
 * (bảng điều khiển); không thì lấy cả phiếu đã đóng trong `closedDays` ngày.
 */
export async function fetchCareRequests(
  opts: { openOnly?: boolean; closedDays?: number } = {},
): Promise<CareRequestRow[]> {
  let q = branchFilter(getSupabase().from("care_requests").select(CARE_SELECT));
  if (opts.openOnly) {
    q = q.in("status", ["new", "in_progress"]);
  } else {
    const since = new Date(Date.now() - (opts.closedDays ?? 90) * 86_400_000).toISOString();
    q = q.or(`status.in.(new,in_progress),resolved_at.gte.${since}`);
  }
  const { data, error } = await q
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("no", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data as unknown as CareRequestRow[];
}

/** Số phiếu chưa ai nhận — chấm đỏ trên menu. */
export async function fetchNewCareCount(): Promise<number> {
  const { count, error } = await branchFilter(
    getSupabase().from("care_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
  );
  if (error) throw error;
  return count ?? 0;
}

export interface CareInput {
  student_id: string;
  class_id: string | null;
  source: CareSource;
  issue: string;
  assignee_id: string | null;
  due_date: string | null;
  status?: CareStatus;
  note?: string | null;
}

export async function createCareRequest(input: CareInput): Promise<void> {
  const { error } = await getSupabase().from("care_requests").insert({
    ...input,
    issue: input.issue.trim(),
    note: input.note?.trim() || null,
    // Giao cho ai đó ngay lúc tạo thì coi như đã có người nhận
    status: input.status ?? (input.assignee_id ? "in_progress" : "new"),
  });
  if (error) throw error;
}

export async function updateCareRequest(id: string, patch: Partial<CareInput>): Promise<void> {
  const { error } = await getSupabase().from("care_requests").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCareRequest(id: string): Promise<void> {
  const { error } = await getSupabase().from("care_requests").delete().eq("id", id);
  if (error) throw error;
}

export interface CarePerson {
  id: string;
  name: string;
}

/** Người nhận việc chăm sóc: hành chính, kế toán, quản lý của chi nhánh. */
export async function fetchCareAssignees(): Promise<CarePerson[]> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, name")
    .in("role", ["staff", "accountant", "admin"])
    .order("name");
  if (error) throw error;
  return data as CarePerson[];
}

export interface CareStudentOption {
  id: string;
  name: string;
  student_code: string | null;
  classes: { id: string; name: string }[];
}

/** Học viên đang học (kèm lớp đang theo) để chọn khi tạo phiếu. */
export async function fetchCareStudentOptions(): Promise<CareStudentOption[]> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("profiles")
      .select("id, name, student_code, study_status, class_students ( status, class:classes ( id, name, status ) )")
      .eq("role", "student"),
  ).order("name");
  if (error) throw error;
  return (data as unknown as {
    id: string;
    name: string;
    student_code: string | null;
    study_status: string | null;
    class_students: { status: string; class: { id: string; name: string; status: string } | null }[];
  }[])
    .filter((s) => s.study_status !== "left")
    .map((s) => ({
      id: s.id,
      name: s.name,
      student_code: s.student_code,
      classes: s.class_students
        .filter((c) => c.status === "active" && c.class && c.class.status === "active")
        .map((c) => ({ id: c.class!.id, name: c.class!.name })),
    }));
}
