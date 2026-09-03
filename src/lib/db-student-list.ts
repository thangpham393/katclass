"use client";

/**
 * DANH SÁCH HỌC VIÊN của ban quản lý — gộp mọi thứ một dòng cần hiện:
 * hồ sơ, phụ huynh, lớp + giáo viên phụ trách, gói buổi (đã dùng/còn lại,
 * công nợ) và điểm danh gần đây.
 *
 * Gộp ở tầng client bằng 4 query song song thay vì một view SQL: dữ liệu
 * đã có sẵn ở `package_balances` và `attendance`, viết view mới sẽ phải
 * bảo trì thêm một migration cho mỗi lần đổi cột hiển thị.
 */

import { getSupabase } from "./supabase";
import { branchFilter } from "./branch";
import {
  createStudentProfile,
  provisionAccount,
  todayISO,
  type AttendanceStatus,
  type ProfileRow,
  type StudyStatus,
} from "./db";
import { createParentProfile, linkParentStudent } from "./db-student";
import { fetchPackageBalances } from "./db-tuition";

/** Số ngày điểm danh lấy về để tính chuyên cần (đủ cho ~2 học kỳ ngắn). */
const ATTENDANCE_WINDOW_DAYS = 120;

/** Số ô điểm danh gần nhất vẽ thành dãy chấm màu trên mỗi dòng. */
export const RECENT_DOTS = 5;

/** Mức chuyên cần quy từ tỉ lệ có mặt của các buổi gần đây. */
export type Diligence = "great" | "good" | "ok" | "warn" | "none";

export const DILIGENCE_META: Record<Diligence, { emoji: string; label: string }> = {
  great: { emoji: "🔥", label: "Đi học rất đều" },
  good: { emoji: "😊", label: "Chuyên cần tốt" },
  ok: { emoji: "💪", label: "Có vắng đôi buổi" },
  warn: { emoji: "⚠️", label: "Vắng nhiều — nên gọi phụ huynh" },
  none: { emoji: "—", label: "Chưa có buổi nào" },
};

export interface StudentClassBrief {
  id: string;
  name: string;
  active: boolean;
  teacher: string | null;
}

export interface StudentListRow {
  id: string;
  name: string;
  avatar: string | null;
  email: string;
  phone: string | null;
  student_code: string | null;
  user_id: string | null;
  created_at: string;
  dob: string | null;
  enrolledAt: string | null;
  ownerId: string | null;

  parentName: string | null;
  parentPhone: string | null;

  classes: StudentClassBrief[];
  /** Giáo viên của các lớp đang học (bỏ trùng). */
  teachers: string[];
  /** Nhân viên phụ trách chăm sóc (profiles.owner_id). */
  ownerName: string | null;
  /** Cột `study_status` — không suy từ lớp nữa (0030). */
  status: StudyStatus;
  /** Chưa có lớp nào đang hoạt động. */
  unassigned: boolean;
  courses: string[];

  /** Gói buổi: cộng dồn mọi gói còn hiệu lực. */
  hasPackage: boolean;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  debt: number;

  /** Điểm danh trong cửa sổ ATTENDANCE_WINDOW_DAYS. */
  recent: AttendanceStatus[]; // cũ → mới, tối đa RECENT_DOTS
  absences: number; // vắng (cả có phép lẫn không phép)
  makeups: number; // số buổi đã học bù
  diligence: Diligence;
}

interface ProfileWithLinks extends ProfileRow {
  class_students: {
    status: string;
    class: { id: string; name: string; teacher: { name: string } | null } | null;
  }[];
  owner: { name: string } | null;
  student_courses: { course: { name: string } | null }[];
}

function diligenceOf(recentAll: AttendanceStatus[]): Diligence {
  if (recentAll.length === 0) return "none";
  const window = recentAll.slice(-10);
  const attended = window.filter((s) => s === "present" || s === "makeup").length;
  const rate = attended / window.length;
  if (rate >= 0.95) return "great";
  if (rate >= 0.85) return "good";
  if (rate >= 0.7) return "ok";
  return "warn";
}

