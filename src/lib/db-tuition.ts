"use client";

/**
 * Data layer HỌC PHÍ GÓI BUỔI + CHẤM CÔNG GV (migration 0013).
 *
 * Số buổi còn lại KHÔNG lưu trong bảng mà tính ngược từ điểm danh
 * (view `package_balances`): present / absent_excused / absent_unexcused
 * trừ 1 buổi, makeup không trừ; nhiều gói trừ FIFO theo ngày kích hoạt.
 * View chạy security_invoker nên dùng chung cho admin (thấy tất cả)
 * và học viên/phụ huynh (RLS chỉ trả về gói của mình / của con).
 */

import { getSupabase } from "./supabase";
import { branchFilter, branchProfileIds } from "./branch";
import { todayISO } from "./db";

/* ============ Gói buổi & số dư ============ */

export interface PackageBalanceRow {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
  student_phone: string | null;
  name: string;
  total_sessions: number;
  price: number;
  /** Ưu đãi tiền mặt (VND) — trừ SAU phần %. */
  discount: number;
  final_price: number;
  start_date: string;
  note: string | null;
  created_at: string;
  used_sessions: number;
  remaining_sessions: number;
  paid_amount: number;
  debt: number;
  /* --- 0023: khóa học + ưu đãi kép --- */
  course_id: string | null;
  course_name: string | null;
  course_level: string | null;
  /** Ưu đãi theo % trên giá gốc. */
  discount_percent: number;
  /** Số tiền quy đổi từ `discount_percent`. */
  discount_amount: number;
  /** Tổng ưu đãi = discount_amount + discount. */
  discount_total: number;
}

/* ---- Ưu đãi kép: % tính trên giá gốc, rồi trừ tiếp ưu đãi tiền mặt ---- */

/** Số tiền quy đổi từ ưu đãi %. Làm tròn giống `round()` của Postgres. */
export function discountAmountOf(price: number, percent: number): number {
  return Math.round(((Number(price) || 0) * (Number(percent) || 0)) / 100);
}

/** Tổng ưu đãi (VND) từ % + tiền mặt. */
export function discountTotalOf(price: number, percent: number, cash: number): number {
  return discountAmountOf(price, percent) + (Number(cash) || 0);
}

/** Giá phải đóng sau cả hai loại ưu đãi. */
export function finalPriceOf(price: number, percent: number, cash: number): number {
  return Math.max(0, (Number(price) || 0) - discountTotalOf(price, percent, cash));
}

/** Toàn bộ gói active kèm số dư (trang admin). */
export async function fetchPackageBalances(): Promise<PackageBalanceRow[]> {
  // View không có cột branch_id (định nghĩa đổi theo từng migration nên
  // không nên viết lại nó) → lọc theo danh sách học viên của chi nhánh.
  const studentIds = await branchProfileIds("student");
  let q = getSupabase().from("package_balances").select("*");
  if (studentIds) q = q.in("student_id", studentIds);
  const { data, error } = await q.order("student_name").order("start_date");
  if (error) throw error;
  return data as PackageBalanceRow[];
}

/** Gói của một học viên (khu học viên / cổng phụ huynh — RLS lo quyền). */
export async function fetchStudentPackages(studentId: string): Promise<PackageBalanceRow[]> {
  const { data, error } = await getSupabase()
    .from("package_balances")
    .select("*")
    .eq("student_id", studentId)
    .order("start_date");
  if (error) throw error;
  return data as PackageBalanceRow[];
}

export interface CreatePackageInput {
  student_id: string;
  /** Chương trình bán ra (courses). Null = gói lẻ không gắn khóa. */
  course_id: string | null;
  name: string;
  total_sessions: number;
  price: number;
  /** Ưu đãi % trên giá gốc. */
  discount_percent: number;
  /** Ưu đãi tiền mặt, trừ sau phần %. */
  discount: number;
  start_date: string;
  note: string | null;
  created_by: string;
}

export async function createPackage(input: CreatePackageInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from("enrollment_packages")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Hủy gói (không xóa — giữ lịch sử thanh toán). */
export async function cancelPackage(id: string) {
  const { error } = await getSupabase()
    .from("enrollment_packages")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) throw error;
}

