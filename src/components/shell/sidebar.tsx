"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  Users,
  ScrollText,
  BarChart3,
  Settings,
  School,
  ClipboardList,
  Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/brand/logo";

const navByRole: Record<Role, { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  student: [
    { href: "/student", label: "Trang chủ", icon: LayoutDashboard },
    { href: "/student/classes", label: "Lớp của tôi", icon: School },
    { href: "/student/homework", label: "Bài tập về nhà", icon: ClipboardList },
    { href: "/student/flashcard", label: "Flashcard", icon: Sparkles },
    { href: "/student/library", label: "Thư viện", icon: Library },
  ],
  teacher: [
    { href: "/teacher", label: "Trang chủ", icon: LayoutDashboard },
    { href: "/teacher/classes", label: "Lớp dạy", icon: School },
    { href: "/teacher/lessons", label: "Bài giảng", icon: BookOpen },
    { href: "/teacher/homework", label: "Giao bài tập", icon: ListChecks },
    { href: "/teacher/vocab", label: "Kho từ vựng", icon: Library },
    { href: "/teacher/students", label: "Học viên", icon: Users },
  ],
  admin: [
    { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/admin/classes", label: "Lớp & lịch", icon: School },
    { href: "/admin/teachers", label: "Giáo viên", icon: GraduationCap },
    { href: "/admin/students", label: "Học viên", icon: Users },
    { href: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
    { href: "/admin/settings", label: "Cài đặt", icon: Settings },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const nav = navByRole[role];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border/70 bg-white/60 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-brand-500/10 to-gold-400/10 text-brand-700 shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  active ? "text-brand-600" : "text-muted-foreground",
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl bg-gradient-to-br from-brand-700 to-gold-600 p-4 text-white shadow-soft">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          Mẹo hôm nay
        </div>
        <div className="mt-1 text-sm">
          Học <span className="zh font-bold">5</span> từ mới mỗi ngày — duy trì
          streak <span className="font-bold">🔥 7</span> ngày!
        </div>
      </div>
    </aside>
  );
}
