"use client";

/**
 * ĐIỂM DANH TOÀN TRUNG TÂM THEO NGÀY.
 *
 * Trước đây điểm danh chỉ làm được từ trong một buổi dạy cụ thể
 * (/teacher/sessions/[id]). Màn này gom mọi ca trong ngày lại: hành chính
 * mở một lần là tick được cho cả trung tâm, kể cả buổi học bù riêng.
 *
 * Danh sách mỗi ca = học viên đang học của lớp + học viên được xếp bù vào
 * ca đó (buổi bù độc lập thì chỉ có nhóm thứ hai). Trạng thái điểm danh
 * lưu thẳng vào `attendance` như GV tự tick, không có đường dữ liệu riêng.
 */

import { getSupabase } from "./supabase";
import {
  fetchSessionsInRange,
  type AttendanceStatus,
  type SessionRow,
  type StudyStatus,
} from "./db";

export interface DayStudentRow {
  id: string;
  name: string;
  avatar: string | null;
  student_code: string | null;
  phone: string | null;
  study_status: StudyStatus;
  /** Học viên đến học bù ca này (không thuộc lớp). */
  isMakeup: boolean;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface DaySessionRow {
  session: SessionRow;
  students: DayStudentRow[];
}

/** Toàn bộ ca dạy trong ngày kèm danh sách điểm danh của từng ca. */
export async function fetchAttendanceDay(date: string): Promise<DaySessionRow[]> {
  const supabase = getSupabase();
  const sessions = await fetchSessionsInRange(date, date);
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const classIds = [...new Set(sessions.map((s) => s.class_id).filter((id): id is string => !!id))];

  const [membersRes, attendanceRes, makeupRes] = await Promise.all([
    classIds.length
      ? supabase
          .from("class_students")
          .select(`
            class_id,
            student:profiles!class_students_student_id_fkey (
              id, name, avatar, student_code, phone, study_status
            )
          `)
          .in("class_id", classIds)
          .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("attendance")
      .select("session_id, student_id, status, note")
      .in("session_id", sessionIds),
    supabase
      .from("makeup_credits")
      .select(`
        makeup_session_id,
        student:profiles!makeup_credits_student_id_fkey (
          id, name, avatar, student_code, phone, study_status
        )
      `)
      .in("makeup_session_id", sessionIds)
      .in("status", ["scheduled", "attended"]),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  if (makeupRes.error) throw makeupRes.error;

  type StudentBrief = Omit<DayStudentRow, "isMakeup" | "status" | "note">;

  const byClass = new Map<string, StudentBrief[]>();
  for (const r of membersRes.data as unknown as { class_id: string; student: StudentBrief | null }[]) {
    if (!r.student) continue;
    const list = byClass.get(r.class_id) ?? [];
    list.push(r.student);
    byClass.set(r.class_id, list);
  }

  const bySession = new Map<string, StudentBrief[]>();
  for (const r of makeupRes.data as unknown as {
    makeup_session_id: string;
    student: StudentBrief | null;
  }[]) {
    if (!r.student) continue;
    const list = bySession.get(r.makeup_session_id) ?? [];
    list.push(r.student);
    bySession.set(r.makeup_session_id, list);
  }

  const marks = new Map<string, { status: AttendanceStatus; note: string | null }>();
  for (const a of attendanceRes.data as unknown as {
    session_id: string;
    student_id: string;
    status: AttendanceStatus;
    note: string | null;
  }[]) {
    marks.set(`${a.session_id}:${a.student_id}`, { status: a.status, note: a.note });
  }

  return sessions.map((session) => {
    const members = session.class_id ? byClass.get(session.class_id) ?? [] : [];
    const memberIds = new Set(members.map((s) => s.id));
    const makeupStudents = (bySession.get(session.id) ?? []).filter((s) => !memberIds.has(s.id));

    const students: DayStudentRow[] = [
      ...members.map((s) => ({ ...s, isMakeup: false })),
      ...makeupStudents.map((s) => ({ ...s, isMakeup: true })),
    ]
      .map((s) => {
        const mark = marks.get(`${session.id}:${s.id}`);
        return { ...s, status: mark?.status ?? null, note: mark?.note ?? null };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    return { session, students };
  });
}

/** Đếm nhanh cho 4 ô thống kê đầu trang. */
export function daySummary(rows: DaySessionRow[]) {
  const students = rows.flatMap((r) => r.students);
  return {
    expected: students.length,
    attended: students.filter((s) => s.status === "present" || s.status === "makeup").length,
    reserved: students.filter((s) => s.study_status === "reserved").length,
    absent: students.filter(
      (s) => s.status === "absent_excused" || s.status === "absent_unexcused",
    ).length,
  };
}
