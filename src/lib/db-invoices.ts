"use client";

/**
 * HOÁ ĐƠN (migration 0033).
 *
 * Lập được cho khách hàng tiềm năng (chưa là học viên) lẫn học viên đã
 * ghi danh. Tổng tiền KHÔNG lưu trong bảng: tính từ `items` + `discount`
 * để sửa một dòng là mọi con số tự khớp, không bao giờ lệch với chi tiết.
 */

import { getSupabase } from "./supabase";
import type { PaymentMethod } from "./db-tuition";

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  course_id?: string | null;
}

export interface InvoiceRow {
  id: string;
  invoice_no: string;
  branch_id: string | null;
  lead_id: string | null;
  student_id: string | null;
  customer_name: string;
  student_name: string | null;
  phone: string | null;
  issued_on: string;
  due_on: string | null;
  method: PaymentMethod;
  items: InvoiceItem[];
  discount: number;
  paid_amount: number;
  note: string | null;
  bank_info: string | null;
  terms: string | null;
  /* --- 0035: kế hoạch học in trên tờ hoá đơn --- */
  total_sessions: number | null;
  start_date: string | null;
  sessions_per_week: number | null;
  end_date: string | null;
  /** Gói buổi sinh ra từ hoá đơn này (chỉ có khi khách đã là học viên). */
  package_id: string | null;
  created_at: string;
}

export interface InvoiceInput {
  invoice_no: string;
  branch_id: string | null;
  lead_id?: string | null;
  student_id?: string | null;
  customer_name: string;
  student_name?: string | null;
  phone?: string | null;
  issued_on: string;
  due_on?: string | null;
  method: PaymentMethod;
  items: InvoiceItem[];
  discount: number;
  paid_amount: number;
  note?: string | null;
  bank_info?: string | null;
  terms?: string | null;
  total_sessions?: number | null;
  start_date?: string | null;
  sessions_per_week?: number | null;
  end_date?: string | null;
  package_id?: string | null;
}

const SELECT =
  "id, invoice_no, branch_id, lead_id, student_id, customer_name, student_name, phone, issued_on, due_on, method, items, discount, paid_amount, note, bank_info, terms, total_sessions, start_date, sessions_per_week, end_date, package_id, created_at";

/* ============ Tính tiền ============ */

export function lineTotal(item: InvoiceItem): number {
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

/** Tổng cần đóng = tiền hàng − giảm giá (không âm). */
export function invoiceTotal(items: InvoiceItem[], discount: number): number {
  const sub = items.reduce((s, i) => s + lineTotal(i), 0);
  return Math.max(0, sub - (Number(discount) || 0));
}

export function invoiceDebt(inv: Pick<InvoiceRow, "items" | "discount" | "paid_amount">): number {
  return invoiceTotal(inv.items, Number(inv.discount)) - (Number(inv.paid_amount) || 0);
}

export type InvoiceStatus = "unpaid" | "partial" | "paid";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
};

export function invoiceStatus(inv: Pick<InvoiceRow, "items" | "discount" | "paid_amount">): InvoiceStatus {
  const debt = invoiceDebt(inv);
  if (debt <= 0) return "paid";
  return Number(inv.paid_amount) > 0 ? "partial" : "unpaid";
}

/* ============ Đọc / ghi ============ */

/** Số hoá đơn kế tiếp (INV0001…) — chốt cuối vẫn là unique index. */
export async function nextInvoiceNo(): Promise<string> {
  const { data, error } = await getSupabase().rpc("next_invoice_no");
  if (error) throw error;
  return (data as string) ?? "INV0001";
}

export async function fetchLeadInvoices(leadId: string): Promise<InvoiceRow[]> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select(SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

export async function fetchStudentInvoices(studentId: string): Promise<InvoiceRow[]> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select(SELECT)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

/** Mọi hoá đơn (trang Hoá đơn) — mới nhất trước. */
export async function fetchInvoices(limit = 300): Promise<InvoiceRow[]> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select(SELECT)
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

export async function createInvoice(input: InvoiceInput, createdBy?: string | null): Promise<string> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .insert({
      invoice_no: input.invoice_no.trim(),
      branch_id: input.branch_id,
      lead_id: input.lead_id ?? null,
      student_id: input.student_id ?? null,
      customer_name: input.customer_name.trim(),
      student_name: input.student_name?.trim() || null,
      phone: input.phone?.trim() || null,
      issued_on: input.issued_on,
      due_on: input.due_on || null,
      method: input.method,
      items: input.items
        .filter((i) => i.name.trim() || lineTotal(i) > 0)
        .map((i) => ({
          name: i.name.trim(),
          qty: Number(i.qty) || 0,
          price: Number(i.price) || 0,
          course_id: i.course_id ?? null,
        })),
      discount: Number(input.discount) || 0,
      paid_amount: Number(input.paid_amount) || 0,
      note: input.note?.trim() || null,
      bank_info: input.bank_info?.trim() || null,
      terms: input.terms?.trim() || null,
      total_sessions: input.total_sessions ?? null,
      start_date: input.start_date || null,
      sessions_per_week: input.sessions_per_week ?? null,
      end_date: input.end_date || null,
      package_id: input.package_id ?? null,
      created_by: createdBy || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Sửa số tiền đã thu (thu thêm ở quầy) — phần còn lại giữ nguyên. */
export async function setInvoicePaid(id: string, paid: number) {
  const { error } = await getSupabase()
    .from("invoices")
    .update({ paid_amount: Number(paid) || 0, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(id: string) {
  const { error } = await getSupabase().from("invoices").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Thông tin chuyển khoản dùng lần trước của chi nhánh — điền sẵn cho tờ
 * mới để nhân viên không phải gõ lại số tài khoản mỗi lần.
 */
export async function lastBankInfo(branchId: string | null): Promise<string | null> {
  let q = getSupabase()
    .from("invoices")
    .select("bank_info")
    .not("bank_info", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data?.[0] as { bank_info: string | null } | undefined)?.bank_info ?? null;
}
