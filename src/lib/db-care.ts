"use client";

/**
 * CHĂM SÓC HỌC VIÊN: đếm buổi vắng liên tiếp + nhật ký liên hệ (0031).
 *
 * "Vắng liên tiếp" tính ngược từ điểm danh chứ không có cột đếm sẵn: lấy
 * các buổi đã điểm danh của từng em, xếp mới → cũ, đếm chuỗi vắng ở đầu
 * dãy. Buổi CHƯA điểm danh không tính là vắng — lớp quên tick thì không
 * được phép biến thành báo động giả gọi phụ huynh.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";
import { todayISO, type AttendanceStatus, type StudyStatus } from "./db";

/** Cửa sổ điểm danh lấy về để dò chuỗi vắng. */
const WINDOW_DAYS = 120;

export type ContactChannel = "call" | "zalo" | "sms" | "meet" | "other";
export type ContactOutcome = "reached" | "no_answer" | "handled";

export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  call: "Gọi điện",
  zalo: "Nhắn Zalo",
  sms: "Tin nhắn",
  meet: "Gặp trực tiếp",
  other: "Khác",
};

export const CONTACT_OUTCOME_LABELS: Record<ContactOutcome, string> = {
  reached: "Đã liên hệ được",
  no_answer: "Không nghe máy",
  handled: "Đã xử lý xong",
};

export interface ContactLogRow {
  id: string;
  student_id: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string | null;
  contacted_at: string;
  contacted_by_name: string | null;
}

export interface MissedSessionBrief {
  date: string;
  className: string | null;
  status: AttendanceStatus;
}

export interface AbsenceStreakRow {
  id: string;
  name: string;
  avatar: string | null;
  student_code: string | null;
  phone: string | null;
  study_status: StudyStatus;
  parentName: string | null;
  parentPhone: string | null;
  className: string | null;
  /** Số buổi vắng liên tiếp tính từ buổi gần nhất. */
  streak: number;
  /** Các buổi vắng trong chuỗi, mới → cũ. */
  missed: MissedSessionBrief[];
  /** Ngày đi học gần nhất (null = chưa từng có mặt trong cửa sổ). */
  lastPresent: string | null;
  /** Lần liên hệ gần nhất; đã liên hệ SAU buổi vắng cuối thì coi như đã xử lý. */
  lastContact: ContactLogRow | null;
  contactedAfterAbsence: boolean;
}

interface AttendanceJoin {
  student_id: string;
  status: AttendanceStatus;
  session: { date: string; class: { name: string } | null } | null;
}

/**
 * Học viên đang vắng liên tiếp ít nhất `minStreak` buổi, xếp em vắng
 * nhiều nhất lên đầu. Học viên đã nghỉ hẳn không tính (`study_status`).
 */
