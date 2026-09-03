"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
import { SidebarNav, SignOutButton } from "./sidebar";
import { BranchSwitcher } from "./branch-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { ROLE_LABELS } from "@/lib/roles";
import type { User } from "@/lib/types";

/**
 * Điều hướng cho màn hình nhỏ (< lg): nút hamburger mở ngăn kéo trượt từ trái,
 * dùng lại đúng cây menu của sidebar. Tự đóng khi đổi trang, khóa cuộn nền.
 *
 * Ngăn kéo BẮT BUỘC render qua portal ra <body>: nút hamburger nằm trong topbar
 * có `backdrop-blur`, mà `backdrop-filter` biến thẻ cha thành containing block
 * cho con `position: fixed` — để tại chỗ thì lớp phủ chỉ cao bằng topbar.
 */
export function MobileNav({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Đổi trang (kể cả bằng nút back) thì đóng ngăn kéo
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button
        type="button"
        aria-label="Đóng menu"
        onClick={() => setOpen(false)}
        className="absolute inset-0 h-full w-full bg-ink-950/50"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[84vw] max-w-[19rem] flex-col bg-card text-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3.5">
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo className="h-8" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarNav role={user.role} onNavigate={() => setOpen(false)} />

        {/* Tài khoản — một dòng duy nhất, bấm vào mở trang hồ sơ cá nhân
            (đổi mật khẩu nằm trong đó). Trước đây hai nút to chiếm gần hết
            đáy ngăn kéo trên điện thoại. Chi nhánh để ngay trên vì thanh trên
            cùng ở khổ hẹp chỉ còn chỗ cho tên trang. */}
        <div className="shrink-0 space-y-2 border-t p-3">
          <BranchSwitcher className="w-full" />
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-secondary"
          >
            <Avatar name={user.name} src={user.avatar} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
        <SignOutButton onNavigate={() => setOpen(false)} />
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        aria-expanded={open}
        className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