export async function fetchStudentList(): Promise<StudentListRow[]> {
  const supabase = getSupabase();

  const profilesQuery = branchFilter(
    supabase
      .from("profiles")
      .select(`
        *,
        owner:owner_id ( name ),
        class_students!class_students_student_id_fkey (
          status,
          class:classes ( id, name, teacher:profiles!classes_teacher_id_fkey ( name ) )
        ),
        student_courses ( course:courses ( name ) )
      `)
      .eq("role", "student"),
  ).order("name");

  const { data: profileData, error: profileError } = await profilesQuery;
  if (profileError) throw profileError;
  const profiles = profileData as unknown as ProfileWithLinks[];
  if (profiles.length === 0) return [];

  const [packages, parentRes, attendanceRes] = await Promise.all([
    fetchPackageBalances(),
    // Không lọc theo danh sách id: URL `in.(...)` với vài trăm uuid dễ vượt
    // giới hạn độ dài; RLS đã chặn đúng phạm vi, lọc lại khi ghép ở dưới.
    supabase
      .from("parent_students")
      .select("student_id, parent:profiles!parent_students_parent_id_fkey ( name, phone )"),
    branchFilter(
      supabase
        .from("attendance")
        .select("student_id, status, marked_at, session:sessions!inner ( date )")
        .gte("session.date", todayISO(-ATTENDANCE_WINDOW_DAYS)),
      "session.branch_id",
    )
      .order("marked_at", { ascending: true })
      .limit(20000),
  ]);
  if (parentRes.error) throw parentRes.error;
  if (attendanceRes.error) throw attendanceRes.error;

  /* --- phụ huynh: lấy người đầu tiên (đa số chỉ liên kết 1) --- */
  const parentOf = new Map<string, { name: string; phone: string | null }>();
  for (const r of parentRes.data as unknown as {
    student_id: string;
    parent: { name: string; phone: string | null } | null;
  }[]) {
    if (r.parent && !parentOf.has(r.student_id)) parentOf.set(r.student_id, r.parent);
  }

  /* --- gói buổi: cộng dồn các gói của cùng học viên --- */
  const packageOf = new Map<
    string,
    { total: number; used: number; remaining: number; debt: number }
  >();
  for (const p of packages) {
    const acc = packageOf.get(p.student_id) ?? { total: 0, used: 0, remaining: 0, debt: 0 };
    acc.total += Number(p.total_sessions) || 0;
    acc.used += Number(p.used_sessions) || 0;
    acc.remaining += Number(p.remaining_sessions) || 0;
    acc.debt += Number(p.debt) || 0;
    packageOf.set(p.student_id, acc);
  }

  /* --- điểm danh: đã sắp cũ → mới nên chỉ cần đẩy vào cuối mảng --- */
  const attendanceOf = new Map<string, AttendanceStatus[]>();
  for (const r of attendanceRes.data as unknown as {
    student_id: string;
    status: AttendanceStatus;
  }[]) {
    const list = attendanceOf.get(r.student_id) ?? [];
    list.push(r.status);
    attendanceOf.set(r.student_id, list);
  }

  return profiles.map((p) => {
    const links = p.class_students ?? [];
    const classes: StudentClassBrief[] = links
      .filter((l) => l.class)
      .map((l) => ({
        id: l.class!.id,
        name: l.class!.name,
        active: l.status === "active",
        teacher: l.class!.teacher?.name ?? null,
      }));
    const teachers = [
      ...new Set(classes.filter((c) => c.active && c.teacher).map((c) => c.teacher!)),
    ];

    const pkg = packageOf.get(p.id);
    const marks = attendanceOf.get(p.id) ?? [];
    const parent = parentOf.get(p.id);

    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      email: p.email,
      phone: p.phone,
      student_code: p.student_code,
      user_id: p.user_id,
      created_at: p.created_at,
      dob: p.dob,
      enrolledAt: p.enrolled_at,
      ownerId: p.owner_id,

      parentName: parent?.name ?? null,
      parentPhone: parent?.phone ?? null,

      classes,
      teachers,
      ownerName: p.owner?.name ?? null,
      status: p.study_status,
      unassigned: !classes.some((c) => c.active),
      courses: (p.student_courses ?? []).map((c) => c.course?.name).filter((n): n is string => !!n),

      hasPackage: !!pkg,
      totalSessions: pkg?.total ?? 0,
      usedSessions: pkg?.used ?? 0,
      remainingSessions: pkg?.remaining ?? 0,
      debt: pkg?.debt ?? 0,

      recent: marks.slice(-RECENT_DOTS),
      absences: marks.filter((s) => s === "absent_excused" || s === "absent_unexcused").length,
      makeups: marks.filter((s) => s === "makeup").length,
      diligence: diligenceOf(marks),
    };
  });
}

