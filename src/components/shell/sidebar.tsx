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
  BarChart3,
  Settings,
  School,
  ClipboardList,
  Library,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/brand/logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const studentNav: NavItem[] = [
  { href: "/student", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/student/classes", label: "Lớp của tôi", icon: School },
  { href: "/student/homework", label: "Bài tập về nhà", icon: ClipboardList },
  { href: "/student/flashcard", label: "Flashcard", icon: Sparkles },
  { href: "/student/library", label: "Thư viện", icon: Library },
];

const teacherNav: NavItem[] = [
  { href: "/teacher", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/teacher/classes", label: "Lớp dạy", icon: School },
  { href: "/teacher/lessons", label: "Bài giảng", icon: BookOpen },
  { href: "/teacher/homework", label: "Giao bài tập", icon: ListChecks },
  { href: "/teacher/vocab", label: "Kho từ vựng", icon: Library },
  { href: "/teacher/students", label: "Học viên", icon: Users },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Khóa học", icon: BookMarked },
  { href: "/admin/classes", label: "Lớp & lịch", icon: School },
  { href: "/admin/students", label: "Học viên", icon: Users },
  { href: "/admin/teachers", label: "Giáo viên", icon: GraduationCap },
  { href: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

const parentNav: NavItem[] = [
  { href: "/parent", label: "Trang chủ", icon: LayoutDashboard },
];

const navByRole: Record<Role, NavItem[]> = {
  student: studentNav,
  teacher: teacherNav,
  admin: adminNav,
  staff: adminNav,
  parent: parentNav,
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const nav = navByRole[role];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-950 text-ink-200 lg:flex">
      <div className="px-5 py-5">
        <Link href="/">
          <Logo inverted />
        </Link>
      </div>

      <div className="px-5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        Menu chính
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.split("/").length > 2 && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-ink-800 text-white"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-100",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-400" />
              )}
              <Icon className={cn("h-4 w-4", active ? "text-brand-400" : "text-ink-500 group-hover:text-ink-300")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-4 rounded-xl bg-gradient-brand p-4 text-white shadow-soft">
        <div className="zh text-2xl font-semibold">学而时习之</div>
        <div className="mt-1 text-xs leading-relaxed text-white/80">
          &ldquo;Học phải đi đôi với luyện tập&rdquo; — mỗi ngày 5 từ mới, tiến bộ không ngừng.
        </div>
      </div>
    </aside>
  );
}