/* ============ Thanh toán & biên lai ============ */

export type PaymentMethod = "cash" | "transfer";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
};

export interface PaymentRow {
  id: string;
  package_id: string;
  student_id: string;
  amount: number;
  method: PaymentMethod;
  receipt_no: string;
  note: string | null;
  paid_at: string;
}

export async function addPayment(input: {
  package_id: string;
  student_id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  received_by: string;
}): Promise<PaymentRow> {
  const { data, error } = await getSupabase()
    .from("payments")
    .insert(input)
    .select("id, package_id, student_id, amount, method, receipt_no, note, paid_at")
    .single();
  if (error) throw error;
  return data as PaymentRow;
}

export async function fetchPackagePayments(packageId: string): Promise<PaymentRow[]> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("id, package_id, student_id, amount, method, receipt_no, note, paid_at")
    .eq("package_id", packageId)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data as PaymentRow[];
}

/** Toàn bộ lần đóng tiền của một học viên (trang học phí của học viên/PH). */
export async function fetchStudentPayments(studentId: string): Promise<PaymentRow[]> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("id, package_id, student_id, amount, method, receipt_no, note, paid_at")
    .eq("student_id", studentId)
    .order("paid_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as PaymentRow[];
}

/** Biên lai đầy đủ để in: thanh toán + gói + học viên + người thu. */
export interface ReceiptRow extends PaymentRow {
  student: { id: string; name: string; student_code: string | null; phone: string | null } | null;
  received_by_profile: { id: string; name: string } | null;
  package: {
    id: string;
    name: string;
    total_sessions: number;
    price: number;
    discount_percent: number;
    discount: number;
    start_date: string;
    course: { id: string; name: string; level: string | null } | null;
  } | null;
}

export async function fetchReceipt(paymentId: string): Promise<ReceiptRow | null> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select(`
      id, package_id, student_id, amount, method, receipt_no, note, paid_at,
      student:profiles!payments_student_id_fkey ( id, name, student_code, phone ),
      received_by_profile:profiles!payments_received_by_fkey ( id, name ),
      package:enrollment_packages (
        id, name, total_sessions, price, discount_percent, discount, start_date,
        course:courses ( id, name, level )
      )
    `)
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ReceiptRow | null;
}

/** Tổng tiền đã thu từ ngày `from` (thống kê nhanh trên trang học phí). */
export async function fetchPaymentsTotalSince(from: string): Promise<number> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("payments")
      .select("amount, package:enrollment_packages!inner ( student:profiles!inner ( id ) )")
      .gte("paid_at", from),
    "package.student.branch_id",
  );
  if (error) throw error;
  return (data as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount), 0);
}

export function fmtVND(n: number): string {
  return Number(n).toLocaleString("vi-VN") + " ₫";
}

/* ============ Chấm công ca dạy (migration 0018) ============ */

/**
 * 1 buổi = tối đa 1 bản ghi công. Giáo viên bấm "Chấm công" ở trang chủ
 * → ghi giờ dạy THỰC TẾ + nội dung bài học; trigger DB tự chuyển buổi
 * sang `completed`. Giờ theo lịch nằm ở sessions.start_time/end_time,
 * giờ thực tế nằm ở đây nên đối soát được khi lệch.
 */
export interface TeachingLogRow {
  id: string;
  session_id: string;
  teacher_id: string;
  checked_in_at: string;
  actual_start: string;
  actual_end: string;
  lesson_content: string | null;
  note: string | null;
}

export interface TeachingSessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  session_no: number | null;
  status: "scheduled" | "completed" | "cancelled";
  type: "regular" | "makeup";
  note: string | null;
  teacher: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  // PostgREST trả object (do unique session_id) nhưng phòng khi trả mảng
  teaching_log: TeachingLogRow | TeachingLogRow[] | null;
  attendance: { count: number }[];
}

