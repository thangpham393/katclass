"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, BookOpen, Sparkles, AlertCircle, Loader2 } from "lucide-react";
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

  // Đã đăng nhập sẵn → chuyển thẳng vào khu vực của mình.
  useEffect(() => {
    if (!loading && user) router.replace(homeForRole(user.role));
  }, [user, loading, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting("email");
    try {
      const profile = await signInWithEmail(email.trim(), password);
      router.replace(homeForRole(profile.role));
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Visual side */}
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-gold-700 p-12 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white blur-3xl" />
          <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-gold-300 blur-3xl" />
        </div>
        <div className="relative max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 mb-10">
            <div className="h-11 w-11 overflow-hidden rounded-xl bg-white p-1">
              <LogoMark />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-extrabold">
                KAT <span className="text-gold-300">CLASS</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/70">
                KAT Education
              </div>
            </div>
          </Link>
          <div className="zh mb-4 text-6xl font-bold leading-tight">
            欢迎回来
          </div>
          <h1 className="text-3xl font-bold">Chào mừng trở lại!</h1>
          <p className="mt-3 text-white/85">
            Tiếp tục hành trình chinh phục tiếng Trung của bạn cùng KAT Education.
          </p>

          <div className="mt-10 space-y-3">
            {[
              { icon: Sparkles, text: "Flashcard, quiz, luyện viết chữ Hán" },
              { icon: BookOpen, text: "120+ bài giảng, 3,000+ từ vựng" },
              { icon: GraduationCap, text: "Theo lộ trình HSK1 → HSK6" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <b.icon className="h-4 w-4" />
                </div>
                <span className="text-sm">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden inline-block mb-8">
            <Logo />
          </Link>

          <h2 className="text-2xl font-bold tracking-tight">Đăng nhập</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dùng tài khoản được KAT Education cấp, hoặc đăng nhập bằng Google.
          </p>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="mt-6 space-y-3" onSubmit={handleEmailLogin}>
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
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={submitting !== null}
            >
              {submitting === "email" && <Loader2 className="h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">hoặc</span>
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

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <a href="#" className="font-semibold text-brand-700 hover:underline">Liên hệ KAT Education</a>
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
