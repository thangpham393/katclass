"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/auth/auth-provider";
import { homeForRole } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  // ?first=1 → vừa đăng nhập bằng mật khẩu mặc định
  const [isFirst] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("first"),
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }
    if (password === DEFAULT_LOGIN_PASSWORD) {
      setError("Không dùng lại mật khẩu mặc định — hãy đặt mật khẩu riêng của bạn.");
      return;
    }
    if (password !== confirm) {
      setError("Hai ô mật khẩu chưa khớp nhau.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => {
        window.location.href = user ? homeForRole(user.role) : "/login";
      }, 1500);
    } catch (err) {
      const e = err as { message?: string };
      setError(
        e?.message?.includes("different from the old")
          ? "Mật khẩu mới phải khác mật khẩu hiện tại."
          : "Không đổi được mật khẩu, thử lại sau.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/"><Logo /></Link>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-1 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">Đổi mật khẩu</h1>
            </div>

            {loading ? (
              <div className="grid place-items-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !user ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">Bạn cần đăng nhập trước.</p>
                <Link href="/login?next=/account/password" className="block">
                  <Button className="w-full">Đăng nhập</Button>
                </Link>
              </div>
            ) : done ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <div className="mt-2 font-bold text-emerald-800">Đã đổi mật khẩu!</div>
                <div className="mt-1 text-sm text-emerald-700">
                  Lần sau đăng nhập bằng mật khẩu mới. Đang chuyển vào trang chủ...
                </div>
              </div>
            ) : (
              <>
                {isFirst && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Bạn đang dùng <b>mật khẩu mặc định</b> — hãy đặt mật khẩu riêng để bảo vệ tài khoản.
                    </span>
                  </div>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  Tài khoản: <b className="text-foreground">{user.name}</b>
                </p>
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium" htmlFor="new-password">Mật khẩu mới</label>
                    <Input
                      id="new-password"
                      type="password"
                      className="mt-1.5"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Ít nhất 8 ký tự"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium" htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
                    <Input
                      id="confirm-password"
                      type="password"
                      className="mt-1.5"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Đổi mật khẩu
                  </Button>
                  <Link
                    href={homeForRole(user.role)}
                    className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Để sau, vào trang chủ
                  </Link>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
