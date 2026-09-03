"use client";

import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/shell/notification-bell";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { MobileNav } from "@/components/shell/mobile-nav";
import { titleForPath } from "@/components/shell/nav-config";
import { usePathname } from "next/navigation";
import type { User } from "@/lib/types";

/**
 * Thanh trên cùng: nút thu/mở menu + tên trang đang xem (bên trái), chi nhánh
 * đang làm việc + chuông + avatar (bên phải).
 *
 * Tên trang lấy thẳng từ nhãn trong menu nên hai chỗ không bao giờ lệch nhau,
 * và trang nội dung không phải tự in lại tiêu đề nữa.
 */
export function TopBar({
  user,
  onToggleSidebar,
  sidebarCollapsed,
}: {
  user: User;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const title = titleForPath(user.role, pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur print:hidden md:h-16 md:gap-3 md:px-6">
      <MobileNav user={user} />

      <button
        type="button"
        onClick={onToggleSidebar}
        title={sidebarCollapsed ? "Mở menu" : "Thu menu"}
        aria-label={sidebarCollapsed ? "Mở menu" : "Thu menu"}
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:grid"
      >
        <PanelLeft className="h-[18px] w-[18px]" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold tracking-tight md:text-lg">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <BranchSwitcher className="hidden w-52 md:block" />

        <NotificationBell profileId={user.id} />

        {/* Avatar = cửa vào hồ sơ cá nhân (đổi mật khẩu, đăng xuất nằm trong đó) */}
        <Link
          href="/account"
          title="Hồ sơ cá nhân"
          className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary"
        >
          <Avatar name={user.name} src={user.avatar} size={32} />
          <span className="hidden max-w-[10rem] truncate text-sm font-semibold md:block">
            {user.name}
          </span>
        </Link>
      </div>
    </header>
  );
}
