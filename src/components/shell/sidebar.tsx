"use client";

import { useMemo, useState } from "react";
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
  CalendarCog,
  Receipt,
  CalendarOff,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { permissionForPath } from "@/lib/permissions";
import { useAuth } from "@/components/auth/auth-provider";
import { useNavBadges } from "./use-nav-badges";
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
 * MENU THEO VAI TRÒ, GOM THEO CỤM CHỨC NĂNG.
 *
 * Quản lý có tới 13-15 chức năng — bày phẳng hết ra một cấp thì trên điện
 * thoại phải cuộn mãi mới thấy mục cần. Nên chia thành các cụm thu/mở được
 * (accordion): mỗi cụm là một "việc" của trung tâm (dạy & học, đổi lịch,
 * con người, tiền, cài đặt), mặc định thu gọn và tự bung ra khi đang ở
 * trang con.
 *
 * Giáo viên và học viên thì ngược lại — ít mục nên để phẳng, bấm một lần là
 * tới nơi; chỉ kho học liệu (5 mục con) mới cần gom lại.
 *
 * Tên mục đặt theo góc nhìn người dùng: cùng một tính năng nhưng admin thấy
 * "Duyệt đổi lịch" (việc phải làm) còn giáo viên thấy "Xin đổi lịch" (việc
 * mình gửi đi).
 */

/**
 * Kho học liệu trung tâm — một bộ menu duy nhất dùng chung cho giáo viên và
 * ban quản lý (các trang nằm ở /library, quyền nhập/xóa vẫn khóa theo vai trò).
 */
const libraryGroup: NavGroup = {
  label: "Thư viện học liệu",
  icon: Library,
  children: [
    { href: "/library/textbooks", label: "Giáo trình", icon: BookMarked },
    { href: "/library/exercises", label: "Bộ bài tập", icon: ClipboardList },
    { href: "/library/lessons", label: "Bài học", icon: BookOpen },
    { href: "/library/vocab", label: "Kho từ vựng", icon: Languages },
    { href: "/library/questions", label: "Ngân hàng câu hỏi", icon: ListChecks },
  ],
};

const studentNav: NavEntry[] = [
  { href: "/student", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/student/classes", label: "Lớp của tôi", icon: School },
  { href: "/student/homework", label: "Bài tập & kiểm tra", icon: ClipboardList },
  { href: "/student/flashcard", label: "Flashcard", icon: Sparkles },
  { href: "/student/library", label: "Kho tài liệu", icon: Library },
  { href: "/student/makeup", label: "Đăng ký học bù", icon: CalendarClock },
  { href: "/student/tuition", label: "Học phí & hóa đơn", icon: Receipt },
];

const teacherNav: NavEntry[] = [
  { href: "/teacher", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/teacher/schedule", label: "Lịch dạy của tôi", icon: CalendarDays },
  { href: "/teacher/classes", label: "Lớp dạy", icon: School },
  { href: "/teacher/requests", label: "Xin đổi lịch", icon: CalendarOff },
  { href: "/teacher/homework", label: "Giao bài tập", icon: ClipboardList },
  { href: "/teacher/students", label: "Học viên của tôi", icon: Users },
  { href: "/teacher/payroll", label: "Chấm công của tôi", icon: CalendarCheck },
  libraryGroup,
];

const adminNav: NavEntry[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  {
    label: "Dạy & học",
    icon: Presentation,
    children: [
      { href: "/admin/courses", label: "Khóa học", icon: BookMarked },
      { href: "/admin/classes", label: "Lớp học", icon: School },
      { href: "/admin/timetable", label: "Thời khóa biểu", icon: CalendarDays },
    ],
  },
  libraryGroup,
  {
    label: "Đổi lịch & học bù",
    icon: CalendarCog,
    children: [
      { href: "/admin/requests", label: "Duyệt đổi lịch", icon: CalendarOff },
      { href: "/admin/makeup", label: "Quản lý học bù", icon: CalendarClock },
    ],
  },
  {
    label: "Con người",
    icon: Users,
    children: [
      { href: "/admin/students", label: "Học viên", icon: Users },
      { href: "/admin/teachers", label: "Đội ngũ", icon: GraduationCap },
      { href: "/admin/payroll", label: "Chấm công GV", icon: CalendarCheck },
    ],
  },
  {
    label: "Tài chính & báo cáo",
    icon: Wallet,
    children: [
      { href: "/admin/tuition", label: "Học phí", icon: Wallet },
      { href: "/admin/reports", label: "Báo cáo & thống kê", icon: BarChart3 },
    ],
  },
  { href: "/admin/settings", label: "Cài đặt hệ thống", icon: Settings },
];

const parentNav: NavEntry[] = [
  { href: "/parent", label: "Trang chủ", icon: LayoutDashboard },
];

/**
 * Hành chính và kế toán dùng chung menu khu quản trị với admin — mục nào hiện
 * là do bảng quyền quyết định (lọc trong `SidebarNav`), không cắt cứng ở đây
 * nữa. Nhờ vậy bật quyền cho một vai trò là menu tự mọc ra.
 */
export const navByRole: Record<Role, NavEntry[]> = {
  student: studentNav,
  teacher: teacherNav,
  admin: adminNav,
  staff: adminNav,
  accountant: adminNav,
  parent: parentNav,
};

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href.split("/").length > 2 && pathname.startsWith(href + "/"))
  );
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-950 text-ink-200 print:!hidden lg:flex">
      <div className="px-5 py-5">
        <Link href="/">
          <Logo inverted />
        </Link>
      </div>
      <SidebarNav role={role} />
      <div className="m-4 rounded-xl bg-gradient-brand p-4 text-white shadow-soft">
        <div className="zh text-2xl font-semibold">学而时习之</div>
        <div className="mt-1 text-xs leading-relaxed text-white/80">
          &ldquo;Học phải đi đôi với luyện tập&rdquo; — mỗi ngày 5 từ mới, tiến bộ không ngừng.
        </div>
      </div>
    </aside>
  );
}

