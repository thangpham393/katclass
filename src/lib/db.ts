"use client";

import { getSupabase } from "./supabase";
import type { Role } from "./types";

/* ============ Kiểu dữ liệu khớp bảng Supabase ============ */

export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface CourseRow {
  id: string;
  name: string;
  level: string | null;
  total_sessions: number;
  description: string | null;
  created_at: string;
}

export interface RoomRow {
  id: string;
  name: string;
  capacity: number | null;
}

export interface ProfileRow {
  id: string;
  user_id: string | null; // null = chưa có tài khoản đăng nhập
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  phone: string | null;
  student_code: string | null;
  address: string | null;
  note: string | null;
  invite_code: string | null; // mã kích hoạt tài khoản (null = chưa cấp hoặc đã dùng)
  created_at: string;
}

export interface ScheduleRow {
  id: string;
  weekday: number; // 0 = Chủ nhật
  start_time: string;
  end_time: string;
  room_id: string | null;
}

export interface ClassRow {
  id: string;
  name: string;
  status: "planned" | "active" | "completed" | "cancelled";
  start_date: string | null;
  notes: string | null;
  course: Pick<CourseRow, "id" | "name" | "level" | "total_sessions"> | null;
  teacher: Pick<ProfileRow, "id" | "name"> | null;
  class_schedules: ScheduleRow[];
  class_students: { count: number }[];
}

export interface ClassStudentRow {
  student_id: string;
  status: string;
  joined_at: string;
  student: Pick<ProfileRow, "id" | "name" | "email" | "phone" | "avatar">;
}

export const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6", "KIDS", "GIAO_TIEP", "OTHER"];
export const LEVEL_LABELS: Record<string, string> = {
  HSK1: "HSK 1", HSK2: "HSK 2", HSK3: "HSK 3", HSK4: "HSK 4", HSK5: "HSK 5", HSK6: "HSK 6",
  KIDS: "Thiếu nhi", GIAO_TIEP: "Giao tiếp", OTHER: "Khác",
};
export const CLASS_STATUS_LABELS: Record<ClassRow["status"], string> = {
  planned: "Sắp mở",
  active: "Đang học",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};

export function formatSchedules(schedules: ScheduleRow[]): string {
  if (!schedules?.length) return "Chưa xếp lịch";
  return schedules
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((s) => `${WEEKDAY_LABELS[s.weekday]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`)
    .join(" · ");
}

/* ============ Dashboard ============ */

export async function fetchDashboardStats() {
  const supabase = getSupabase();
  const [students, teachers, activeClasses, pendingMakeups] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("makeup_credits").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    activeClasses: activeClasses.count ?? 0,
    pendingMakeups: pendingMakeups.count ?? 0,
  };
}

/* ============ Khóa học ============ */

export async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await getSupabase()
    .from("courses").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCourse(input: Partial<CourseRow>) {
  const { error } = await getSupabase().from("courses").insert(input);
  if (error) throw error;
}

