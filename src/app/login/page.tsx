"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, LogoMark } from "@/components/brand/logo";
import { useAuth } from "@/components/auth/auth-provider";
import {
  signInWithEmail,
  signInWithGoogle,
  homeForRole,
  authErrorMessage,
} from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"email" | "google" | null>(null);

  // Đích đến sau đăng nhập: ?next=/... (vd trang kích hoạt mã) hoặc trang chủ theo role
  function destination(role: Parameters<typeof homeForRole>[0]): string {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : homeForRole(role);
  }

  // Đã đăng nhập sẵn → chuyển thẳng vào khu vực của mình.
  useEffect(() => {
    if (!loading && user) router.replace(destination(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting("email");
    try {
      const profile = await signInWithEmail(email.trim(), password);
      router.replace(destination(profile.role));
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(null);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setSubmitting("google");
    try {
      // Supabase dùng luồng redirect: rời trang sang Google, quay về /login
      // với session sẵn sàng → useEffect phía trên tự điều hướng theo role.
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel mực — thư pháp + triện đỏ */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <div className="zh select-none whitespace-nowrap text-[26rem] font-black leading-none text-white">
            汉语
          </div>
        </div>

        <Link href="/" className="relative">
          <Logo inverted />
        </Link>

        <div className="relative max-w-md">
          <div className="zh text-7xl font-semibold leading-tight text-brand-400">
            千里之行
            <br />
            始于足下
          </div>
          <p className="mt-6 text-lg font-medium text-white/90">
            &ldquo;Hành trình vạn dặm bắt đầu từ một bước chân.&rdquo;
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Đăng nhập để tiếp tục hành trình chinh phục tiếng Trung cùng KAT Education —
            lớp học, flashcard, bài tập và lộ trình HSK của riêng bạn.
          </p>
        </div>

        <div className="relative flex items-center gap-3 text-xs text-white/50">
          <div className="h-8 w-8 overflow-hidden rounded-md">
            <LogoMark />
          </div>
          KAT Education · Tiếng Trung · Du học · Kỹ năng
        </div>
      </div>

      {/* Form trên nền giấy */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>

          <h1 className="text-2xl font-extrabold tracking-tight">Đăng nhập</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Dùng tài khoản được KAT Education cấp, hoặc đăng nhập bằng Google.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleEmailLogin}>
            <div>
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="ban@kat-education.vn"
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password">Mật khẩu</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={submitting !== null}>
              {submitting === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-background px-3 text-muted-foreground">hoặc</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting !== null}
          >
            {submitting === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Đăng nhập bằng Google
          </Button>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            Giáo viên / nhân viên có mã kích hoạt?{" "}
            <Link href="/activate" className="font-semibold text-brand-700 hover:underline">
              Kích hoạt tài khoản
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <a href="#" className="font-semibold text-brand-700 hover:underline">
              Liên hệ KAT Education
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.1-6.71-4.94H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.29a12 12 0 0 0 0 10.78l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
