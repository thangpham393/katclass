"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/auth";
import { fetchPermissionsForRole, type Permission } from "@/lib/permissions";
import type { User } from "@/lib/types";

interface AuthState {
  /** Hồ sơ người dùng (kèm role) từ bảng profiles; null nếu chưa đăng nhập. */
  user: User | null;
  /** true khi đang chờ Supabase khôi phục phiên đăng nhập. */
  loading: boolean;
  /** Quyền của vai trò hiện tại, đọc từ bảng role_permissions (0027). */
  permissions: Permission[];
}

interface AuthContextValue extends AuthState {
  /**
   * Giao diện có nên hiện chức năng này không. CHỈ để ẩn/hiện cho gọn —
   * chặn thật nằm ở RLS (`has_perm()`), nên không cần sợ người dùng
   * qua mặt lớp này.
   */
  can: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  permissions: [],
  can: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    permissions: [],
  });

  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      // Không await trực tiếp trong callback này (supabase-js giữ lock nội bộ,
      // gọi tiếp API trong callback có thể deadlock) → đẩy ra ngoài bằng setTimeout.
      setTimeout(async () => {
        if (!session?.user) {
          setState({ user: null, loading: false, permissions: [] });
          return;
        }
        try {
          const profile = await ensureUserProfile(session.user);
          // fetchPermissionsForRole đã tự lùi về quyền mặc định khi không
          // đọc được bảng, nên ở đây chỉ cần bắt lỗi ngoài dự kiến.
          const permissions = await fetchPermissionsForRole(profile.role).catch(
            () => [],
          );
          setState({ user: profile, loading: false, permissions });
        } catch (err) {
          console.error("Không tải được hồ sơ người dùng:", err);
          setState({ user: null, loading: false, permissions: [] });
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, can: (perm) => state.permissions.includes(perm) }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
