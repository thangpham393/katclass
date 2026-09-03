"use client";

/**
 * SỔ THU CHI (migration 0034) + gộp doanh thu học phí.
 *
 * Doanh thu của trung tâm đến từ HAI nguồn và cố ý không nhập chung một
 * bảng: học phí là `payments` (đã có biên lai, đã trừ vào gói buổi), còn
 * bán sách / học cụ / phí thi là `finance_entries`. Ở đây hai nguồn được
 * quy về cùng một kiểu `MoneyRow` để trang Doanh thu chỉ phải hiển thị
 * một loại dòng, và tiền học phí thì không bao giờ phải gõ tay lần nữa.
 */

import { getSupabase } from "./supabase";
import { branchFilter, branchStamp } from "./branch";
import type { PaymentMethod } from "./db-tuition";

/* ============ Nhóm khoản thu / khoản chi ============ */

export type FinanceKind = "revenue" | "expense";

/** Nhóm khoản thu ngoài học phí. `tuition` là nhóm ảo: sinh từ `payments`. */
export const REVENUE_CATEGORIES = {
  supplies: "Học cụ",
  books: "Sách & giáo trình",
  exam: "Lệ phí thi",
  other: "Thu khác",
} as const;

export const EXPENSE_CATEGORIES = {
  salary: "Lương & tiền công",
  rent: "Mặt bằng",
  marketing: "Marketing",
  supplies: "Vật tư & học cụ",
  utilities: "Điện nước & vận hành",
  other: "Chi khác",
} as const;

export type RevenueCategory = keyof typeof REVENUE_CATEGORIES;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

/** Nhãn của một nhóm, kể cả nhóm ảo `tuition`. */
export function categoryLabel(kind: FinanceKind, key: string): string {
  if (kind === "revenue") {
    if (key === "tuition") return "Học phí";
    return (REVENUE_CATEGORIES as Record<string, string>)[key] ?? key;
  }
  return (EXPENSE_CATEGORIES as Record<string, string>)[key] ?? key;
}

export function categoryOptions(kind: FinanceKind): { key: string; label: string }[] {
  const src = kind === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  return Object.entries(src).map(([key, label]) => ({ key, label }));
}

/* ============ Dòng tiền dùng chung cho bảng & biểu đồ ============ */

export interface MoneyRow {
  id: string;
  kind: FinanceKind;
  /** `payment` = học phí lấy từ biên lai, `entry` = dòng nhập tay. */
  source: "payment" | "entry";
  /** YYYY-MM-DD. */
  date: string;
  category: string;
  /** Diễn giải: tên học viên + gói, hoặc tiêu đề khoản nhập tay. */
  title: string;
  subtitle: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
}

export interface FinanceEntryRow {
  id: string;
  branch_id: string | null;
  kind: FinanceKind;
  category: string;
  amount: number;
  occurred_on: string;
  method: PaymentMethod;
  title: string;
  note: string | null;
  created_at: string;
}

export interface FinanceEntryInput {
  kind: FinanceKind;
  category: string;
  amount: number;
  occurred_on: string;
  method: PaymentMethod;
  title: string;
  note?: string | null;
}

const ENTRY_SELECT =
  "id, branch_id, kind, category, amount, occurred_on, method, title, note, created_at";

/* ---- Sổ nhập tay ---- */

export async function fetchFinanceEntries(
  kind: FinanceKind,
  from: string,
  to: string,
): Promise<FinanceEntryRow[]> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("finance_entries")
      .select(ENTRY_SELECT)
      .eq("kind", kind)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false })
      .limit(2000),
  );
  if (error) throw error;
  return (data ?? []) as FinanceEntryRow[];
}

export async function createFinanceEntry(input: FinanceEntryInput, createdBy?: string | null) {
  const { error } = await getSupabase()
    .from("finance_entries")
    .insert({
      ...branchStamp(),
      kind: input.kind,
      category: input.category,
      amount: Math.round(Number(input.amount) || 0),
      occurred_on: input.occurred_on,
      method: input.method,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      created_by: createdBy || null,
    });
  if (error) throw error;
}

