import Link from "next/link";
import { GraduationCap, BookOpen, Users, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo, LogoMark } from "@/components/brand/logo";

export default function LoginPage() {
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
            Tiếp tục hành trình chinh phục tiếng Trung của bạn — học viên KAT đã hoàn thành
            <span className="font-bold"> 2,341 </span>bài tập trong tuần này.
          </p>

          <div className="mt-10 space-y-3">
            {[
              { icon: Sparkles, text: "Streak trung bình toàn trung tâm: 12 ngày" },
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
            Chọn vai trò bên dưới để xem demo.
          </p>

          <form className="mt-6 space-y-3">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="ban@kat-education.vn" className="mt-1.5" defaultValue="an.nguyen@kat-education.vn" />
            </div>
            <div>
              <label className="text-sm font-medium">Mật khẩu</label>
              <Input type="password" placeholder="••••••••" className="mt-1.5" defaultValue="demo1234" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="accent-brand-500" defaultChecked /> Ghi nhớ
              </label>
              <a href="#" className="text-brand-600 font-medium hover:underline">Quên mật khẩu?</a>
            </div>
            <Button className="w-full" size="lg" type="button">
              Đăng nhập
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Demo theo vai trò</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <RoleQuick href="/student" label="Học viên" icon={GraduationCap} />
            <RoleQuick href="/teacher" label="Giáo viên" icon={BookOpen} />
            <RoleQuick href="/admin" label="Quản lý" icon={Users} />
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <a href="#" className="font-semibold text-brand-700 hover:underline">Liên hệ KAT Education</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleQuick({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <Card className="card-hover">
        <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-xs font-semibold">{label}</div>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
