"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/shell/notification-bell";
import { signOut } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

const roleLabel: Record<Role, string> = {
  student: "Học viên",
  parent: "Phụ huynh",
  teacher: "Giáo viên",
  staff: "Hành chính",
  admin: "Quản lý",
};

export function TopBar({ user }: { user: User }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur print:hidden md:px-8">
      <div className="min-w-0">
        <div className="truncate text-sm text-muted-foreground">
          Xin chào, <span className="font-semibold text-foreground">{user.name}</span>
          <span className="mx-2 text-border">·</span>
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
            {roleLabel[user.role]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell profileId={user.id} />

        <Link
          href="/account/password"
          title="Đổi mật khẩu"
          className="grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <KeyRound className="h-4 w-4" />
        </Link>

        <Avatar name={user.name} src={user.avatar} size={36} />

        <button
          onClick={handleSignOut}
          title="Đăng xuất"
          className="grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-gold-50 hover:text-gold-700"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
