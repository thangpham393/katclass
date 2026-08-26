import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Chấm công & tiền công giáo viên — dữ liệu lương nhạy cảm: chỉ KẾ TOÁN
 * và ADMIN vào được, quản lý hành chính thì không (RLS `can_view_pay`
 * trong 0025 chặn tận cơ sở dữ liệu, guard này chỉ để khỏi vào nhầm).
 */
export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  // `bare`: khung sidebar/topbar đã do layout /admin dựng, đây chỉ chặn vai trò
  return (
    <AuthGuard role={["admin", "accountant"]} bare>
      {children}
    </AuthGuard>
  );
}
