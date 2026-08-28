import type { Role } from "./types";

/** Tên vai trò hiển thị cho người dùng — dùng chung mọi nơi để khỏi lệch chữ. */
export const ROLE_LABELS: Record<Role, string> = {
  student: "Học viên",
  parent: "Phụ huynh",
  teacher: "Giáo viên",
  staff: "Hành chính",
  accountant: "Kế toán",
  admin: "Quản lý",
};
