"use client";

/**
 * HỌC VIÊN ĐÃ NGHỈ / BẢO LƯU (migration 0039).
 *
 * Ba câu hỏi trang này phải trả lời được, và cách lấy dữ liệu cho từng câu:
 *   1. Vì sao mất học viên → `profiles.left_reason` (danh mục cố định).
 *   2. Nghỉ còn thừa bao nhiêu buổi, quy ra bao nhiêu tiền → view
 *      `package_balances`, quy đổi theo đơn giá mỗi buổi của chính gói đó.
 *   3. Ai đã gọi mời quay lại → `student_contacts` (0031), tính "đã mời"
 *      bằng việc có liên hệ ghi SAU ngày nghỉ, không thêm cột mới.
 *
 * Gộp ở client bằng vài query song song, cùng lý do đã ghi ở
 * `db-student-list.ts`: dữ liệu đã có sẵn, thêm view SQL là thêm một
 * migration phải bảo trì cho mỗi lần đổi cột hiển thị.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";
import type { StudyStatus } from "./db";
import { fetchPackageBalances } from "./db-tuition";

/* ================= Lý do nghỉ ================= */

export type LeaveReason =
  | "moved"
  | "schedule"
  | "finance"
  | "distance"
  | "finished"
  | "quality"
  | "teacher"
  | "health"
  | "switch"
  | "other";

/** Danh mục lý do — trùng đúng constraint `profiles_left_reason_check`. */
export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  moved: "Chuyển nhà / chuyển trường",
  schedule: "Bận lịch, không xếp được giờ",
  finance: "Học phí",
  distance: "Nhà xa trung tâm",
  finished: "Đã đạt mục tiêu / học xong",
  quality: "Chưa hài lòng chất lượng",
  teacher: "Không hợp giáo viên",
  health: "Sức khỏe / việc gia đình",
  switch: "Chuyển sang trung tâm khác",
  other: "Lý do khác",
};

export const LEAVE_REASONS = Object.keys(LEAVE_REASON_LABELS) as LeaveReason[];

/**
 * Lý do "mất khách vì mình" — nhóm cần đọc kỹ khi họp chất lượng, khác
 * hẳn nhóm khách quan (chuyển nhà, xong mục tiêu) mà trung tâm không đổi
 * được. Tách sẵn ở đây để trang thống kê không tự bịa cách nhóm.
 */
const PREVENTABLE: LeaveReason[] = ["quality", "teacher", "schedule", "finance"];

export function isPreventable(reason: LeaveReason | null): boolean {
  return !!reason && PREVENTABLE.includes(reason);
}

/* ================= Một dòng danh sách ================= */

export interface AlumniCourseBrief {
  name: string;
  level: string | null;
}

export interface AlumniRow {
  id: string;
  name: string;
  avatar: string | null;
  student_code: string | null;
  phone: string | null;
  email: string;

  /** Chỉ 'left' hoặc 'reserved' — trang này không nạp học viên đang học. */
  status: Exclude<StudyStatus, "studying">;
  leftAt: string | null;
  leftReason: LeaveReason | null;
  leftNote: string | null;
  returnAt: string | null;
  enrolledAt: string | null;

  parentName: string | null;
  parentPhone: string | null;
  ownerName: string | null;

  /** Các lớp em từng học (mới nhất trước không xác định được → giữ nguyên). */
  classes: string[];
  courses: AlumniCourseBrief[];
  /** Trình độ đã học, bỏ trùng — dùng để lọc khi mở khóa mới. */
  levels: string[];

  /** Buổi còn thừa trong gói tại thời điểm nghỉ + giá trị quy ra tiền. */
  remainingSessions: number;
  leftoverValue: number;
  debt: number;

  /** Số ngày kể từ ngày nghỉ (null khi chưa có ngày nghỉ). */
  daysSinceLeft: number | null;
  lastContactAt: string | null;
  /** Đã có người liên hệ SAU ngày nghỉ = đã mời quay lại. */
  invited: boolean;
}

interface AlumniProfile {
  id: string;
  name: string;
  avatar: string | null;
  student_code: string | null;
  phone: string | null;
  email: string;
  study_status: StudyStatus;
  left_at: string | null;
  left_reason: LeaveReason | null;
  left_note: string | null;
  return_at: string | null;
  enrolled_at: string | null;
  owner: { name: string } | null;
  class_students: { class: { name: string } | null }[];
  student_courses: { course: { name: string; level: string | null } | null }[];
}

/** Số ngày từ một ngày ISO tới hôm nay (âm = ngày trong tương lai). */
export function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
}

