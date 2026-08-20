"use client";

/**
 * Data layer TIỀN CÔNG GIÁO VIÊN (migration 0019).
 *
 * 2 loại giáo viên:
 *   - 'visiting'  (thỉnh giảng): tiền theo TỪNG BUỔI dạy, mức tiền tra theo
 *     SĨ SỐ LỚP trong bảng bậc thang `teacher_pay_tiers`.
 *   - 'fulltime': lương cứng tháng + tiền vượt giờ khi tổng giờ dạy trong
 *     tháng vượt `standard_hours`.
 *
 * Tiền công KHÔNG lưu sẵn — tính lại từ buổi dạy đã hoàn thành trong tháng
 * và mức lương hiện hành (đổi mức lương thì bảng công tháng cũ cũng đổi theo).
 */

import { getSupabase } from "./supabase";
import { payHours, pickLog, type TeachingSessionRow } from "./db-tuition";

export type PayType = "visiting" | "fulltime";

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  visiting: "Thỉnh giảng",
  fulltime: "Full time",
};

export interface PayProfileRow {
  teacher_id: string;
  pay_type: PayType;
  base_salary: number;
  standard_hours: number;
  overtime_rate: number;
  note: string | null;
  updated_at: string;
}

export interface PayTierRow {
  id: string;
  teacher_id: string;
  min_students: number;
  max_students: number | null;
  amount: number;
}

/** Bậc thang gợi ý khi thiết lập lần đầu cho GV thỉnh giảng. */
export const DEFAULT_TIERS: Omit<PayTierRow, "id" | "teacher_id">[] = [
  { min_students: 1, max_students: 2, amount: 150000 },
  { min_students: 3, max_students: 5, amount: 200000 },
  { min_students: 6, max_students: null, amount: 250000 },
];

export async function fetchPayProfiles(): Promise<PayProfileRow[]> {
  const { data, error } = await getSupabase().from("teacher_pay_profiles").select("*");
  if (error) throw error;
  return data as PayProfileRow[];
}

export async function fetchPayTiers(): Promise<PayTierRow[]> {
  const { data, error } = await getSupabase()
    .from("teacher_pay_tiers")
    .select("*")
    .order("min_students");
  if (error) throw error;
  return data as PayTierRow[];
}

export interface SavePayInput {
  teacherId: string;
  payType: PayType;
  baseSalary: number;
  standardHours: number;
  overtimeRate: number;
  note: string;
  tiers: { min_students: number; max_students: number | null; amount: number }[];
}

/** Lưu mức lương của một GV (ghi đè toàn bộ bậc thang). */
export async function savePayConfig(input: SavePayInput): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("teacher_pay_profiles").upsert(
    {
      teacher_id: input.teacherId,
      pay_type: input.payType,
      base_salary: input.baseSalary,
      standard_hours: input.standardHours,
      overtime_rate: input.overtimeRate,
      note: input.note.trim() || null,
    },
    { onConflict: "teacher_id" },
  );
  if (error) throw error;

  const { error: delErr } = await supabase
    .from("teacher_pay_tiers")
    .delete()
    .eq("teacher_id", input.teacherId);
  if (delErr) throw delErr;

  if (input.payType === "visiting" && input.tiers.length) {
    const { error: insErr } = await supabase.from("teacher_pay_tiers").insert(
      input.tiers.map((t) => ({ ...t, teacher_id: input.teacherId })),
    );
    if (insErr) throw insErr;
  }
}

/** Sĩ số hiện tại của mọi lớp: class_id → số HV đang active. */
export async function fetchClassSizes(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from("class_students")
    .select("class_id")
    .eq("status", "active")
    .limit(10000);
  if (error) throw error;
  const sizes: Record<string, number> = {};
  for (const r of data as { class_id: string }[]) {
    sizes[r.class_id] = (sizes[r.class_id] ?? 0) + 1;
  }
  return sizes;
}

/* ============ Tính tiền ============ */

/** Số HV dùng để tra bậc: sĩ số lớp; buổi bù riêng lấy số HV đã điểm danh. */
export function studentCountForSession(
  s: TeachingSessionRow,
  sizes: Record<string, number>,
): number {
  if (s.class) return sizes[s.class.id] ?? 0;
  return s.attendance?.[0]?.count ?? 0;
}