export async function updateCourse(id: string, input: Partial<CourseRow>) {
  const { error } = await getSupabase().from("courses").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(id: string) {
  const { error } = await getSupabase().from("courses").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Phòng học & cơ sở ============ */

export async function fetchRooms(): Promise<RoomRow[]> {
  const { data, error } = await getSupabase().from("rooms").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function createRoom(input: { name: string; capacity?: number | null }) {
  const { error } = await getSupabase().from("rooms").insert(input);
  if (error) throw error;
}

export async function deleteRoom(id: string) {
  const { error } = await getSupabase().from("rooms").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBranches(): Promise<BranchRow[]> {
  const { data, error } = await getSupabase().from("branches").select("*").order("name");
  if (error) throw error;
  return data;
}

/* ============ Người dùng ============ */

export async function fetchProfilesByRole(role: Role): Promise<ProfileRow[]> {
  const { data, error } = await getSupabase()
    .from("profiles").select("*").eq("role", role).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Chỉ các hồ sơ ĐÃ có tài khoản đăng nhập (để phân quyền). */
export async function fetchAccountProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await getSupabase()
    .from("profiles").select("*").not("user_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Chỉ admin có quyền (RLS chặn các role khác). */
export async function updateProfileRole(userId: string, role: Role) {
  const { error } = await getSupabase().from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

/* ============ Lớp học ============ */

const CLASS_SELECT = `
  id, name, status, start_date, notes,
  course:courses ( id, name, level, total_sessions ),
  teacher:profiles!classes_teacher_id_fkey ( id, name ),
  class_schedules ( id, weekday, start_time, end_time, room_id ),
  class_students ( count )
`;

export async function fetchClasses(): Promise<ClassRow[]> {
  const { data, error } = await getSupabase()
    .from("classes").select(CLASS_SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ClassRow[];
}

export async function fetchClass(id: string): Promise<ClassRow | null> {
  const { data, error } = await getSupabase()
    .from("classes").select(CLASS_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as ClassRow | null;
}

export interface CreateClassInput {
  name: string;
  course_id: string | null;
  teacher_id: string | null;
  status: ClassRow["status"];
  start_date: string | null;
  schedules: { weekday: number; start_time: string; end_time: string; room_id: string | null }[];
}

export async function createClass(input: CreateClassInput) {
  const supabase = getSupabase();
  const { schedules, ...classData } = input;
  const { data: cls, error } = await supabase
    .from("classes").insert(classData).select("id").single();
  if (error) throw error;
  if (schedules.length) {
    const { error: schedErr } = await supabase
      .from("class_schedules")
      .insert(schedules.map((s) => ({ ...s, class_id: cls.id })));
    if (schedErr) throw schedErr;
  }
  return cls.id as string;
}

export async function updateClassStatus(id: string, status: ClassRow["status"]) {
  const { error } = await getSupabase().from("classes").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteClass(id: string) {
  const { error } = await getSupabase().from("classes").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Học viên trong lớp ============ */

export async function fetchClassStudents(classId: string): Promise<ClassStudentRow[]> {
  const { data, error } = await getSupabase()
    .from("class_students")
    .select("student_id, status, joined_at, student:profiles!class_students_student_id_fkey ( id, name, email, phone, avatar )")
    .eq("class_id", classId)
    .order("joined_at");
  if (error) throw error;
  return data as unknown as ClassStudentRow[];
}

export async function addStudentToClass(classId: string, studentId: string) {
  const { error } = await getSupabase()
    .from("class_students").insert({ class_id: classId, student_id: studentId });
  if (error) throw error;
}

export async function removeStudentFromClass(classId: string, studentId: string) {
  const { error } = await getSupabase()
    .from("class_students").delete()
    .eq("class_id", classId).eq("student_id", studentId);
  if (error) throw error;
}

/** Học viên kèm số lớp đang tham gia (để lọc "chưa xếp lớp"). */
export interface StudentWithClasses extends ProfileRow {
  class_students: { count: number }[];
}

export async function fetchStudentsWithClassCount(): Promise<StudentWithClasses[]> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*, class_students!class_students_student_id_fkey ( count )")
    .eq("role", "student")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as StudentWithClasses[];
}

/* ============ Đội ngũ & mã kích hoạt ============ */

// Bỏ các ký tự dễ nhầm (0/O, 1/I/L) để đọc mã qua điện thoại không sai
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export type TeamRole = "teacher" | "staff";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  teacher: "Giáo viên",
  staff: "Nhân viên hành chính",
};

/** Tạo hồ sơ giáo viên/nhân viên — mã GVKAT/NVKAT do trigger DB tự cấp. */
export async function createTeamProfile(input: {
  name: string;
  email?: string;
  phone?: string;
  role: TeamRole;
}): Promise<ProfileRow> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() ?? "",
      phone: input.phone?.trim() || null,
      role: input.role,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

/** Tạo hồ sơ học viên — mã HVKAT do trigger DB tự cấp. */
export async function createStudentProfile(input: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
}): Promise<ProfileRow> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() ?? "",
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      note: input.note?.trim() || null,
      role: "student",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

/**
 * Cấp tài khoản đăng nhập cho hồ sơ (mã thành viên + mật khẩu mặc định)
 * qua API server /api/provision-account (chỉ staff/admin gọi được).
 */
export async function provisionAccount(profileId: string): Promise<{ code: string; already?: boolean }> {
  const res = await fetch("/api/provision-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Không cấp được tài khoản, thử lại sau.");
  return body as { code: string; already?: boolean };
}

/** Cấp (hoặc cấp lại) mã kích hoạt cho hồ sơ chưa liên kết tài khoản. */
export async function issueInviteCode(profileId: string): Promise<string> {
  const supabase = getSupabase();
  for (let attempt = 0; ; attempt++) {
    const code = generateInviteCode();
    const { error } = await supabase
      .from("profiles").update({ invite_code: code }).eq("id", profileId);
    if (!error) return code;
    if (error.code === "23505" && attempt < 3) continue;
    throw error;
  }
}

export async function revokeInviteCode(profileId: string) {
  const { error } = await getSupabase()
    .from("profiles").update({ invite_code: null }).eq("id", profileId);
  if (error) throw error;
}

/** Nhập mã kích hoạt → nối tài khoản đang đăng nhập vào hồ sơ được cấp. */
export async function claimInvite(code: string): Promise<ProfileRow> {
  const { data, error } = await getSupabase().rpc("claim_invite", { code });
  if (error) throw error;
  return data as ProfileRow;
}

/* ============ Chi tiết & quản lý thành viên ============ */

export async function fetchProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await getSupabase()
    .from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

/** Các lớp học viên đang tham gia. */
export interface StudentClassRow {
  class_id: string;
  status: string;
  joined_at: string;
  class: {
    id: string;
    name: string;
    status: string;
    course: Pick<CourseRow, "name" | "level"> | null;
  } | null;
}

export async function fetchStudentClasses(studentId: string): Promise<StudentClassRow[]> {
  const { data, error } = await getSupabase()
    .from("class_students")
    .select("class_id, status, joined_at, class:classes ( id, name, status, course:courses ( name, level ) )")
    .eq("student_id", studentId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data as unknown as StudentClassRow[];
}

/** Tổng hợp điểm danh của một học viên. */
export async function fetchStudentAttendanceSummary(
  studentId: string,
): Promise<{ total: number; byStatus: Record<AttendanceStatus, number> }> {
  const { data, error } = await getSupabase()
    .from("attendance").select("status").eq("student_id", studentId);
  if (error) throw error;
  const byStatus: Record<AttendanceStatus, number> = {
    present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0,
  };
  for (const r of data as { status: AttendanceStatus }[]) byStatus[r.status]++;
  return { total: data.length, byStatus };
}

/** Đặt lại mật khẩu của thành viên về mặc định (API server, chỉ staff/admin). */
export async function resetMemberPassword(profileId: string): Promise<{ code: string }> {
  const res = await fetch("/api/member-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset-password", profileId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Không đặt lại được mật khẩu.");
  return body as { code: string };
}

/** Xóa thành viên (hồ sơ + tài khoản đăng nhập). */
export async function deleteMember(profileId: string): Promise<void> {
  const res = await fetch("/api/member-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", profileId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Không xóa được thành viên.");
}

/* ============ Cập nhật lớp: giáo viên & lịch tuần ============ */

/** Ngày hôm nay (giờ địa phương) dạng YYYY-MM-DD, lệch offsetDays ngày. */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Đổi GV phụ trách; tùy chọn gán luôn cho các buổi sắp tới chưa hoàn thành. */
export async function updateClassTeacher(
  classId: string,
  teacherId: string | null,
  updateUpcomingSessions: boolean,
) {
  const supabase = getSupabase();
  const { error } = await supabase.from("classes").update({ teacher_id: teacherId }).eq("id", classId);
  if (error) throw error;
  if (updateUpcomingSessions) {
    const { error: sessErr } = await supabase
      .from("sessions")
      .update({ teacher_id: teacherId })
      .eq("class_id", classId)
      .eq("status", "scheduled")
      .gte("date", todayISO());
    if (sessErr) throw sessErr;
  }
}

export interface ScheduleInput {
  weekday: number;
  start_time: string;
  end_time: string;
  room_id: string | null;
}

/** Thay toàn bộ lịch tuần của lớp (sessions đã sinh không bị ảnh hưởng). */
export async function replaceClassSchedules(classId: string, schedules: ScheduleInput[]) {
  const supabase = getSupabase();
  const { error: delErr } = await supabase.from("class_schedules").delete().eq("class_id", classId);
  if (delErr) throw delErr;
  if (schedules.length) {
    const { error } = await supabase
      .from("class_schedules")
      .insert(schedules.map((s) => ({ ...s, class_id: classId })));
    if (error) throw error;
  }
}

/* ============ Buổi học (sessions) ============ */

export interface SessionRow {
  id: string;
  class_id: string;
  session_no: number | null;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled";
  type: "regular" | "makeup";
  note: string | null;
  room: Pick<RoomRow, "id" | "name"> | null;
  teacher: Pick<ProfileRow, "id" | "name"> | null;
  class: {
    id: string;
    name: string;
    course: Pick<CourseRow, "id" | "name" | "level" | "total_sessions"> | null;
  } | null;
}

export const SESSION_STATUS_LABELS: Record<SessionRow["status"], string> = {
  scheduled: "Sắp diễn ra",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const SESSION_SELECT = `
  id, class_id, session_no, date, start_time, end_time, status, type, note,
  room:rooms ( id, name ),
  teacher:profiles!sessions_teacher_id_fkey ( id, name ),
  class:classes ( id, name, course:courses ( id, name, level, total_sessions ) )
`;

export async function fetchClassSessions(classId: string): Promise<SessionRow[]> {
  const { data, error } = await getSupabase()
    .from("sessions").select(SESSION_SELECT)
    .eq("class_id", classId)
    .order("date").order("start_time");
  if (error) throw error;
  return data as unknown as SessionRow[];
}

export async function fetchSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await getSupabase()
    .from("sessions").select(SESSION_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as SessionRow | null;
}

/** Các buổi GV dạy trong khoảng ngày [from, to] (bỏ buổi đã hủy). */
export async function fetchTeacherSessions(
  teacherId: string,
  from: string,
  to: string,
): Promise<SessionRow[]> {
  const { data, error } = await getSupabase()
    .from("sessions").select(SESSION_SELECT)
    .eq("teacher_id", teacherId)
    .neq("status", "cancelled")
    .gte("date", from).lte("date", to)
    .order("date").order("start_time");
  if (error) throw error;
  return data as unknown as SessionRow[];
}

export async function fetchTeacherClasses(teacherId: string): Promise<ClassRow[]> {
  const { data, error } = await getSupabase()
    .from("classes").select(CLASS_SELECT)
    .eq("teacher_id", teacherId)
    .order("name");
  if (error) throw error;
  return data as unknown as ClassRow[];
}

export async function updateSessionStatus(id: string, status: SessionRow["status"]) {
  const { error } = await getSupabase().from("sessions").update({ status }).eq("id", id);
  if (error) throw error;
}

export interface GenerateSessionsResult {
  created: number;
  skipped: number;
  conflicts: string[]; // mô tả các buổi bị trùng phòng/GV, không tạo được
}

/**
 * Sinh buổi học cho N tuần tới từ lịch tuần của lớp.
 * Buổi đã tồn tại (cùng ngày + giờ) thì bỏ qua; buổi trùng phòng/GV
 * (exclusion constraint 23P01) được gom lại trả về trong `conflicts`.
 */
export async function generateSessions(classId: string, weeks: number): Promise<GenerateSessionsResult> {
  const supabase = getSupabase();
  const [clsRes, schedRes, existingRes] = await Promise.all([
    supabase.from("classes").select("id, teacher_id").eq("id", classId).single(),
    supabase.from("class_schedules").select("weekday, start_time, end_time, room_id").eq("class_id", classId),
    supabase.from("sessions").select("date, start_time, session_no").eq("class_id", classId),
  ]);
  if (clsRes.error) throw clsRes.error;
  if (schedRes.error) throw schedRes.error;
  if (existingRes.error) throw existingRes.error;

  const schedules = schedRes.data ?? [];
  if (!schedules.length) {
    throw new Error("Lớp chưa có lịch tuần — nhập lịch trước khi sinh buổi học.");
  }

  const existing = existingRes.data ?? [];
  const existingKeys = new Set(existing.map((s) => `${s.date}|${s.start_time.slice(0, 5)}`));
  let nextNo = Math.max(existing.length, ...existing.map((s) => s.session_no ?? 0), 0) + 1;

  // Duyệt từng ngày trong N tuần tới (tính từ hôm nay)
  const candidates: { date: string; start_time: string; end_time: string; room_id: string | null }[] = [];
  const cursor = new Date();
  for (let i = 0; i < weeks * 7; i++) {
    for (const s of schedules) {
      if (s.weekday === cursor.getDay()) {
        candidates.push({
          date: todayISO(i),
          start_time: s.start_time,
          end_time: s.end_time,
          room_id: s.room_id,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  candidates.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));

  let created = 0;
  let skipped = 0;
  const conflicts: string[] = [];
  for (const c of candidates) {
    if (existingKeys.has(`${c.date}|${c.start_time.slice(0, 5)}`)) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("sessions").insert({
      class_id: classId,
      session_no: nextNo,
      teacher_id: clsRes.data.teacher_id,
      ...c,
    });
    if (!error) {
      created++;
      nextNo++;
    } else if (error.code === "23505") {
      skipped++;
    } else if (error.code === "23P01") {
      conflicts.push(
        `${new Date(c.date + "T00:00:00").toLocaleDateString("vi-VN")} ${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}`,
      );
    } else {
      throw error;
    }
  }
  return { created, skipped, conflicts };
}

/* ============ Điểm danh ============ */

export type AttendanceStatus = "present" | "absent_excused" | "absent_unexcused" | "makeup";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent_excused: "Vắng có phép",
  absent_unexcused: "Vắng không phép",
  makeup: "Học bù",
};

export interface AttendanceRow {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
}

export async function fetchSessionAttendance(sessionId: string): Promise<AttendanceRow[]> {
  const { data, error } = await getSupabase()
    .from("attendance")
    .select("id, session_id, student_id, status, note")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data as AttendanceRow[];
}

/** Lưu điểm danh cả buổi (upsert theo cặp buổi + học viên). */
export async function saveAttendance(
  sessionId: string,
  records: { student_id: string; status: AttendanceStatus; note?: string | null }[],
  markedBy: string,
) {
  if (!records.length) return;
  const { error } = await getSupabase()
    .from("attendance")
    .upsert(
      records.map((r) => ({
        session_id: sessionId,
        student_id: r.student_id,
        status: r.status,
        note: r.note ?? null,
        marked_by: markedBy,
        marked_at: new Date().toISOString(),
      })),
      { onConflict: "session_id,student_id" },
    );
  if (error) throw error;
}

/* ============ Nhận xét sau buổi học ============ */

export interface SessionCommentRow {
  id: string;
  session_id: string;
  student_id: string;
  teacher_id: string;
  content: string;
  rating: number | null;
}

export async function fetchSessionComments(sessionId: string): Promise<SessionCommentRow[]> {
  const { data, error } = await getSupabase()
    .from("session_comments")
    .select("id, session_id, student_id, teacher_id, content, rating")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data as SessionCommentRow[];
}

export async function upsertSessionComment(input: {
  session_id: string;
  student_id: string;
  teacher_id: string;
  content: string;
  rating: number | null;
}) {
  const { error } = await getSupabase()
    .from("session_comments")
    .upsert(input, { onConflict: "session_id,student_id" });
  if (error) throw error;
}

/* ============ Học bù ============ */

export interface MakeupCreditRow {
  id: string;
  status: "pending" | "scheduled" | "attended" | "expired" | "cancelled";
  note: string | null;
  created_at: string;
  student: Pick<ProfileRow, "id" | "name" | "phone" | "avatar" | "student_code">;
  missed_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
  makeup_session: {
    id: string; date: string; start_time: string; end_time: string;
    class: { id: string; name: string } | null;
  } | null;
}

export const MAKEUP_STATUS_LABELS: Record<MakeupCreditRow["status"], string> = {
  pending: "Chờ xếp bù",
  scheduled: "Đã xếp bù",
  attended: "Đã học bù",
  expired: "Hết hạn",
  cancelled: "Đã hủy",
};

const MAKEUP_SELECT = `
  id, status, note, created_at,
  student:profiles!makeup_credits_student_id_fkey ( id, name, phone, avatar, student_code ),
  missed_session:sessions!makeup_credits_missed_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) ),
  makeup_session:sessions!makeup_credits_makeup_session_id_fkey ( id, date, start_time, end_time, class:classes ( id, name ) )
`;

export async function fetchMakeupCredits(statuses: MakeupCreditRow["status"][]): Promise<MakeupCreditRow[]> {
  const { data, error } = await getSupabase()
    .from("makeup_credits").select(MAKEUP_SELECT)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as MakeupCreditRow[];
}

/** Học viên được xếp học bù vào buổi này (để GV điểm danh 'makeup'). */
export async function fetchMakeupForSession(sessionId: string): Promise<MakeupCreditRow[]> {
  const { data, error } = await getSupabase()
    .from("makeup_credits").select(MAKEUP_SELECT)
    .eq("makeup_session_id", sessionId)
    .in("status", ["scheduled", "attended"]);
  if (error) throw error;
  return data as unknown as MakeupCreditRow[];
}

export async function scheduleMakeup(creditId: string, sessionId: string) {
  const { error } = await getSupabase()
    .from("makeup_credits")
    .update({ makeup_session_id: sessionId, status: "scheduled" })
    .eq("id", creditId);
  if (error) throw error;
}

/** Bỏ xếp bù, trả về trạng thái chờ. */
export async function resetMakeup(creditId: string) {
  const { error } = await getSupabase()
    .from("makeup_credits")
    .update({ makeup_session_id: null, status: "pending" })
    .eq("id", creditId);
  if (error) throw error;
}

/** Các buổi sắp tới (mọi lớp) để chọn xếp học bù. */
export async function fetchUpcomingSessions(): Promise<SessionRow[]> {
  const { data, error } = await getSupabase()
    .from("sessions").select(SESSION_SELECT)
    .eq("status", "scheduled")
    .gte("date", todayISO())
    .order("date").order("start_time")
    .limit(300);
  if (error) throw error;
  return data as unknown as SessionRow[];
}

/* ============ Thống kê chuyên cần ============ */

export interface AttendanceStats {
  total: number;
  byStatus: Record<AttendanceStatus, number>;
  byClass: {
    classId: string;
    className: string;
    total: number;
    attended: number; // present + makeup
  }[];
}

/** Gom điểm danh sinceDays ngày gần nhất, tính tỷ lệ chuyên cần theo lớp. */
export async function fetchAttendanceStats(sinceDays = 30): Promise<AttendanceStats> {
  const { data, error } = await getSupabase()
    .from("attendance")
    .select("status, session:sessions!inner ( date, class:classes ( id, name ) )")
    .gte("session.date", todayISO(-sinceDays));
  if (error) throw error;

  const rows = data as unknown as {
    status: AttendanceStatus;
    session: { date: string; class: { id: string; name: string } | null };
  }[];

  const byStatus: Record<AttendanceStatus, number> = {
    present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0,
  };
  const classMap = new Map<string, { className: string; total: number; attended: number }>();
  for (const r of rows) {
    byStatus[r.status]++;
    const cls = r.session.class;
    if (!cls) continue;
    const entry = classMap.get(cls.id) ?? { className: cls.name, total: 0, attended: 0 };
    entry.total++;
    if (r.status === "present" || r.status === "makeup") entry.attended++;
    classMap.set(cls.id, entry);
  }
  return {
    total: rows.length,
    byStatus,
    byClass: [...classMap.entries()]
      .map(([classId, v]) => ({ classId, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}

/** Lỗi Supabase/Postgres → thông báo tiếng Việt gọn. */
export function dbErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505") return "Dữ liệu bị trùng (đã tồn tại bản ghi tương tự).";
  if (e?.code === "23P01") return "Trùng lịch: phòng học hoặc giáo viên đã có buổi khác cùng giờ.";
  if (e?.code === "42501" || e?.message?.includes("row-level security"))
    return "Bạn không có quyền thực hiện thao tác này.";
  return e?.message ?? "Có lỗi xảy ra, vui lòng thử lại.";
}
