import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Kho học liệu trung tâm — khu dùng chung cho giáo viên và ban quản lý
 * (giáo trình, bài tập, bài học, từ vựng, câu hỏi). Một bộ trang duy nhất
 * thay cho hai bản riêng ở /admin và /teacher trước đây.
 */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role={["teacher", "admin", "staff", "accountant"]}>{children}</AuthGuard>;
}
