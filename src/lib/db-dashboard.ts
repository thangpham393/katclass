"use client";

/**
 * Số liệu BẢNG ĐIỀU KHIỂN admin: buổi chưa chấm công, học viên cần chú ý,
 * tình hình các lớp — tất cả tính trong cửa sổ 30 ngày gần nhất.
 *
 * Kéo thô một lượt (buổi + điểm danh, lớp đang học + học viên, bài tập +
 * bài nộp) rồi gom ở client; trang tự lọc theo giáo viên mà không phải hỏi
 * lại server mỗi lần đổi bộ lọc.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";
import { todayISO, type AttendanceStatus, type ScheduleRow } from "./db";

/** Cửa sổ tính số liệu. */
export const WINDOW_DAYS = 30;
/** Ngưỡng cảnh báo: nghỉ / thiếu bài từ chừng này lần trở lên. */
export const ABSENT_WARN = 2;
export const MISSING_WARN = 2;
/** Điểm trung bình (thang 10) dưới mức này là kết quả yếu. */
export const SCORE_WARN = 5;
/** Quá chừng này giờ sau giờ tan lớp mà chưa chấm công thì báo trễ. */
export const LOG_GRACE_HOURS = 24;

export interface DashSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled";
  teacher: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  room: { name: string } | null;
  teaching_log: { id: string; checked_in_at: string } | { id: string; checked_in_at: string }[] | null;
  attendance: { student_id: string; status: AttendanceStatus; student: { name: string } | null }[];
  /** Nhận xét từng buổi đã viết (RLS: GV chỉ thấy nhận xét mình viết). */
  session_comments: { student_id: string }[];
}

export interface DashClass {
  id: string;
  name: string;
  start_date: string | null;
  course: { total_sessions: number | null } | null;
  teacher: { id: string; name: string } | null;
  class_schedules: Pick<ScheduleRow, "weekday" | "start_time" | "end_time">[];
  class_students: {
    student_id: string;
    status: string;
    joined_at: string;
    student: { id: string; name: string; student_code: string | null; study_status: string } | null;
  }[];
}

export interface DashHomework {
  id: string;
  class_id: string;
  due_at: string | null;
  submissions: {
    student_id: string;
    score: number | null;
    auto_score: number | null;
    submitted_at: string;
  }[];
}

export interface DashboardData {
  sessions: DashSession[];
  classes: DashClass[];
  /** class_id → tiến độ (view class_progress). */
  progressByClass: Record<string, DashProgress>;
  homeworks: DashHomework[];
}

export interface DashProgress {
  class_id: string;
  first_date: string | null;
  last_date: string | null;
  done: number;
  past_pending: number;
  upcoming: number;
}

/** Giờ chấm công (null = chưa chấm). */
export function logTime(s: Pick<DashSession, "teaching_log">): string | null {
  const l = s.teaching_log;
  const one = Array.isArray(l) ? l[0] : l;
  return one?.checked_in_at ?? null;
}

/** Chấm công muộn quá `LOG_GRACE_HOURS` sau giờ tan lớp. */
export function isLateLog(s: DashSession): boolean {
  const t = logTime(s);
  if (!t) return false;
  const end = new Date(`${s.date}T${s.end_time}`);
  return new Date(t).getTime() - end.getTime() > LOG_GRACE_HOURS * 3_600_000;
}

/** Buổi lớp đã chấm công nhưng không có dòng điểm danh nào. */
export function isUnmarked(s: DashSession): boolean {
  return s.status !== "cancelled" && !!s.class && hasLog(s) && s.attendance.length === 0;
}

export function hasLog(s: Pick<DashSession, "teaching_log">): boolean {
  const l = s.teaching_log;
  return Array.isArray(l) ? l.length > 0 : !!l;
}

/** Buổi đã qua giờ tan lớp quá `LOG_GRACE_HOURS` mà chưa chấm công. */
export function isOverdueLog(s: DashSession, now = new Date()): boolean {
  if (s.status === "cancelled" || hasLog(s)) return false;
  const end = new Date(`${s.date}T${s.end_time}`);
  return now.getTime() - end.getTime() > LOG_GRACE_HOURS * 3_600_000;
}

/**
 * `teacherId` → chế độ trang chủ giáo viên: chỉ lớp GV phụ trách (chính hoặc
 * đồng phụ trách) và buổi của các lớp đó + buổi GV đứng dạy thay. Không lọc
 * chi nhánh vì GV dạy nhiều cơ sở vẫn phải thấy đủ lớp của mình.
 */