export async function fetchAbsenceStreaks(minStreak = 2): Promise<AbsenceStreakRow[]> {
  const supabase = getSupabase();

  const { data: attendanceData, error } = await branchFilter(
    supabase
      .from("attendance")
      .select("student_id, status, session:sessions!inner ( date, class:classes ( name ) )")
      .gte("session.date", todayISO(-WINDOW_DAYS)),
    "session.branch_id",
  ).limit(20000);
  if (error) throw error;

  /* --- Gom theo học viên, xếp mới → cũ rồi đếm chuỗi vắng ở đầu dãy --- */
  const byStudent = new Map<string, AttendanceJoin[]>();
  for (const r of attendanceData as unknown as AttendanceJoin[]) {
    if (!r.session) continue;
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r);
    byStudent.set(r.student_id, list);
  }

  const streaks = new Map<
    string,
    { missed: MissedSessionBrief[]; lastPresent: string | null }
  >();
  for (const [studentId, rows] of byStudent) {
    rows.sort((a, b) => b.session!.date.localeCompare(a.session!.date));
    const missed: MissedSessionBrief[] = [];
    let lastPresent: string | null = null;
    for (const r of rows) {
      const isAbsent = r.status === "absent_excused" || r.status === "absent_unexcused";
      if (isAbsent && lastPresent === null) {
        missed.push({
          date: r.session!.date,
          className: r.session!.class?.name ?? null,
          status: r.status,
        });
      } else if (!isAbsent) {
        // present / makeup: chuỗi vắng dừng ở đây
        lastPresent = r.session!.date;
        break;
      }
    }
    if (missed.length >= minStreak) streaks.set(studentId, { missed, lastPresent });
  }

  const ids = [...streaks.keys()];
  if (ids.length === 0) return [];

  const [profileRes, parentRes, contactRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, avatar, student_code, phone, study_status")
      .in("id", ids),
    supabase
      .from("parent_students")
      .select("student_id, parent:profiles!parent_students_parent_id_fkey ( name, phone )")
      .in("student_id", ids),
    supabase
      .from("student_contacts")
      .select("id, student_id, channel, outcome, note, contacted_at, by:contacted_by ( name )")
      .in("student_id", ids)
      .order("contacted_at", { ascending: false }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (parentRes.error) throw parentRes.error;
  if (contactRes.error) throw contactRes.error;

  const parentOf = new Map<string, { name: string; phone: string | null }>();
  for (const r of parentRes.data as unknown as {
    student_id: string;
    parent: { name: string; phone: string | null } | null;
  }[]) {
    if (r.parent && !parentOf.has(r.student_id)) parentOf.set(r.student_id, r.parent);
  }

  const contactOf = new Map<string, ContactLogRow>();
  for (const r of contactRes.data as unknown as (Omit<ContactLogRow, "contacted_by_name"> & {
    by: { name: string } | null;
  })[]) {
    // Đã sắp mới → cũ nên bản ghi đầu tiên của mỗi em là lần liên hệ gần nhất
    if (!contactOf.has(r.student_id)) {
      contactOf.set(r.student_id, { ...r, contacted_by_name: r.by?.name ?? null });
    }
  }

  const rows: AbsenceStreakRow[] = [];
  for (const p of profileRes.data as unknown as {
    id: string;
    name: string;
    avatar: string | null;
    student_code: string | null;
    phone: string | null;
    study_status: StudyStatus;
  }[]) {
    if (p.study_status === "left") continue; // đã nghỉ hẳn thì không phải việc gọi nữa
    const streak = streaks.get(p.id)!;
    const parent = parentOf.get(p.id);
    const lastContact = contactOf.get(p.id) ?? null;
    const lastMissedDate = streak.missed[0]?.date ?? null;
    rows.push({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      student_code: p.student_code,
      phone: p.phone,
      study_status: p.study_status,
      parentName: parent?.name ?? null,
      parentPhone: parent?.phone ?? null,
      className: streak.missed.find((m) => m.className)?.className ?? null,
      streak: streak.missed.length,
      missed: streak.missed,
      lastPresent: streak.lastPresent,
      lastContact,
      contactedAfterAbsence:
        !!lastContact && !!lastMissedDate && lastContact.contacted_at.slice(0, 10) >= lastMissedDate,
    });
  }

  return rows.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name, "vi"));
}

/** Ghi nhận một lần liên hệ phụ huynh/học viên. */
export async function addStudentContact(input: {
  student_id: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note?: string;
  contacted_by: string;
}) {
  const { error } = await getSupabase().from("student_contacts").insert({
    student_id: input.student_id,
    channel: input.channel,
    outcome: input.outcome,
    note: input.note?.trim() || null,
    contacted_by: input.contacted_by,
  });
  if (error) throw error;
}

/** Toàn bộ lịch sử liên hệ của một học viên (hồ sơ chi tiết). */
export async function fetchStudentContacts(studentId: string): Promise<ContactLogRow[]> {
  const { data, error } = await getSupabase()
    .from("student_contacts")
    .select("id, student_id, channel, outcome, note, contacted_at, by:contacted_by ( name )")
    .eq("student_id", studentId)
    .order("contacted_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as (Omit<ContactLogRow, "contacted_by_name"> & { by: { name: string } | null })[]).map(
    (r) => ({ ...r, contacted_by_name: r.by?.name ?? null }),
  );
}
