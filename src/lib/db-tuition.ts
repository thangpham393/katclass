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
  discount: number;
  final_price: number;
  start_date: string;
  note: string | null;
  created_at: string;
  used_sessions: number;
  remaining_sessions: number;
  paid_amount: number;
  debt: number;
}

/** Toàn bộ gói active kèm số dư (trang admin). */
export async function fetchPackageBalances(): Promise<PackageBalanceRow[]> {
  const { data, error } = await getSupabase()
    .from("package_balances")
    .select("*")
    .order("student_name")
    .order("start_date");
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
  name: string;
  total_sessions: number;
  price: number;
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

/** Biên lai đầy đủ để in: thanh toán + gói + học viên + người thu. */
export interface ReceiptRow extends PaymentRow {
  student: { id: string; name: string; student_code: string | null; phone: string | null } | null;
  received_by_profile: { id: string; name: string } | null;
  package: { id: string; name: string; total_sessions: number; price: number; discount: number; start_date: string } | null;
}

export async function fetchReceipt(paymentId: string): Promise<ReceiptRow | null> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select(`
      id, package_id, student_id, amount, method, receipt_no, note, paid_at,
      student:profiles!payments_student_id_fkey ( id, name, student_code, phone ),
      received_by_profile:profiles!payments_received_by_fkey ( id, name ),
      package:enrollment_packages ( id, name, total_sessions, price, discount, start_date )
    `)
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ReceiptRow | null;
}

/** Tổng tiền đã thu từ ngày `from` (thống kê nhanh trên trang học phí). */
export async function fetchPaymentsTotalSince(from: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("amount")
    .gte("paid_at", from);
  if (error) throw error;
  return (data as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount), 0);
}

export function fmtVND(n: number): string {
  return Number(n).toLocaleString("vi-VN") + " ₫";
}

/* ============ Chấm công giáo viên ============ */

export interface TeachingSessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: "regular" | "makeup";
  teacher: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
}

/**
 * Buổi đã hoàn thành trong khoảng ngày (chấm công: 1 buổi completed
 * có GV thực dạy = 1 công). Gom nhóm theo GV làm ở phía client.
 */
export async function fetchCompletedSessions(from: string, to: string): Promise<TeachingSessionRow[]> {
  const { data, error } = await getSupabase()
    .from("sessions")
    .select(`
      id, date, start_time, end_time, type,
      teacher:profiles!sessions_teacher_id_fkey ( id, name ),
      class:classes ( id, name )
    `)
    .eq("status", "completed")
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time")
    .limit(3000);
  if (error) throw error;
  return data as unknown as TeachingSessionRow[];
}

/** Số giờ của một buổi (end - start), làm tròn 0.25h. */
export function sessionHours(s: { start_time: string; end_time: string }): number {
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  return Math.round(((eh * 60 + em - sh * 60 - sm) / 60) * 4) / 4;
}

/** Ngày đầu tháng hiện tại (giờ địa phương) dạng YYYY-MM-DD. */
export function firstOfMonthISO(): string {
  return todayISO().slice(0, 8) + "01";
}