const TEACHING_SELECT = `
  id, date, start_time, end_time, session_no, status, type, note,
  teacher:profiles!sessions_teacher_id_fkey ( id, name ),
  class:classes ( id, name ),
  room:rooms ( id, name ),
  teaching_log:teaching_logs ( id, session_id, teacher_id, checked_in_at, actual_start, actual_end, lesson_content, note ),
  attendance ( count )
`;

/** Bản ghi công của buổi (chuẩn hóa object/mảng do PostgREST trả về). */
export function pickLog(s: Pick<TeachingSessionRow, "teaching_log">): TeachingLogRow | null {
  const l = s.teaching_log;
  if (!l) return null;
  return Array.isArray(l) ? l[0] ?? null : l;
}

/** Số học viên đã điểm danh trong buổi. */
export function attendanceCount(s: Pick<TeachingSessionRow, "attendance">): number {
  return s.attendance?.[0]?.count ?? 0;
}

/**
 * Buổi dạy trong khoảng ngày kèm trạng thái chấm công.
 * `teacherId` → chỉ buổi giáo viên đó thực dạy (trang chủ GV);
 * `completedOnly` → bảng công tháng của hành chính;
 * `includeCancelled` → giữ cả buổi đã hủy (trang theo dõi theo ngày).
 */
export async function fetchTeachingSessions(
  from: string,
  to: string,
  opts: { teacherId?: string; completedOnly?: boolean; includeCancelled?: boolean } = {},
): Promise<TeachingSessionRow[]> {
  let q = getSupabase()
    .from("sessions")
    .select(TEACHING_SELECT)
    .gte("date", from)
    .lte("date", to);
  q = branchFilter(q);
  if (opts.teacherId) q = q.eq("teacher_id", opts.teacherId);
  if (opts.completedOnly) q = q.eq("status", "completed");
  else if (!opts.includeCancelled) q = q.neq("status", "cancelled");
  const { data, error } = await q.order("date").order("start_time").limit(3000);
  if (error) throw error;
  return data as unknown as TeachingSessionRow[];
}

/** Bản ghi công của một buổi (trang chi tiết buổi dạy). */
export async function fetchTeachingLog(sessionId: string): Promise<TeachingLogRow | null> {
  const { data, error } = await getSupabase()
    .from("teaching_logs")
    .select("id, session_id, teacher_id, checked_in_at, actual_start, actual_end, lesson_content, note")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as TeachingLogRow | null;
}

export interface SaveTeachingLogInput {
  sessionId: string;
  teacherId: string; // GV được tính công (giáo viên thực dạy buổi)
  actualStart: string; // HH:MM
  actualEnd: string; // HH:MM
  lessonContent: string;
  note?: string;
  createdBy: string; // người bấm nút
}

/** Chấm công buổi dạy (bấm lại = sửa lại giờ / nội dung). */
export async function saveTeachingLog(input: SaveTeachingLogInput): Promise<void> {
  const { error } = await getSupabase()
    .from("teaching_logs")
    .upsert(
      {
        session_id: input.sessionId,
        teacher_id: input.teacherId,
        actual_start: input.actualStart,
        actual_end: input.actualEnd,
        lesson_content: input.lessonContent.trim() || null,
        note: input.note?.trim() || null,
        created_by: input.createdBy,
      },
      { onConflict: "session_id" },
    );
  if (error) throw error;
}

/** Số giờ của một buổi (end - start), làm tròn 0.25h. */
export function sessionHours(s: { start_time: string; end_time: string }): number {
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  return Math.round(((eh * 60 + em - sh * 60 - sm) / 60) * 4) / 4;
}

/** Số giờ tính công: ưu tiên giờ thực tế đã chấm, chưa chấm thì lấy giờ lịch. */
export function payHours(s: TeachingSessionRow): number {
  const log = pickLog(s);
  return log
    ? sessionHours({ start_time: log.actual_start, end_time: log.actual_end })
    : sessionHours(s);
}

/** Ngày đầu tháng hiện tại (giờ địa phương) dạng YYYY-MM-DD. */
export function firstOfMonthISO(): string {
  return todayISO().slice(0, 8) + "01";
}