/**
 * Danh sách menu — dùng chung cho sidebar desktop và ngăn kéo (drawer) mobile.
 * `onNavigate` để drawer tự đóng sau khi bấm vào một mục.
 */
export function SidebarNav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { can } = useAuth();
  const badges = useNavBadges();

  // Ẩn mục không có quyền — dùng đúng bảng tra của AuthGuard nên menu và
  // chặn truy cập không bao giờ lệch nhau.
  const nav = useMemo(() => {
    const visible = (l: NavLink) => {
      const perm = permissionForPath(l.href);
      return perm === null || can(perm);
    };
    return navByRole[role]
      .map((e) =>
        isGroup(e) ? { ...e, children: e.children.filter(visible) } : e,
      )
      .filter((e) => (isGroup(e) ? e.children.length > 0 : visible(e)));
  }, [role, can]);

  return (
    <>
      <div className="px-5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        Menu chính
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pb-4">
        {nav.map((entry) =>
          isGroup(entry) ? (
            <NavGroupItem
              key={entry.label}
              group={entry}
              pathname={pathname}
              badges={badges}
              onNavigate={onNavigate}
            />
          ) : (
            <NavLinkItem
              key={entry.href}
              item={entry}
              active={isActive(pathname, entry.href)}
              badge={badges[entry.href]}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>
    </>
  );
}

/** Chấm đỏ đếm việc chờ xử lý — quá 99 thì rút gọn cho khỏi vỡ hàng. */
function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto min-w-[1.25rem] shrink-0 rounded-full bg-gold-500 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLinkItem({
  item,
  active,
  nested,
  badge,
  onNavigate,
}: {
  item: NavLink;
  active: boolean;
  nested?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
      <span className="min-w-0 truncate">{item.label}</span>
      {badge ? <NavBadge count={badge} /> : null}
    </Link>
  );
}

/** Menu cha: bấm để mở / thu, tự mở sẵn khi đang ở một trang con. */
function NavGroupItem({
  group,
  pathname,
  badges,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  badges: Record<string, number>;
  onNavigate?: () => void;
}) {
  const hasActiveChild = group.children.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(hasActiveChild);
  const expanded = open || hasActiveChild;
  const Icon = group.icon;
  // Cụm đang thu gọn vẫn phải báo có việc: cộng dồn badge của các mục con.
  const groupBadge = group.children.reduce((n, c) => n + (badges[c.href] ?? 0), 0);

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
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        {!expanded && groupBadge > 0 ? <NavBadge count={groupBadge} /> : null}
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="relative mt-0.5 space-y-0.5">
          <span className="absolute bottom-1 left-[21px] top-1 w-px bg-ink-800" />
          {group.children.map((c) => (
            <NavLinkItem
              key={c.href}
              item={c}
              active={isActive(pathname, c.href)}
              badge={badges[c.href]}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