export async function updateFinanceEntry(id: string, input: FinanceEntryInput) {
  const { error } = await getSupabase()
    .from("finance_entries")
    .update({
      kind: input.kind,
      category: input.category,
      amount: Math.round(Number(input.amount) || 0),
      occurred_on: input.occurred_on,
      method: input.method,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFinanceEntry(id: string) {
  const { error } = await getSupabase().from("finance_entries").delete().eq("id", id);
  if (error) throw error;
}

/* ---- Học phí đã thu (payments) ---- */

interface PaymentJoin {
  id: string;
  amount: number;
  method: PaymentMethod;
  receipt_no: string;
  note: string | null;
  paid_at: string;
  package: {
    name: string;
    course: { name: string } | null;
    student: { name: string; branch_id: string | null } | null;
  } | null;
}

/**
 * Học phí thu được trong khoảng ngày. `payments` không có cột branch_id
 * nên lọc chi nhánh đi vòng qua hồ sơ học viên của gói.
 *
 * `profiles!student_id` là bắt buộc: `enrollment_packages` trỏ sang
 * `profiles` bằng HAI khóa ngoại (student_id và created_by) nên nếu không
 * chỉ đích danh cột, PostgREST không biết nối theo đường nào và trả về
 * "more than one relationship was found".
 */
export async function fetchTuitionRevenue(from: string, to: string): Promise<MoneyRow[]> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("payments")
      .select(
        "id, amount, method, receipt_no, note, paid_at, package:enrollment_packages!inner ( name, course:courses ( name ), student:profiles!student_id!inner ( name, branch_id ) )",
      )
      .gte("paid_at", from + "T00:00:00")
      .lte("paid_at", to + "T23:59:59")
      .order("paid_at", { ascending: false })
      .limit(3000),
    "package.student.branch_id",
  );
  if (error) throw error;
  return ((data ?? []) as unknown as PaymentJoin[]).map((p) => ({
    id: p.id,
    kind: "revenue" as const,
    source: "payment" as const,
    date: p.paid_at.slice(0, 10),
    category: "tuition",
    title: p.package?.student?.name ?? "—",
    subtitle: p.package?.course?.name ?? p.package?.name ?? null,
    amount: Number(p.amount) || 0,
    method: p.method,
    note: p.note ?? p.receipt_no,
  }));
}

function entryToRow(e: FinanceEntryRow): MoneyRow {
  return {
    id: e.id,
    kind: e.kind,
    source: "entry",
    date: e.occurred_on,
    category: e.category,
    title: e.title,
    subtitle: categoryLabel(e.kind, e.category),
    amount: Number(e.amount) || 0,
    method: e.method,
    note: e.note,
  };
}

/** Toàn bộ tiền vào (học phí + khoản thu khác) trong khoảng ngày. */
export async function fetchRevenueRows(from: string, to: string): Promise<MoneyRow[]> {
  const [tuition, entries] = await Promise.all([
    fetchTuitionRevenue(from, to),
    fetchFinanceEntries("revenue", from, to),
  ]);
  return [...tuition, ...entries.map(entryToRow)].sort((a, b) => b.date.localeCompare(a.date));
}

/** Toàn bộ tiền ra trong khoảng ngày. */
export async function fetchExpenseRows(from: string, to: string): Promise<MoneyRow[]> {
  const entries = await fetchFinanceEntries("expense", from, to);
  return entries.map(entryToRow);
}

/* ============ Cộng dồn ============ */

export function sumAmount(rows: { amount: number }[]): number {
  return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

/** Cộng theo nhóm, nhóm nhiều tiền nhất lên trước. */
export function sumByCategory(rows: MoneyRow[]): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** 12 ô tháng của một năm (index 0 = tháng 1). */
export function sumByMonth(rows: MoneyRow[], year: number): number[] {
  const out = Array(12).fill(0) as number[];
  for (const r of rows) {
    if (Number(r.date.slice(0, 4)) !== year) continue;
    const m = Number(r.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) out[m] += r.amount;
  }
  return out;
}

/** Từng ngày của một tháng (index 0 = ngày 1). */
export function sumByDay(rows: MoneyRow[], year: number, month: number): number[] {
  const days = new Date(year, month, 0).getDate();
  const out = Array(days).fill(0) as number[];
  for (const r of rows) {
    const d = new Date(r.date + "T00:00:00");
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    out[d.getDate() - 1] += r.amount;
  }
  return out;
}

/* ============ Khoảng ngày của bộ lọc ============ */

/** Ngày đầu / ngày cuối của kỳ đang xem. `month = 0` nghĩa là cả năm. */
export function periodRange(year: number, month: number): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  if (!month) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${p(month)}-01`, to: `${year}-${p(month)}-${p(last)}` };
}

/* ============ Xuất Excel (CSV) ============ */

/**
 * CSV cho kế toán. Có BOM UTF-8 vì Excel bản Việt mở file không BOM là
 * ra tiếng Việt lỗi font; ngăn cách bằng dấu chấm phẩy cho khớp với máy
 * dùng dấu phẩy làm dấu thập phân.
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
