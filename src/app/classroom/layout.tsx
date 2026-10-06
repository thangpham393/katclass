import { AuthGuard } from "@/components/auth/auth-guard";
import { ClassroomThemeProvider } from "@/components/classroom/theme-provider";
import "./classroom.css";

/**
 * Chế độ lớp học trực tiếp: toàn khung, KHÔNG sidebar/topbar (màn hình này
 * được chiếu lên máy chiếu/TV). Hành chính cũng vào được để hỗ trợ lớp.
 */
export default function ClassroomLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role={["teacher", "admin", "staff", "accountant"]} bare>
      <ClassroomThemeProvider>{children}</ClassroomThemeProvider>
    </AuthGuard>
  );
}
