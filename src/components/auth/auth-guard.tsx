"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { homeForRole } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import type { Role } from "@/lib/types";

/**
 * Chặn truy cập khu vực theo vai trò:
 * - Chưa đăng nhập → về /login
 * - Sai vai trò → về trang chủ của vai trò mình
 * Nhận 1 role hoặc danh sách role được phép (vd admin + staff dùng chung khu quản trị).
 */
export function AuthGuard({
  role,
  children,
}: {
  role: Role | Role[];
  children: React.ReactNode;
}) {
  const roles = Array.isArray(role) ? role : [role];
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);

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

  return <AppShell user={user}>{children}</AppShell>;
}