export async function fetchDashboardData(teacherId?: string): Promise<DashboardData> {
  const supabase = getSupabase();
  const from = todayISO(-WINDOW_DAYS);
  const today = todayISO();

  let teacherClassIds: string[] = [];
  if (teacherId) {
    const [main, extra] = await Promise.all([
      supabase.from("classes").select("id").eq("teacher_id", teacherId),
      supabase.from("class_teachers").select("class_id").eq("teacher_id", teacherId),
    ]);
    if (main.error) throw main.error;
    if (extra.error) throw extra.error;
    teacherClassIds = [
      ...new Set([
        ...(main.data as { id: string }[]).map((r) => r.id),
        ...(extra.data as { class_id: string }[]).map((r) => r.class_id),
      ]),
    ];
  }
  const scoped = <T,>(q: T, kind: "sessions" | "classes"): T => {
    if (!teacherId) return branchFilter(q);
    const b = q as unknown as { or(f: string): T; in(c: string, v: string[]): T; eq(c: string, v: string): T };
    if (kind === "classes") return teacherClassIds.length ? b.in("id", teacherClassIds) : b.eq("id", "00000000-0000-0000-0000-000000000000");
    return teacherClassIds.length
      ? b.or(`teacher_id.eq.${teacherId},class_id.in.(${teacherClassIds.join(",")})`)
      : b.eq("teacher_id", teacherId);
  };

  const [sessionRes, classRes] = await Promise.all([
    scoped(
      supabase
        .from("sessions")
        .select(`
          id, date, start_time, end_time, status,
          teacher:profiles!sessions_teacher_id_fkey ( id, name ),
          class:classes ( id, name ),
          room:rooms ( name ),
          teaching_log:teaching_logs ( id, checked_in_at ),
          attendance ( student_id, status, student:profiles!attendance_student_id_fkey ( name ) ),
          session_comments ( student_id )
        `)
        .gte("date", from)
        .lte("date", today),
      "sessions",
    )
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(3000),
    scoped(
      supabase
        .from("classes")
        .select(`
          id, name, start_date,
          course:courses ( total_sessions ),
          teacher:profiles!classes_teacher_id_fkey ( id, name ),
          class_schedules ( weekday, start_time, end_time ),
          class_students ( student_id, status, joined_at,
            student:profiles!class_students_student_id_fkey ( id, name, student_code, study_status ) )
        `)
        .eq("status", "active"),
      "classes",
    ).order("name"),
  ]);
  if (sessionRes.error) throw sessionRes.error;
  if (classRes.error) throw classRes.error;

  const classes = classRes.data as unknown as DashClass[];
  const classIds = classes.map((c) => c.id);
  if (classIds.length === 0) {
    return {
      sessions: sessionRes.data as unknown as DashSession[],
      classes,
      progressByClass: {},
      homeworks: [],
    };
  }

  // Bài tạo trong 60 ngày: đủ phủ bài có hạn trong 30 ngày lẫn bài nộp gần đây
  const hwFrom = new Date(Date.now() - 2 * WINDOW_DAYS * 86_400_000).toISOString();
  const [progressRes, hwRes] = await Promise.all([
    supabase
      .from("class_progress")
      .select("class_id, first_date, last_date, done, past_pending, upcoming")
      .in("class_id", classIds),
    supabase
      .from("homeworks")
      .select("id, class_id, due_at, submissions ( student_id, score, auto_score, submitted_at )")
      .in("class_id", classIds)
      .gte("created_at", hwFrom)
      .limit(3000),
  ]);
  if (progressRes.error) throw progressRes.error;
  if (hwRes.error) throw hwRes.error;

  const progressByClass: Record<string, DashProgress> = {};
  for (const r of progressRes.data as DashProgress[]) progressByClass[r.class_id] = r;

  return {
    sessions: sessionRes.data as unknown as DashSession[],
    classes,
    progressByClass,
    homeworks: hwRes.data as unknown as DashHomework[],
  };
}

/* ================= Các khối phụ của bảng điều khiển ================= */

/** Số ngày nhìn trước để dò buổi chưa có giáo viên. */
export const GAP_DAYS = 7;

export interface GapSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  class: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
  room: { name: string } | null;
}

/** Buổi sắp diễn ra (hôm nay → +7 ngày) chưa có giáo viên. */
export async function fetchUpcomingGaps(): Promise<GapSession[]> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("sessions")
      .select(`
        id, date, start_time, end_time,
        class:classes ( id, name ),
        teacher:profiles!sessions_teacher_id_fkey ( id, name ),
        room:rooms ( name )
      `)
      .eq("status", "scheduled")
      .gte("date", todayISO())
      .lte("date", todayISO(GAP_DAYS))
      .is("teacher_id", null),
  )
    .order("date")
    .order("start_time")
    .limit(200);
  if (error) throw error;
  return data as unknown as GapSession[];
}

