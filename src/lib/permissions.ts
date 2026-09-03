"use client";

import { getSupabase } from "./supabase";
import type { Role } from "./types";

/**
 * Quyền theo vai trò — nguồn duy nhất là bảng `role_permissions` (migration
 * 0027). Mỗi khóa ở đây ĐỀU được RLS thi hành thật, không có khóa nào chỉ để
 * ẩn menu: bỏ tích là database từ chối, gõ thẳng URL cũng không lấy được
 * dữ liệu.
 *
 * Admin không đọc bảng này — `has_perm()` trả true vô điều kiện để quản lý
 * không thể tự khóa mình ra ngoài.
 */
export type Permission =
  | "classes.manage"
  | "courses.manage"
  | "attendance.manage"
  | "makeup.manage"
  | "requests.manage"
  | "students.manage"
  | "team.manage"
  | "library.manage"
  | "textbooks.manage"
  | "homework.manage"
  | "classroom.teach"
  | "tuition.manage"
  | "finance.view"
  | "supplies.manage"
  | "payroll.view"
  | "reports.view"
  | "settings.manage";

export interface PermissionDef {
  key: Permission;
  label: string;
  hint: string;
}

/** Nhóm để bày thành ma trận trong trang Cài đặt. */
export const PERMISSION_GROUPS: { group: string; items: PermissionDef[] }[] = [
  {
    group: "Vận hành lớp",
    items: [
      {
        key: "classes.manage",
        label: "Lớp & lịch học",
        hint: "Tạo/sửa lớp, lịch tuần, sinh buổi học, xếp học viên vào lớp.",
      },
      {
        key: "courses.manage",
        label: "Khóa học",
        hint: "Tạo và sửa chương trình khóa học của trung tâm.",
      },
      {
        key: "attendance.manage",
        label: "Điểm danh mọi lớp",
        hint: "Điểm danh hộ lớp mình không dạy. Giáo viên luôn điểm danh được lớp của chính mình.",
      },
      {
        key: "supplies.manage",
        label: "Kho học cụ",
        hint: "Sửa danh mục học cụ, ghi phiếu nhập/xuất kho. Mọi nhân sự vẫn xem được tồn kho.",
      },
      {
        key: "makeup.manage",
        label: "Học bù",
        hint: "Xem hàng chờ học bù và xếp học viên vào buổi bù.",
      },
      {
        key: "requests.manage",
        label: "Duyệt nghỉ / đổi buổi",
        hint: "Xem và duyệt đơn xin nghỉ, đổi buổi của giáo viên.",
      },
    ],
  },
  {
    group: "Hồ sơ người",
    items: [
      {
        key: "students.manage",
        label: "Học viên & phụ huynh",
        hint: "Thêm/sửa hồ sơ học viên, phụ huynh và liên kết gia đình.",
      },
      {
        key: "team.manage",
        label: "Giáo viên & nhân viên",
        hint: "Thêm/sửa hồ sơ đội ngũ. Hồ sơ quản lý và kế toán vẫn chỉ admin đụng được.",
      },
    ],
  },
  {
    group: "Học liệu & bài tập",
    items: [
      {
        key: "library.manage",
        label: "Bài học, từ vựng, câu hỏi",
        hint: "Soạn bài học, kho từ vựng, ngân hàng câu hỏi và đáp án.",
      },
      {
        key: "textbooks.manage",
        label: "Giáo trình & thư viện bài tập",
        hint: "Nhập giáo trình, bộ bài tập từ file JSON.",
      },
      {
        key: "homework.manage",
        label: "Bài tập & bài kiểm tra mọi lớp",
        hint: "Giao, chấm, xem bài nộp của lớp mình không dạy.",
      },
      {
        key: "classroom.teach",
        label: "Lớp học trực tiếp & chấm công ca dạy",
        hint: "Vào lớp dạy hộ, cộng sao, ghi nhận xét, chấm công ca dạy cho giáo viên khác.",
      },
    ],
  },
  {
    group: "Tiền",
    items: [
      {
        key: "tuition.manage",
        label: "Học phí & hóa đơn",
        hint: "Bán gói buổi, thu tiền, xuất biên lai, lập hóa đơn gửi khách, xem công nợ.",
      },
      {
        key: "finance.view",
        label: "Doanh thu — chi phí — lợi nhuận",
        hint: "Xem và ghi sổ thu chi toàn trung tâm. Sổ chi có cả lương nên tách riêng khỏi học phí.",
      },
      {
        key: "payroll.view",
        label: "Lương & bảng công giáo viên",
        hint: "Xem và sửa mức lương, bảng công, tiền công. Quyền nhạy cảm nhất.",
      },
    ],
  },
  {
    group: "Khác",
    items: [
      {
        key: "reports.view",
        label: "Báo cáo chuyên cần",
        hint: "Xem thống kê điểm danh toàn trung tâm.",
      },
      {
        key: "settings.manage",
        label: "Cài đặt hệ thống",
        hint: "Chi nhánh và phòng học. Riêng bảng phân quyền này luôn chỉ admin sửa được.",
      },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

/**
 * Trang nào cần quyền nào. Dùng chung cho hai chỗ để không bao giờ lệch nhau:
 * lọc menu ở sidebar, và chặn truy cập ở AuthGuard.
 *
 * Trang không có tên ở đây thì ai vào được khu vực đó là xem được — cụ thể là
 * Tổng quan và Thời khóa biểu: cả hai chỉ đọc khung lớp/buổi mà mọi module
 * khác đều cần, RLS không tách riêng được nên không đưa vào ma trận (đưa vào
 * sẽ thành ô tích trang trí).
 */
export const ROUTE_PERMISSION: { prefix: string; perm: Permission }[] = [
  { prefix: "/admin/courses", perm: "courses.manage" },
  { prefix: "/admin/attendance", perm: "attendance.manage" },
  { prefix: "/admin/absences", perm: "students.manage" },
  { prefix: "/admin/leads", perm: "students.manage" },
  { prefix: "/admin/birthdays", perm: "students.manage" },
  { prefix: "/admin/alumni", perm: "students.manage" },
  { prefix: "/admin/revenue", perm: "finance.view" },
  { prefix: "/admin/supplies", perm: "supplies.manage" },
  { prefix: "/admin/centers", perm: "settings.manage" },
  { prefix: "/admin/data", perm: "settings.manage" },
  { prefix: "/admin/classes", perm: "classes.manage" },
  { prefix: "/admin/students", perm: "students.manage" },
  { prefix: "/admin/teachers", perm: "team.manage" },
  { prefix: "/admin/makeup", perm: "makeup.manage" },
  { prefix: "/admin/requests", perm: "requests.manage" },
  { prefix: "/admin/tuition", perm: "tuition.manage" },
  { prefix: "/admin/payroll", perm: "payroll.view" },
  { prefix: "/admin/reports", perm: "reports.view" },
  { prefix: "/admin/settings", perm: "settings.manage" },
  { prefix: "/library/textbooks", perm: "textbooks.manage" },
  { prefix: "/library/exercises", perm: "textbooks.manage" },
  { prefix: "/library/lessons", perm: "library.manage" },
  { prefix: "/library/vocab", perm: "library.manage" },
  { prefix: "/library/questions", perm: "library.manage" },
];

/** Quyền cần có để mở một đường dẫn; null = ai vào khu vực cũng xem được. */
export function permissionForPath(pathname: string): Permission | null {
  const hit = ROUTE_PERMISSION.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  return hit?.perm ?? null;
}

/* ============ Đọc / ghi bảng quyền ============ */

/**
 * Quyền mặc định dùng khi KHÔNG đọc được bảng (chưa chạy migration 0027,
 * mất mạng…). Trùng đúng phần seed của 0027 nên giao diện không đột ngột
 * trống trơn. Chỉ ảnh hưởng việc ẩn/hiện: RLS vẫn là bên quyết định cuối.
 */
const FALLBACK_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  accountant: ALL_PERMISSIONS,
  staff: ALL_PERMISSIONS.filter(
    (p) => !(["payroll.view", "finance.view", "tuition.manage"] as Permission[]).includes(p),
  ),
  teacher: ["library.manage"],
  student: [],
  parent: [],
};

/** Quyền của đúng một vai trò — gọi lúc đăng nhập. */
export async function fetchPermissionsForRole(role: Role): Promise<Permission[]> {
  if (role === "admin") return ALL_PERMISSIONS;
  const { data, error } = await getSupabase()
    .from("role_permissions")
    .select("permission")
    .eq("role", role);
  if (error) {
    console.warn(
      "Không đọc được bảng role_permissions (đã chạy migration 0027 chưa?) — tạm dùng quyền mặc định.",
      error,
    );
    return FALLBACK_PERMISSIONS[role] ?? [];
  }
  return (data ?? []).map((r) => r.permission as Permission);
}

/** Cả ma trận — cho màn Cài đặt. */
export async function fetchPermissionMatrix(): Promise<Record<string, Permission[]>> {
  const { data, error } = await getSupabase()
    .from("role_permissions")
    .select("role, permission");
  if (error) throw error;
  const map: Record<string, Permission[]> = {};
  for (const r of data ?? []) {
    (map[r.role] ??= []).push(r.permission as Permission);
  }
  return map;
}

export async function grantPermission(role: Role, permission: Permission) {
  const { error } = await getSupabase()
    .from("role_permissions")
    .insert({ role, permission });
  if (error) throw error;
}

export async function revokePermission(role: Role, permission: Permission) {
  const { error } = await getSupabase()
    .from("role_permissions")
    .delete()
    .eq("role", role)
    .eq("permission", permission);
  if (error) throw error;
}
