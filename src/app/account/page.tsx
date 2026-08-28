"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, KeyRound, LogOut, Mail, MapPin, ShieldCheck } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/components/auth/auth-provider";
import { useBranch } from "@/components/shell/branch-provider";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";

const ALL_ROLES: Role[] = ["admin", "staff", "accountant", "teacher", "student", "parent"];

/**
 * HỒ SƠ CÁ NHÂN — nơi gom mọi thứ thuộc về "tài khoản của tôi".
 *
 * Trước đây đổi mật khẩu và đăng xuất là hai nút to nằm ở đáy ngăn kéo menu,
 * chiếm chỗ của chính danh sách chức năng. Giờ bấm vào avatar / tên mình là
 * vào đây.
 */
export default function AccountPage() {
  return (
    <AuthGuard role={ALL_ROLES}>
      <AccountBody />
    </AuthGuard>
  );
}

function AccountBody() {
  const { user } = useAuth();
  const { branch } = useBranch();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getSupabase()
      .from("profiles")
      .select("student_code, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCode(data?.student_code ?? null);
        setPhone(data?.phone ?? null);
      });
  }, [user]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Hồ sơ cá nhân</h1>

      <Card>
        <CardContent className="flex items-center gap-4 p-4 sm:p-6">
          <Avatar name={user.name} src={user.avatar} size={60} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{user.name}</div>
            <span className="mt-1 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          <InfoRow icon={Mail} label="Email" value={user.email || "—"} />
          {code && <InfoRow icon={ShieldCheck} label="Mã đăng nhập" value={code} mono />}
          {phone && <InfoRow icon={Mail} label="Điện thoại" value={phone} />}
          <InfoRow icon={MapPin} label="Chi nhánh" value={branch?.name ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          <Link
            href="/account/password"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-6"
          >
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Đổi mật khẩu</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gold-50 sm:px-6"
          >
            <LogOut className="h-4 w-4 shrink-0 text-gold-600" />
            <span className="flex-1 text-sm font-semibold text-gold-700">Đăng xuất</span>
          </button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Cần sửa họ tên, email hay số điện thoại? Nhắn văn phòng trung tâm cập nhật giúp bạn.
      </p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`ml-auto min-w-0 truncate text-sm font-semibold ${mono ? "font-mono text-brand-700" : ""}`}>
        {value}
      </span>
    </div>
  );
}
