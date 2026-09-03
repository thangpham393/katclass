import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Check-in ca dạy — theo dõi giáo viên đã chấm công đủ ca chưa. KHÔNG có
 * đồng tiền nào trong trang này, nên gác bằng `classroom.teach` chứ không
 * phải `payroll.view`: hành chính cần biết ca nào chưa ai chấm để nhắc, mà
 * không phải thấy bảng lương (0038 tách hai việc này ra hai trang).
 */
export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  // `bare`: khung sidebar/topbar đã do layout /admin dựng, đây chỉ chặn vai trò
  return (
    <AuthGuard role={["admin", "accountant", "staff"]} bare>
      {children}
    </AuthGuard>
  );
}