/** Sửa nhanh hồ sơ học viên ngay trong danh sách. */
export async function updateStudentProfile(
  id: string,
  patch: {
    name?: string;
    phone?: string | null;
    email?: string;
    address?: string | null;
    note?: string | null;
    dob?: string | null;
    enrolled_at?: string | null;
    study_status?: StudyStatus;
    owner_id?: string | null;
  },
) {
  const { error } = await getSupabase().from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/* ============ Danh mục cho form "Học viên mới" ============ */

export interface OwnerOption {
  id: string;
  name: string;
  role: string;
}

/** Người có thể đứng tên phụ trách một học viên: giáo viên + nhân viên. */
export async function fetchOwnerCandidates(): Promise<OwnerOption[]> {
  const { data, error } = await branchFilter(
    getSupabase()
      .from("profiles")
      .select("id, name, role")
      .in("role", ["teacher", "staff", "accountant", "admin"]),
  ).order("name");
  if (error) throw error;
  return data as OwnerOption[];
}

/* ============ Tạo học viên mới (form đầy đủ) ============ */

export interface StudentScheduleInput {
  weekday: number;
  start_time: string;
  end_time: string | null;
  teacher_id: string | null;
  room_id: string | null;
}

export interface NewStudentInput {
  name: string;
  dob: string | null;
  phone: string;
  email: string;
  address: string;
  note: string;
  enrolledAt: string | null;
  studyStatus: StudyStatus;
  branchId: string | null;
  ownerId: string | null;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  classIds: string[];
  courseIds: string[];
  schedules: StudentScheduleInput[];
}

/**
 * Tạo học viên từ form đầy đủ. Làm tuần tự vì các bước sau cần id hồ sơ;
 * hồ sơ tạo được rồi thì lỗi ở bước phụ (phụ huynh, lớp, khóa, ca học,
 * tài khoản) KHÔNG hủy học viên — trả về danh sách cảnh báo để màn hình
 * báo "đã tạo nhưng thiếu phần này", tránh cảnh nhập lại từ đầu.
 */
export async function createStudentFull(
  input: NewStudentInput,
): Promise<{ profile: ProfileRow; warnings: string[] }> {
  const supabase = getSupabase();
  const warnings: string[] = [];

  const profile = await createStudentProfile({
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    note: input.note,
    dob: input.dob,
    enrolled_at: input.enrolledAt,
    study_status: input.studyStatus,
    owner_id: input.ownerId,
    branch_id: input.branchId,
  });

  /* --- Phụ huynh: dùng lại hồ sơ cũ nếu trùng số điện thoại --- */
  const parentName = input.parentName.trim();
  const parentPhone = input.parentPhone.trim();
  if (parentName || parentPhone) {
    try {
      let parentId: string | null = null;
      if (parentPhone) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "parent")
          .eq("phone", parentPhone)
          .limit(1);
        parentId = (data as { id: string }[] | null)?.[0]?.id ?? null;
      }
      if (!parentId) {
        const created = await createParentProfile({
          name: parentName || `Phụ huynh ${input.name.trim()}`,
          phone: parentPhone,
          email: input.parentEmail,
        });
        parentId = created.id;
      }
      await linkParentStudent(parentId, profile.id, "guardian");
    } catch {
      warnings.push("chưa tạo/nối được hồ sơ phụ huynh");
    }
  }

  if (input.classIds.length > 0) {
    const { error } = await supabase.from("class_students").insert(
      input.classIds.map((class_id) => ({ class_id, student_id: profile.id, status: "active" })),
    );
    if (error) warnings.push("chưa xếp được vào lớp đã chọn");
  }

  if (input.courseIds.length > 0) {
    const { error } = await supabase.from("student_courses").insert(
      input.courseIds.map((course_id) => ({ course_id, student_id: profile.id })),
    );
    if (error) warnings.push("chưa ghi danh được khóa học");
  }

  const schedules = input.schedules.filter((s) => s.weekday >= 0 && s.start_time);
  if (schedules.length > 0) {
    const { error } = await supabase.from("student_schedules").insert(
      schedules.map((s) => ({ ...s, student_id: profile.id })),
    );
    if (error) warnings.push("chưa lưu được ca học riêng");
  }

  try {
    await provisionAccount(profile.id);
  } catch {
    warnings.push("chưa cấp được tài khoản đăng nhập");
  }

  return { profile, warnings };
}