/** "3 tháng trước" / "12 ngày trước" — đọc nhanh hơn ngày tháng thuần. */
export function agoLabel(days: number | null): string {
  if (days === null) return "chưa rõ";
  if (days <= 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  if (days < 30) return `${days} ngày trước`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} năm trước` : `${years} năm ${rest} tháng trước`;
}

export async function fetchAlumni(): Promise<AlumniRow[]> {
  const supabase = getSupabase();

  const { data: profileData, error: profileError } = await branchFilter(
    supabase
      .from("profiles")
      .select(`
        id, name, avatar, student_code, phone, email, study_status,
        left_at, left_reason, left_note, return_at, enrolled_at,
        owner:owner_id ( name ),
        class_students!class_students_student_id_fkey ( class:classes ( name ) ),
        student_courses ( course:courses ( name, level ) )
      `)
      .eq("role", "student")
      .in("study_status", ["left", "reserved"]),
  ).order("left_at", { ascending: false, nullsFirst: false });
  if (profileError) throw profileError;

  const profiles = profileData as unknown as AlumniProfile[];
  if (profiles.length === 0) return [];

  const [packages, parentRes, contactRes] = await Promise.all([
    fetchPackageBalances(),
    supabase
      .from("parent_students")
      .select("student_id, parent:profiles!parent_students_parent_id_fkey ( name, phone )"),
    // Chỉ cần lần liên hệ gần nhất của mỗi em; lấy mới → cũ rồi giữ dòng
    // đầu tiên gặp được, rẻ hơn nhiều query distinct-on qua PostgREST.
    supabase
      .from("student_contacts")
      .select("student_id, contacted_at")
      .order("contacted_at", { ascending: false })
      .limit(5000),
  ]);
  if (parentRes.error) throw parentRes.error;
  if (contactRes.error) throw contactRes.error;

  const parentOf = new Map<string, { name: string; phone: string | null }>();
  for (const r of parentRes.data as unknown as {
    student_id: string;
    parent: { name: string; phone: string | null } | null;
  }[]) {
    if (r.parent && !parentOf.has(r.student_id)) parentOf.set(r.student_id, r.parent);
  }

  const lastContactOf = new Map<string, string>();
  for (const r of contactRes.data as { student_id: string; contacted_at: string }[]) {
    if (!lastContactOf.has(r.student_id)) lastContactOf.set(r.student_id, r.contacted_at);
  }

  /* --- Gói buổi: cộng dồn, buổi thừa quy tiền theo đơn giá từng gói --- */
  const packageOf = new Map<string, { remaining: number; value: number; debt: number }>();
  for (const p of packages) {
    const acc = packageOf.get(p.student_id) ?? { remaining: 0, value: 0, debt: 0 };
    const remaining = Number(p.remaining_sessions) || 0;
    const total = Number(p.total_sessions) || 0;
    acc.remaining += remaining;
    // Buổi thừa đáng bao nhiêu tiền tính theo giá SAU ưu đãi của chính gói
    // đó — đây là con số dùng khi thương lượng bảo lưu hay hoàn phí.
    if (total > 0 && remaining > 0) {
      acc.value += Math.round((Number(p.final_price) || 0) * (remaining / total));
    }
    acc.debt += Number(p.debt) || 0;
    packageOf.set(p.student_id, acc);
  }

  return profiles.map((p) => {
    const pkg = packageOf.get(p.id);
    const parent = parentOf.get(p.id);
    const lastContactAt = lastContactOf.get(p.id) ?? null;
    const courses = (p.student_courses ?? [])
      .map((c) => c.course)
      .filter((c): c is { name: string; level: string | null } => !!c);

    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      student_code: p.student_code,
      phone: p.phone,
      email: p.email,

      status: p.study_status as Exclude<StudyStatus, "studying">,
      leftAt: p.left_at,
      leftReason: p.left_reason,
      leftNote: p.left_note,
      returnAt: p.return_at,
      enrolledAt: p.enrolled_at,

      parentName: parent?.name ?? null,
      parentPhone: parent?.phone ?? null,
      ownerName: p.owner?.name ?? null,

      classes: [
        ...new Set(
          (p.class_students ?? []).map((l) => l.class?.name).filter((n): n is string => !!n),
        ),
      ],
      courses,
      levels: [...new Set(courses.map((c) => c.level).filter((l): l is string => !!l))],

      remainingSessions: pkg?.remaining ?? 0,
      leftoverValue: pkg?.value ?? 0,
      debt: pkg?.debt ?? 0,

      daysSinceLeft: p.left_at ? daysSince(p.left_at) : null,
      lastContactAt,
      invited: !!lastContactAt && !!p.left_at && lastContactAt.slice(0, 10) >= p.left_at,
    };
  });
}

/* ================= Ghi nhận / hoàn tác việc nghỉ ================= */

export interface LeaveInput {
  status: Exclude<StudyStatus, "studying">;
  leftAt: string | null;
  reason: LeaveReason | null;
  note: string | null;
  returnAt: string | null;
}

/** Cập nhật hồ sơ nghỉ / bảo lưu (dùng cho cả ô sửa trên danh sách). */
export async function saveLeaveInfo(id: string, input: LeaveInput) {
  const { error } = await getSupabase()
    .from("profiles")
    .update({
      study_status: input.status,
      left_at: input.leftAt,
      left_reason: input.reason,
      left_note: input.note?.trim() || null,
      return_at: input.returnAt,
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Cho học viên học lại. Trigger 0039 tự xóa ngày nghỉ / lý do / hẹn quay
 * lại, ở đây chỉ cần đổi trạng thái — gửi kèm null sẽ thừa và dễ lệch
 * nếu sau này trigger đổi cách xử lý.
 */
export async function reactivateStudent(id: string) {
  const { error } = await getSupabase()
    .from("profiles")
    .update({ study_status: "studying" })
    .eq("id", id);
  if (error) throw error;
}

/* ================= Thống kê ================= */

export interface ReasonStat {
  reason: LeaveReason | null;
  label: string;
  count: number;
  percent: number;
}

/** Đếm theo lý do, nhiều nhất trước; nhóm chưa ghi lý do xếp cuối. */
export function reasonStats(rows: AlumniRow[]): ReasonStat[] {
  const counts = new Map<LeaveReason | null, number>();
  for (const r of rows) counts.set(r.leftReason, (counts.get(r.leftReason) ?? 0) + 1);
  const total = rows.length || 1;
  return [...counts.entries()]
    .map(([reason, count]) => ({
      reason,
      label: reason ? LEAVE_REASON_LABELS[reason] : "Chưa ghi lý do",
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => {
      if ((a.reason === null) !== (b.reason === null)) return a.reason === null ? 1 : -1;
      return b.count - a.count || a.label.localeCompare(b.label, "vi");
    });
}
