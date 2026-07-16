"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, ClipboardList, UserX, Wallet, Info } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  type NotificationRow,
  type NotificationType,
} from "@/lib/db-notifications";

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  homework_new: ClipboardList,
  makeup_scheduled: CalendarClock,
  child_absent: UserX,
  package_low: Wallet,
  generic: Info,
};

/** Chuông thông báo trên topbar: badge số chưa đọc + panel danh sách. */
export function NotificationBell({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileId) return;
    fetchUnreadCount(profileId).then(setUnread).catch(() => {});
  }, [profileId]);

  // Đóng panel khi click ra ngoài
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const list = await fetchNotifications(profileId);
        setItems(list);
        if (list.some((n) => !n.read_at)) {
          await markAllRead(profileId);
          setUnread(0);
        }
      } catch {
        setItems([]);
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground ring-2 ring-ring",
        )}
        title="Thông báo"
        aria-label="Thông báo"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="border-b px-4 py-3 text-sm font-bold">Thông báo</div>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {items === null ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Chưa có thông báo nào.
              </div>
            ) : (
              <div className="divide-y">
                {items.map((n) => {
                  const Icon = TYPE_ICONS[n.type] ?? Info;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        setOpen(false);
                        if (n.link) router.push(n.link);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary",
                        !n.read_at && "bg-brand-50/50",
                      )}
                    >
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-snug">{n.title}</div>
                        {n.body && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                        )}
                        <div className="mt-1 text-[11px] text-muted-foreground/80">
                          {relativeTime(n.created_at)}
                        </div>
                      </div>
                      {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
