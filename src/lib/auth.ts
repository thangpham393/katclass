"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { User } from "./types";

/**
 * Lấy hồ sơ người dùng từ bảng public.profiles.
 * Bình thường trigger `on_auth_user_created` đã tạo sẵn hồ sơ khi đăng ký;
 * nếu vì lý do nào đó chưa có thì tạo mới với role mặc định "student".
 */
export async function ensureUserProfile(sbUser: SupabaseUser): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, avatar")
    .eq("id", sbUser.id)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    return {
      id: data.id,
      name: data.name || fallbackName(sbUser),
      email: data.email || sbUser.email || "",
      role: data.role ?? "student",
      avatar: data.avatar ?? undefined,
      classIds: [],
    };
  }

  const profile = {
    id: sbUser.id,
    name: fallbackName(sbUser),
    email: sbUser.email ?? "",
    role: "student" as const,
    avatar: (sbUser.user_metadata?.avatar_url as string | undefined) ?? null,
  };
  const { error: insertError } = await supabase.from("profiles").insert(profile);
  if (insertError) throw insertError;
  return { ...profile, avatar: profile.avatar ?? undefined, classIds: [] };
}

function fallbackName(sbUser: SupabaseUser): string {
  return (
    (sbUser.user_metadata?.full_name as string | undefined) ??
    (sbUser.user_metadata?.name as string | undefined) ??
    sbUser.email?.split("@")[0] ??
    "Người dùng"
  );
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return ensureUserProfile(data.user);
}

/**
 * Đăng nhập Google theo luồng redirect của Supabase:
 * trình duyệt chuyển sang Google → quay về /login kèm mã phiên,
 * AuthProvider bắt được session và trang login tự điều hướng theo role.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Trang chủ tương ứng với từng vai trò. */
export function homeForRole(role: User["role"]): string {
  return role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
}

/** Diễn giải lỗi Supabase Auth sang tiếng Việt dễ hiểu. */
export function authErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number };
  const code = e?.code ?? "";
  const message = e?.message ?? "";

  switch (code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Email chưa được xác nhận. Kiểm tra hộp thư của bạn.";
    case "user_banned":
      return "Tài khoản đã bị khóa. Liên hệ trung tâm để được hỗ trợ.";
    case "over_request_rate_limit":
      return "Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
    case "validation_failed":
      return "Email không hợp lệ.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Lỗi mạng. Kiểm tra kết nối rồi thử lại.";
  }
  return "Đăng nhập thất bại. Vui lòng thử lại.";
}
