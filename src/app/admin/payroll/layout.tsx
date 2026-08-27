import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Chấm công & tiền công giáo viên — dữ liệu lương nhạy cảm.
 * Ai vào được là do quyền `payroll.view` trong bảng phân quyền (0027) quyết
 * định, RLS chặn tận cơ sở dữ liệu; danh sách vai trò ở đây chỉ giới hạn khu
 * vực, không tự quyết định quyền nữa.
 */
export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  // `bare`: khung sidebar/topbar đã do layout /admin dựng, đây chỉ chặn vai trò
  return (
    <AuthGuard role={["admin", "accountant", "staff"]} bare>
      {children}
    </AuthGuard>
  );
}
