"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/auth";
import type { User } from "@/lib/types";

interface AuthState {
  /** Hồ sơ người dùng (kèm role) từ Firestore; null nếu chưa đăng nhập. */
  user: User | null;
  /** true khi đang chờ Firebase khôi phục phiên đăng nhập. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setState({ user: null, loading: false });
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setState({ user: profile, loading: false });
      } catch (err) {
        console.error("Không tải được hồ sơ người dùng:", err);
        setState({ user: null, loading: false });
      }
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
