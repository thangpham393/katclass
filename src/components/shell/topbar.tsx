"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/shell/notification-bell";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { MobileNav } from "@/components/shell/mobile-nav";
import { signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import type { User } from "@/lib/types";

export function TopBar({ user }: { user: User }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur print:hidden md:h-16 md:gap-4 md:px-8">
      <MobileNav user={user} />

      <div className="min-w-0 flex-1">
        {/* Desktop: câu chào + vai trò. Mobile: nhường chỗ cho chi nhánh
            (tên & vai trò đã có trong ngăn kéo menu). */}
        <div className="hidden truncate text-sm text-muted-foreground md:block">
          Xin chào, <span className="font-semibold text-foreground">{user.name}</span>
          <span className="mx-2 text-border">·</span>
          <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <BranchSwitcher className="max-w-[13.5rem] md:hidden" />
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <BranchSwitcher className="hidden w-56 md:block" />

        <NotificationBell profileId={user.id} />

        {/* Avatar = cửa vào hồ sơ cá nhân (đổi mật khẩu, đăng xuất nằm trong đó) */}
        <Link href="/account" title="Hồ sơ cá nhân" className="shrink-0">
          <Avatar name={user.name} src={user.avatar} size={34} />
        </Link>

        <button
          onClick={handleSignOut}
          title="Đăng xuất"
          className="hidden h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-gold-50 hover:text-gold-700 lg:grid"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
