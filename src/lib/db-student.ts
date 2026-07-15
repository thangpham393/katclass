"use client";

/**
 * Data layer cho KHU HỌC VIÊN và CỔNG PHỤ HUYNH.
 * Các hàm nhận studentId (profiles.id) và dựa vào RLS:
 * học viên chỉ đọc được dữ liệu của mình, phụ huynh đọc được của con
 * (qua parent_students) — nên cùng một hàm dùng cho cả hai khu.
 */

import { getSupabase } from "./supabase";
import { todayISO, type ScheduleRow, type AttendanceStatus } from "./db";

/* ============ Lớp của tôi ============ */

export interface MyClassRow {
  class_id: string;
  status: string;
  joined_at: string;
  class: {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    course: { id: string; name: string; level: string | null; total_sessions: number } | null;
    teacher: { id: string; name: string } | null;
    class_schedules: ScheduleRow[];
  } | null;
}

export async function fetchMyClasses(studentId: string): Promise<MyClassRow[]> {
  const { data, error } = await getSupabase()
    .from("class_students")
    .select(`
      class_id, status, joined_at,
      class:classes (
        id, name, status, start_date,
        course:courses ( id, name, level, total_sessions ),
        teacher:profiles!classes_teacher_id_fkey ( id, name ),
        class_schedules ( id, weekday, start_time, end_time, room_id )
      )
    `)
    .eq("student_id", studentId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data as unknown as MyClassRow[];
}

/* ============ Lịch học sắp tới ============ */

export interface UpcomingSessionRow {
  id: string;
  class_id: string;
  session_no: number | null;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: "regular" | "makeup";
  room: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  /** true nếu đây là buổi mình được xếp HỌC BÙ (không thuộc lớp mình) */
  isMakeupForMe?: boolean;
}

const UPCOMING_SELECT = `
  id, class_id, session_no, date, start_time, end_time, status, type,
  room:rooms ( id, name ),
  class:classes ( id, name )
`;

/** Buổi học sắp tới của các lớp đang tham gia + buổi được xếp học bù. */
export async function fetchMyUpcomingSessions(
  studentId: string,
  classIds: string[],
  days = 14,
): Promise<UpcomingSessionRow[]> {
  const supabase = getSupabase();
  const from = todayISO();
  const to = todayISO(days);

  const [regular, makeup] = await Promise.all([
    classIds.length
      ? supabase
          .from("sessions").select(UPCOMING_SELECT)
          .in("class_id", classIds)
          .eq("status", "scheduled")
          .gte("date", from).lte("date", to)
          .order("date").order("start_time")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("makeup_credits")
      .select(`makeup_session:sessions!makeup_credits_makeup_session_id_fkey ( ${UPCOMING_SELECT} )`)
      .eq("student_id", studentId)
      .eq("status", "scheduled"),
  ]);
  if (regular.error) throw regular.error;
  if (makeup.error) throw makeup.error;

  const list = (regular.data ?? []) as unknown as UpcomingSessionRow[];
  const seen = new Set(list.map((s) => s.id));
  for (const m of (makeup.data ?? []) as unknown as { makeup_session: UpcomingSessionRow | null }[]) {
    const s = m.makeup_session;
    if (!s || s.date < from || s.status !== "scheduled" || seen.has(s.id)) continue;
    list.push({ ...s, isMakeupForMe: true });
  }
  return list.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

/* ============ Điểm danh & nhận xét của mình ============ */

export interface MyAttendanceRow {
  id: string;
  status: AttendanceStatus;
  note: string | null;
  session: {
    id: string;
    date: string;
    start_time: string;
    class: { id: string; name: string } | null;
  } | null;
}

export async function fetchMyAttendance(studentId: string): Promise<MyAttendanceRow[]> {
  const { data, error } = await getSupabase()
    .from("attendance")
    .select(`
      id, status, note,
      session:sessions ( id, date, start_time, class:classes ( id, name ) )
    `)
    .eq("student_id", studentId)
    .limit(300);
  if (error) throw error;
  const rows = data as unknown as MyAttendanceRow[];
  return rows.sort((a, b) =>
    ((b.session?.date ?? "") + (b.session?.start_time ?? "")).localeCompare(
      (a.session?.date ?? "") + (a.session?.start_time ?? ""),
    ),
  );
}

export interface MyCommentRow {
  id: string;
  content: string;
  rating: number | null;
  created_at: string;
  teacher: { id: string; name: string; avatar: string | null } | null;
  session: { id: string; date: string; class: { id: string; name: string } | null } | null;
}

export async function fetchMyComments(studentId: string, limit = 20): Promise<MyCommentRow[]> {
  const { data, error } = await getSupabase()
    .from("session_comments")
    .select(`
      id, content, rating, created_at,
      teacher:profiles!session_comments_teacher_id_fkey ( id, name, avatar ),
      session:sessions ( id, date, class:classes ( id, name ) )
    `)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as MyCommentRow[];
}

/* ============ Phụ huynh ↔ con ============ */

export const RELATIONSHIP_LABELS: Record<string, string> = {
  father: "Bố",
  mother: "Mẹ",
  guardian: "Người giám hộ",
};

export interface ChildLinkRow {
  student_id: string;
  relationship: string;
  student: {
    id: string;
    name: string;
    avatar: string | null;
    student_code: string | null;
  } | null;
}

/** Danh sách con của phụ huynh (dùng cho cổng phụ huynh + trang admin). */
export async function fetchChildrenOfParent(parentId: string): Promise<ChildLinkRow[]> {
  const { data, error } = await getSupabase()
    .from("parent_students")
    .select(`
      student_id, relationship,
      student:profiles!parent_students_student_id_fkey ( id, name, avatar, student_code )
    `)
    .eq("parent_id", parentId);
  if (error) throw error;
  return data as unknown as ChildLinkRow[];
}

export interface ParentLinkRow {
  parent_id: string;
  relationship: string;
  parent: {
    id: string;
    name: string;
    phone: string | null;
    email: string;
    student_code: string | null;
    user_id: string | null;
  } | null;
}

/** Danh sách phụ huynh của một học viên (trang admin). */
export async function fetchParentsOfStudent(studentId: string): Promise<ParentLinkRow[]> {
  const { data, error } = await getSupabase()
    .from("parent_students")
    .select(`
      parent_id, relationship,
      parent:profiles!parent_students_parent_id_fkey ( id, name, phone, email, student_code, user_id )
    `)
    .eq("student_id", studentId);
  if (error) throw error;
  return data as unknown as ParentLinkRow[];
}

export async function linkParentStudent(parentId: string, studentId: string, relationship: string) {
  const { error } = await getSupabase()
    .from("parent_students")
    .insert({ parent_id: parentId, student_id: studentId, relationship });
  if (error) throw error;
}

export async function unlinkParentStudent(parentId: string, studentId: string) {
  const { error } = await getSupabase()
    .from("parent_students")
    .delete()
    .eq("parent_id", parentId)
    .eq("student_id", studentId);
  if (error) throw error;
}

/** Tạo hồ sơ phụ huynh — mã PHKAT do trigger DB tự cấp (migration 0010). */
export async function createParentProfile(input: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<{ id: string; name: string; student_code: string | null }> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() ?? "",
      phone: input.phone?.trim() || null,
      role: "parent",
    })
    .select("id, name, student_code")
    .single();
  if (error) throw error;
  return data;
}
