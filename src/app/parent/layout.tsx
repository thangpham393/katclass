"use client";

import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * /parent/... là khu của phụ huynh đã có tài khoản, trừ /parent/s/<token>:
 * đó là trang xem bằng đường dẫn bí mật (migration 0041), phụ huynh mở
 * từ Zalo/QR nên KHÔNG được bắt đăng nhập — trang tự xác minh bằng 4 số
 * cuối điện thoại qua /api/parent-portal.
 */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/parent/s/")) return <>{children}</>;
  return <AuthGuard role="parent">{children}</AuthGuard>;
}
