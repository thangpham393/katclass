"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronDown,
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
  Languages,
  Wallet,
  CalendarCheck,
  CalendarOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/brand/logo";

type Icon = React.ComponentType<{ className?: string }>;

type NavLink = {
  href: string;
  label: string;
  icon: Icon;
};

type NavGroup = {
  label: string;
  icon: Icon;
  children: NavLink[];
};

type NavEntry = NavLink | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

/**
 * Kho học liệu trung tâm — một bộ menu duy nhất dùng chung cho giáo viên và
 * ban quản lý (các trang nằm ở /library, quyền nhập/xóa vẫn khóa theo vai trò).
 */
const libraryGroup: NavGroup = {
  label: "Kho học liệu trung tâm",
  icon: Library,
  children: [
    { href: "/library/textbooks", label: "Thư viện giáo trình", icon: BookMarked },
    { href: "/library/exercises", label: "Thư viện bài tập", icon: ClipboardList },
    { href: "/library/lessons", label: "Bài học", icon: BookOpen },
    { href: "/library/vocab", label: "Kho từ vựng", icon: Languages },
    { href: "/library/questions", label: "Ngân hàng câu hỏi", icon: ListChecks },
  ],
};

const studentNav: NavEntry[] = [
  { href: "/student", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/student/classes", label: "Lớp của tôi", icon: School },
  { href: "/student/homework", label: "Bài tập về nhà", icon: ClipboardList },
  { href: "/student/flashcard", label: "Flashcard", icon: Sparkles },
  { href: "/student/library", label: "Thư viện", icon: Library },
];

const teacherNav: NavEntry[] = [
  { href: "/teacher", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/teacher/classes", label: "Lớp dạy", icon: School },
  libraryGroup,
  { href: "/teacher/homework", label: "Giao bài tập", icon: ClipboardList },
  { href: "/teacher/requests", label: "Nghỉ / đổi buổi", icon: CalendarOff },
  { href: "/teacher/students", label: "Học viên", icon: Users },
];

const adminNav: NavEntry[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Khóa học", icon: BookMarked },
  libraryGroup,
  { href: "/admin/classes", label: "Lớp & lịch", icon: School },
  { href: "/admin/timetable", label: "Thời khóa biểu", icon: CalendarDays },
  { href: "/admin/students", label: "Học viên", icon: Users },
  { href: "/admin/teachers", label: "Đội ngũ", icon: GraduationCap },
  { href: "/admin/makeup", label: "Học bù", icon: CalendarClock },
  { href: "/admin/requests", label: "Nghỉ / đổi buổi GV", icon: CalendarOff },
  { href: "/admin/tuition", label: "Học phí", icon: Wallet },
  { href: "/admin/payroll", label: "Chấm công GV", icon: CalendarCheck },
  { href: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

const parentNav: NavEntry[] = [
  { href: "/parent", label: "Trang chủ", icon: LayoutDashboard },
];

const navByRole: Record<Role, NavEntry[]> = {
  student: studentNav,
  teacher: teacherNav,
  admin: adminNav,
  staff: adminNav,
  parent: parentNav,
};

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href.split("/").length > 2 && pathname.startsWith(href + "/"))
  );
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const nav = navByRole[role];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-950 text-ink-200 print:!hidden lg:flex">
      <div className="px-5 py-5">
        <Link href="/">
          <Logo inverted />
        </Link>
      </div>

      <div className="px-5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        Menu chính
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((entry) =>
          isGroup(entry) ? (
            <NavGroupItem key={entry.label} group={entry} pathname={pathname} />
          ) : (
            <NavLinkItem key={entry.href} item={entry} active={isActive(pathname, entry.href)} />
          ),
        )}
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

function NavLinkItem({
  item,
  active,
  nested,
}: {
  item: NavLink;
  active: boolean;
  nested?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        nested && "py-2 pl-9 text-[13px]",
        active
          ? "bg-ink-800 text-white"
          : "text-ink-400 hover:bg-ink-900 hover:text-ink-100",
      )}
    >
      {active && (
        <span
          className={cn(
            "absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand-400",
            nested ? "left-3" : "left-0",
          )}
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          nested && "h-3.5 w-3.5",
          active ? "text-brand-400" : "text-ink-500 group-hover:text-ink-300",
        )}
      />
      {item.label}
    </Link>
  );
}

/** Menu cha: bấm để mở / thu, tự mở sẵn khi đang ở một trang con. */
function NavGroupItem({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActiveChild = group.children.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(hasActiveChild);
  const expanded = open || hasActiveChild;
  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          hasActiveChild
            ? "text-white"
            : "text-ink-400 hover:bg-ink-900 hover:text-ink-100",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            hasActiveChild ? "text-brand-400" : "text-ink-500 group-hover:text-ink-300",
          )}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="relative mt-0.5 space-y-0.5">
          <span className="absolute bottom-1 left-[21px] top-1 w-px bg-ink-800" />
          {group.children.map((c) => (
            <NavLinkItem key={c.href} item={c} active={isActive(pathname, c.href)} nested />
          ))}
        </div>
      )}
    </div>
  );
}
