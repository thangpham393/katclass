"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, LogoMark } from "@/components/brand/logo";
import { useAuth } from "@/components/auth/auth-provider";
import { signInWithEmail, homeForRole, authErrorMessage } from "@/lib/auth";
import { DEFAULT_LOGIN_PASSWORD, normalizeLoginCode } from "@/lib/student-login";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Đích đến sau đăng nhập: ?next=/... hoặc trang chủ theo role
  function destination(role: Parameters<typeof homeForRole>[0]): string {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") ? next : homeForRole(role);
  }

  // Đã đăng nhập sẵn → chuyển thẳng vào khu vực của mình.
  useEffect(() => {
    if (!loading && user) router.replace(destination(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Ô mã cũng chấp nhận email (đường dự phòng cho quản trị)
      let email = code.trim();
      if (!email.includes("@")) {
        const res = await fetch("/api/student-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: normalizeLoginCode(code) }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Có lỗi xảy ra, thử lại sau.");
          setSubmitting(false);
          return;
        }
        email = body.email;
      }

      try {
        const profile = await signInWithEmail(email, password);
        if (password === DEFAULT_LOGIN_PASSWORD) {
          // Đang dùng mật khẩu mặc định → đưa tới trang đổi mật khẩu
          router.replace("/account/password?first=1");
        } else {
          router.replace(destination(profile.role));
        }
      } catch (err) {
        const msg = authErrorMessage(err);
        setError(
          msg === "Email hoặc mật khẩu không đúng."
            ? `Mật khẩu không đúng. Nếu chưa từng đổi, dùng mật khẩu mặc định ${DEFAULT_LOGIN_PASSWORD}.`
            : msg,
        );
        setSubmitting(false);
      }
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
      setSubmitting(false);
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
            Dùng mã thành viên do KAT Education cấp.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-sm font-medium" htmlFor="login-code">Mã thành viên</label>
              <Input
                id="login-code"
                placeholder="HVKAT00123"
                className="mt-1.5 font-mono tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="username"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Học viên: HVKAT... · Phụ huynh: PHKAT... · Giáo viên: GVKAT... · Nhân viên: NVKAT...
              </p>
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
              <p className="mt-1 text-xs text-muted-foreground">
                Lần đầu đăng nhập dùng mật khẩu mặc định được trung tâm gửi kèm mã —
                hệ thống sẽ nhắc đổi ngay sau đó.
              </p>
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Đăng nhập
            </Button>
          </form>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            Quên mã hoặc mật khẩu? Liên hệ trung tâm KAT Education.
          </p>
        </div>
      </div>
    </div>
  );
}
