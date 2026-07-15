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

/** Lỗi Supabase/Postgres → thông báo tiếng Việt gọn. */
export function dbErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505") return "Dữ liệu bị trùng (đã tồn tại bản ghi tương tự).";
  if (e?.code === "23P01") return "Trùng lịch: phòng học hoặc giáo viên đã có buổi khác cùng giờ.";
  if (e?.code === "42501" || e?.message?.includes("row-level security"))
    return "Bạn không có quyền thực hiện thao tác này.";
  return e?.message ?? "Có lỗi xảy ra, vui lòng thử lại.";
}
