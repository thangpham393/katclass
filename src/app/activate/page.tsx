"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, KeyRound, Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/components/auth/auth-provider";
import { homeForRole } from "@/lib/auth";
import { claimInvite, dbErrorMessage } from "@/lib/db";
import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  student: "Học viên",
  parent: "Phụ huynh",
  teacher: "Giáo viên",
  staff: "Nhân viên hành chính",
  admin: "Quản trị",
};

export default function ActivatePage() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<{ name: string; role: Role } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const profile = await claimInvite(code);
      setClaimed({ name: profile.name, role: profile.role });
      // Nạp lại toàn trang để AuthProvider đọc hồ sơ + vai trò mới
      setTimeout(() => {
        window.location.href = homeForRole(profile.role);
      }, 1600);
    } catch (err) {
      setError(dbErrorMessage(err));
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
                <KeyRound className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">Kích hoạt tài khoản</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Dành cho giáo viên / nhân viên được KAT Education cấp mã.
            </p>

            {loading ? (
              <div className="grid place-items-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : claimed ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <PartyPopper className="mx-auto h-8 w-8 text-emerald-600" />
                <div className="mt-2 font-bold text-emerald-800">
                  Kích hoạt thành công — xin chào {claimed.name}!
                </div>
                <div className="mt-1 text-sm text-emerald-700">
                  Vai trò: {ROLE_LABELS[claimed.role]}. Đang chuyển vào khu làm việc...
                </div>
              </div>
            ) : !user ? (
              <div className="mt-6 space-y-4">
                <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <b className="text-foreground">Bước 1:</b> đăng nhập bằng Google (hoặc tài khoản email) trước.
                  Sau khi đăng nhập bạn sẽ quay lại trang này để nhập mã.
                </p>
                <Link href="/login?next=/activate" className="block">
                  <Button className="w-full" size="lg">Đăng nhập để tiếp tục</Button>
                </Link>
              </div>
            ) : user.role !== "student" ? (
              <div className="mt-6 space-y-4">
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Tài khoản <b>{user.email}</b> đã kích hoạt với vai trò{" "}
                  <b>{ROLE_LABELS[user.role]}</b> — không cần nhập mã.
                </p>
                <Link href={homeForRole(user.role)} className="block">
                  <Button className="w-full">Vào khu làm việc</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Đang đăng nhập với <b className="text-foreground">{user.email}</b> —{" "}
                  tài khoản này sẽ được gắn với hồ sơ trên mã.
                </p>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium" htmlFor="code">Mã kích hoạt</label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: A7K2-M4QX"
                    className="mt-1.5 text-center font-mono text-lg font-bold uppercase tracking-[0.2em]"
                    autoFocus
                    required
                  />
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Kích hoạt
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Chưa có mã? Liên hệ quản lý trung tâm KAT Education để được cấp.
        </p>
      </div>
    </div>
  );
}
