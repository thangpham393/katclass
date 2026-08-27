"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { useAuth } from "./auth-provider";
import { permissionForPath } from "@/lib/permissions";
import { homeForRole } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { BranchProvider } from "@/components/shell/branch-provider";
import type { Role } from "@/lib/types";

/**
 * Chặn truy cập khu vực theo vai trò:
 * - Chưa đăng nhập → về /login
 * - Sai vai trò → về trang chủ của vai trò mình
 * Nhận 1 role hoặc danh sách role được phép (vd admin + staff dùng chung khu quản trị).
 *
 * `bare`: bỏ sidebar/topbar — dùng cho màn hình toàn khung như chế độ lớp
 * học trực tiếp (chiếu lên máy chiếu, không còn chỗ cho khung điều hướng).
 *
 * Vào được khu vực rồi thì còn một cửa nữa: quyền theo đường dẫn
 * (`permissionForPath`). Đây chỉ là lớp lịch sự để báo sớm cho người dùng —
 * chặn thật là RLS, nên trang có lọt qua đây cũng không đọc được dữ liệu.
 */
export function AuthGuard({
  role,
  bare,
  children,
}: {
  role: Role | Role[];
  bare?: boolean;
  children: React.ReactNode;
}) {
  const roles = Array.isArray(role) ? role : [role];
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!user && roles.includes(user.role);
  const needed = permissionForPath(pathname ?? "");
  const missingPerm = allowed && needed !== null && !can(needed);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!allowed) {
      router.replace(homeForRole(user.role));
    }
  }, [user, loading, allowed, router]);

  if (loading || !user || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  const body = missingPerm ? <NoPermission /> : children;

  if (bare) return <BranchProvider user={user}>{body}</BranchProvider>;

  return (
    <BranchProvider user={user}>
      <AppShell user={user}>{body}</AppShell>
    </BranchProvider>
  );
}

function NoPermission() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-50 text-gold-700">
        <ShieldOff className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-extrabold tracking-tight">
        Vai trò của bạn không có quyền vào mục này
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nếu cần dùng, nhờ quản lý trung tâm bật quyền tương ứng ở{" "}
        <span className="font-semibold text-foreground">Cài đặt › Phân quyền</span>.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
