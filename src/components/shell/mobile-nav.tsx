"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut, Menu, X } from "lucide-react";
import { SidebarNav } from "./sidebar";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { signOut } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  student: "Học viên",
  parent: "Phụ huynh",
  teacher: "Giáo viên",
  staff: "Hành chính",
  accountant: "Kế toán",
  admin: "Quản lý",
};

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
  const router = useRouter();

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
        className="absolute inset-0 h-full w-full bg-ink-950/60"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[84vw] max-w-[19rem] flex-col bg-ink-950 text-ink-200 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3.5">
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo inverted />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarNav role={user.role} onNavigate={() => setOpen(false)} />

        {/* Tài khoản — trên desktop nằm ở topbar, mobile gom vào chân ngăn kéo */}
        <div className="shrink-0 space-y-2 border-t border-ink-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={user.name} src={user.avatar} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="text-[11px] text-ink-400">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/account/password"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-[13px] font-semibold text-ink-200 hover:bg-ink-800"
            >
              <KeyRound className="h-4 w-4" /> Đổi mật khẩu
            </Link>
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.replace("/login");
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-[13px] font-semibold text-gold-300 hover:bg-ink-800"
            >
              <LogOut className="h-4 w-4" /> Thoát
            </button>
          </div>
        </div>
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
