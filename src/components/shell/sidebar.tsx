"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { permissionForPath } from "@/lib/permissions";
import { useAuth } from "@/components/auth/auth-provider";
import { useNavBadges } from "./use-nav-badges";
import { signOut } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/brand/logo";
import {
  isActive,
  isGroup,
  navByRole,
  type NavGroup,
  type NavLink as NavLinkType,
  type NavSection,
} from "./nav-config";

/**
 * Menu bên trái — nền trắng, chữ xám, mục đang mở tô đỏ nguyên khối.
 *
 * Nền sáng thay cho bản navy cũ vì phần lớn thời gian người dùng nhìn vào
 * bảng dữ liệu bên phải (cũng nền trắng); một dải tối bên trái cứ kéo mắt về
 * phía nó. Sáng đều thì mục đang chọn là thứ duy nhất có màu, nhìn phát thấy
 * ngay mình đang ở đâu.
 */
export function Sidebar({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-border/70 bg-card print:!hidden lg:flex",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/" aria-label="Trang chủ">
          <Logo className="h-8" />
        </Link>
      </div>
      <SidebarNav role={user.role} />
      <SignOutButton />
    </aside>
  );
}

/** Đăng xuất nằm cuối menu — đúng chỗ mắt tìm đến, không giấu trong topbar. */
function SignOutButton({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <div className="shrink-0 border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={async () => {
          onNavigate?.();
          await signOut();
          router.replace("/login");
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-gold-50 hover:text-gold-700"
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" />
        Đăng xuất
      </button>
    </div>
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
  const sections = useMemo(() => {
    const visible = (l: NavLinkType) => {
      const perm = permissionForPath(l.href);
      return perm === null || can(perm);
    };
    return navByRole[role]
      .map((s): NavSection => ({
        ...s,
        entries: s.entries
          .map((e) => (isGroup(e) ? { ...e, children: e.children.filter(visible) } : e))
          .filter((e) => (isGroup(e) ? e.children.length > 0 : visible(e))),
      }))
      .filter((s) => s.entries.length > 0);
  }, [role, can]);

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-1">
      {sections.map((section, i) => (
        <div key={section.label ?? `s${i}`} className={cn(section.label && "pt-4")}>
          {section.label && (
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {section.label}
            </div>
          )}
          <div className="space-y-0.5">
            {section.entries.map((entry) =>
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
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Chấm đỏ đếm việc chờ xử lý — quá 99 thì rút gọn cho khỏi vỡ hàng. */
function NavBadge({ count, onRed }: { count: number; onRed?: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto min-w-[1.25rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-none",
        onRed ? "bg-white text-gold-700" : "bg-gold-600 text-white",
      )}
    >
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
  item: NavLinkType;
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        nested && "py-2 pl-9 text-[13px]",
        active
          ? "bg-gold-600 text-white shadow-seal"
          : "text-foreground/75 hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", nested && "h-4 w-4")} />
      <span className="min-w-0 truncate">{item.label}</span>
      {badge ? <NavBadge count={badge} onRed={active} /> : null}
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
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          hasActiveChild
            ? "text-gold-700"
            : "text-foreground/75 hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        {!expanded && groupBadge > 0 ? <NavBadge count={groupBadge} /> : null}
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="relative mt-0.5 space-y-0.5">
          <span className="absolute bottom-1 left-[21px] top-1 w-px bg-border" />
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

export { SignOutButton };
