import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Khu giáo viên. Hành chính / quản lý cũng vào được để hỗ trợ lớp: từ trang
 * tổng quan họ bấm thẳng vào một ca dạy bất kỳ trong ngày và dùng đầy đủ
 * chức năng của giáo viên (chuẩn bị bài, điểm danh, vào lớp, chấm công).
 * Quyền ghi dữ liệu ở Supabase đã mở cho staff (is_staff) nên không cần
 * nới thêm gì ở phía cơ sở dữ liệu.
 */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role={["teacher", "admin", "staff"]}>{children}</AuthGuard>;
}