/** Tổng tiền thu trong [from, to) — `to` là ngày ISO, không tính ngày đó. */
export async function fetchPaymentsBetween(from: string, to: string): Promise<number> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("payments")
      .select("amount, package:enrollment_packages!inner ( student:profiles!student_id!inner ( id ) )")
      .gte("paid_at", from)
      .lt("paid_at", to),
    "package.student.branch_id",
  );
  if (error) throw error;
  return (data as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount), 0);
}

export interface LeadAlerts {
  /** Khách "Mới" tạo quá 24 giờ mà chưa có ghi chú chăm sóc nào. */
  untouched: { id: string; parent_name: string; student_name: string | null; created_at: string }[];
  /** Khách chuyển "Đã đăng ký" trong tháng này. */
  registeredThisMonth: number;
}

export async function fetchLeadAlerts(): Promise<LeadAlerts> {
  const supabase = getSupabase();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const dayAgo = new Date(now.getTime() - LOG_GRACE_HOURS * 3_600_000).toISOString();
  const [fresh, registered] = await Promise.all([
    supabase
      .from("leads")
      .select("id, parent_name, student_name, created_at, lead_notes ( count )")
      .eq("status", "new")
      .lt("created_at", dayAgo)
      .order("created_at")
      .limit(200),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "registered")
      .gte("updated_at", monthStart),
  ]);
  if (fresh.error) throw fresh.error;
  if (registered.error) throw registered.error;
  return {
    untouched: (fresh.data as unknown as (LeadAlerts["untouched"][number] & {
      lead_notes: { count: number }[];
    })[])
      .filter((l) => !(l.lead_notes?.[0]?.count ?? 0))
      .map(({ lead_notes: _n, ...l }) => l),
    registeredThisMonth: registered.count ?? 0,
  };
}

/** Bảo lưu sắp đến hẹn quay lại trong chừng này ngày (kể cả đã quá hẹn). */
export const RETURN_SOON_DAYS = 14;
/** Sinh nhật trong chừng này ngày tới. */
export const BIRTHDAY_DAYS = 7;

export interface RetentionData {
  leftThisMonth: { id: string; name: string; left_at: string; left_reason: string | null }[];
  returningSoon: { id: string; name: string; return_at: string }[];
  birthdays: { id: string; name: string; dob: string; nextDate: string; age: number }[];
}

export async function fetchRetention(): Promise<RetentionData> {
  const supabase = getSupabase();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [left, reserved, dobs] = await Promise.all([
    branchFilter(
      supabase
        .from("profiles")
        .select("id, name, left_at, left_reason")
        .eq("role", "student")
        .eq("study_status", "left")
        .gte("left_at", monthStart),
    ).order("left_at", { ascending: false }),
    branchFilter(
      supabase
        .from("profiles")
        .select("id, name, return_at")
        .eq("role", "student")
        .eq("study_status", "reserved")
        .not("return_at", "is", null)
        .lte("return_at", todayISO(RETURN_SOON_DAYS)),
    ).order("return_at"),
    branchFilter(
      supabase
        .from("profiles")
        .select("id, name, dob, study_status")
        .eq("role", "student")
        .not("dob", "is", null)
        .neq("study_status", "left"),
    ).limit(5000),
  ]);
  if (left.error) throw left.error;
  if (reserved.error) throw reserved.error;
  if (dobs.error) throw dobs.error;

  const today = todayISO();
  const last = todayISO(BIRTHDAY_DAYS);
  const birthdays: RetentionData["birthdays"] = [];
  for (const p of dobs.data as { id: string; name: string; dob: string }[]) {
    const [y, m, d] = p.dob.split("-");
    // Sinh nhật năm nay, đã qua thì xét năm sau (khoảng 7 ngày có thể vắt qua năm mới)
    let year = now.getFullYear();
    let next = `${year}-${m}-${d}`;
    if (next < today) next = `${++year}-${m}-${d}`;
    if (next <= last) birthdays.push({ id: p.id, name: p.name, dob: p.dob, nextDate: next, age: year - Number(y) });
  }
  birthdays.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return {
    leftThisMonth: left.data as RetentionData["leftThisMonth"],
    returningSoon: reserved.data as RetentionData["returningSoon"],
    birthdays,
  };
}

/** Nhắc nhận xét từng buổi cho các buổi đã dạy trong chừng này ngày. */
export const COMMENT_DAYS = 14;
