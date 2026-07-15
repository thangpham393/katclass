"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/auth";
import type { User } from "@/lib/types";

interface AuthState {
  /** Hồ sơ người dùng (kèm role) từ bảng profiles; null nếu chưa đăng nhập. */
  user: User | null;
  /** true khi đang chờ Supabase khôi phục phiên đăng nhập. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      // Không await trực tiếp trong callback này (supabase-js giữ lock nội bộ,
      // gọi tiếp API trong callback có thể deadlock) → đẩy ra ngoài bằng setTimeout.
      setTimeout(async () => {
        if (!session?.user) {
          setState({ user: null, loading: false });
          return;
        }
        try {
          const profile = await ensureUserProfile(session.user);
          setState({ user: profile, loading: false });
        } catch (err) {
          console.error("Không tải được hồ sơ người dùng:", err);
          setState({ user: null, loading: false });
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