/** Bậc khớp với sĩ số (bậc đầu tiên có min ≤ n ≤ max). */
export function tierFor(tiers: PayTierRow[], students: number): PayTierRow | null {
  return (
    tiers.find(
      (t) => students >= t.min_students && (t.max_students == null || students <= t.max_students),
    ) ?? null
  );
}

export interface SessionPay {
  session: TeachingSessionRow;
  students: number;
  hours: number;
  amount: number; // 0 với GV full time (tiền tính theo tháng)
}

export interface TeacherPay {
  teacherId: string;
  teacherName: string;
  profile: PayProfileRow | null;
  sessions: SessionPay[];
  hours: number;
  /** Tiền các buổi (thỉnh giảng) */
  sessionTotal: number;
  /** Lương cứng (full time) */
  baseSalary: number;
  overtimeHours: number;
  overtimeTotal: number;
  total: number;
  /** true khi chưa thiết lập mức lương → tiền tính ra 0, cần cảnh báo */
  unconfigured: boolean;
  /** Buổi thỉnh giảng không tra được bậc nào (sĩ số ngoài bảng bậc) */
  missingTier: number;
}

/**
 * Gom buổi dạy trong tháng theo GV và quy ra tiền.
 * `sessions` là các buổi đã hoàn thành trong tháng (fetchTeachingSessions completedOnly).
 */
export function computePayroll(
  sessions: TeachingSessionRow[],
  profiles: PayProfileRow[],
  tiers: PayTierRow[],
  sizes: Record<string, number>,
): TeacherPay[] {
  const profileBy = new Map(profiles.map((p) => [p.teacher_id, p]));
  const tiersBy = new Map<string, PayTierRow[]>();
  for (const t of tiers) {
    const list = tiersBy.get(t.teacher_id) ?? [];
    list.push(t);
    tiersBy.set(t.teacher_id, list);
  }

  const byTeacher = new Map<string, TeacherPay>();
  for (const s of sessions) {
    if (!s.teacher) continue;
    const profile = profileBy.get(s.teacher.id) ?? null;
    const entry =
      byTeacher.get(s.teacher.id) ??
      ({
        teacherId: s.teacher.id,
        teacherName: s.teacher.name,
        profile,
        sessions: [],
        hours: 0,
        sessionTotal: 0,
        baseSalary: 0,
        overtimeHours: 0,
        overtimeTotal: 0,
        total: 0,
        unconfigured: !profile,
        missingTier: 0,
      } as TeacherPay);

    const hours = payHours(s);
    const students = studentCountForSession(s, sizes);
    let amount = 0;
    if (profile?.pay_type === "visiting" || (!profile && s.teacher)) {
      const tier = tierFor(tiersBy.get(s.teacher.id) ?? [], students);
      if (tier) amount = Number(tier.amount);
      else if (profile) entry.missingTier += 1;
    }
    entry.sessions.push({ session: s, students, hours, amount });
    entry.hours += hours;
    entry.sessionTotal += amount;
    byTeacher.set(s.teacher.id, entry);
  }

  for (const entry of byTeacher.values()) {
    const p = entry.profile;
    if (p?.pay_type === "fulltime") {
      entry.sessionTotal = 0;
      entry.sessions = entry.sessions.map((x) => ({ ...x, amount: 0 }));
      entry.baseSalary = Number(p.base_salary);
      entry.overtimeHours = Math.max(0, round2(entry.hours - Number(p.standard_hours)));
      entry.overtimeTotal = entry.overtimeHours * Number(p.overtime_rate);
      entry.total = entry.baseSalary + entry.overtimeTotal;
    } else {
      entry.total = entry.sessionTotal;
    }
    entry.hours = round2(entry.hours);
  }

  return [...byTeacher.values()].sort((a, b) => b.total - a.total || b.sessions.length - a.sessions.length);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Có bản ghi chấm công thực tế hay không (dùng để cảnh báo trên bảng lương). */
export function isLogged(s: TeachingSessionRow): boolean {
  return !!pickLog(s);
}

/** Mô tả bậc thang cho UI: "3–5 HV" / "6+ HV". */
export function tierLabel(t: { min_students: number; max_students: number | null }): string {
  return t.max_students == null
    ? `${t.min_students}+ HV`
    : t.min_students === t.max_students
      ? `${t.min_students} HV`
      : `${t.min_students}–${t.max_students} HV`;
}
