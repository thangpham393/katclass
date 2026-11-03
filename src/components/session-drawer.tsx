"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { SessionDetail } from "@/components/session-detail";
import { sessionHref } from "@/components/dashboard/sections";
import { cn } from "@/lib/utils";

/*
 * Chi tiết buổi học mở dạng ngăn kéo trượt từ phải, đè lên trang đang xem —
 * điểm danh / nhận xét / chấm công xong đóng lại là về đúng chỗ cũ (thời khóa
 * biểu, trang chủ...) thay vì phải chuyển trang rồi bấm back.
 *
 * Provider gắn ở AppShell; nơi nào muốn mở buổi thì dùng <SessionLink> (vẫn là
 * thẻ <a> thật: Ctrl/Cmd-click, chuột giữa vẫn mở trang đầy đủ ở tab mới) hoặc
 * gọi useSessionDrawer().open(). Ngoài AppShell (không có provider) thì
 * SessionLink chỉ là link thường.
 */

interface OpenOptions {
  /** Bật sẵn ô nhận xét cho học viên này */
  studentId?: string;
  /** Gọi khi đóng ngăn kéo — để trang bên dưới nạp lại số liệu vừa sửa */
  onClose?: () => void;
}

interface DrawerApi {
  open: (sessionId: string, opts?: OpenOptions) => void;
}

const DrawerContext = createContext<DrawerApi | null>(null);

export function useSessionDrawer(): DrawerApi | null {
  return useContext(DrawerContext);
}

const CLOSE_MS = 200;

export function SessionDrawerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<{ id: string; studentId?: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef<(() => void) | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const open = useCallback((id: string, opts?: OpenOptions) => {
    window.clearTimeout(closeTimer.current);
    onCloseRef.current = opts?.onClose;
    setClosing(false);
    setCurrent({ id, studentId: opts?.studentId });
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setCurrent(null);
      setClosing(false);
      const cb = onCloseRef.current;
      onCloseRef.current = undefined;
      cb?.();
    }, CLOSE_MS);
  }, []);

  // Bấm link bên trong (sang trang lớp, chuẩn bị bài, vào lớp) → đóng luôn
  useEffect(() => {
    window.clearTimeout(closeTimer.current);
    setCurrent(null);
    setClosing(false);
    onCloseRef.current = undefined;
  }, [pathname]);

  const isOpen = current !== null;
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      // Đang mở hộp thoại con (nhận xét, chấm công) thì Esc chỉ đóng hộp thoại đó
      if (e.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  const drawer = current && (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Đóng chi tiết buổi"
        onClick={close}
        className={cn(
          "absolute inset-0 h-full w-full bg-ink-950/40 backdrop-blur-[1px]",
          closing ? "animate-overlay-out" : "animate-overlay-in",
        )}
      />
      <aside
        role="dialog"
        aria-label="Chi tiết buổi học"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-background text-foreground shadow-2xl sm:w-[92vw] sm:max-w-3xl sm:border-l",
          closing ? "animate-slide-out-right" : "animate-slide-in-right",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">Chi tiết buổi học</span>
          <Link
            href={sessionHref(current.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            title="Mở thành trang riêng"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Mở trang đầy đủ
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <SessionDetail key={current.id} sessionId={current.id} commentStudentId={current.studentId} inDrawer />
        </div>
      </aside>
    </div>
  );

  return (
    <DrawerContext.Provider value={{ open }}>
      {children}
      {drawer && mounted ? createPortal(drawer, document.body) : null}
    </DrawerContext.Provider>
  );
}

/**
 * Link tới chi tiết buổi: bấm thường mở ngăn kéo, Ctrl/Cmd/Shift/chuột giữa
 * thì để trình duyệt mở trang đầy đủ như link bình thường.
 */
export function SessionLink({
  sessionId,
  studentId,
  onClose,
  onClick,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  sessionId: string;
  studentId?: string;
  onClose?: () => void;
}) {
  const drawer = useSessionDrawer();
  return (
    <Link
      {...rest}
      href={sessionHref(sessionId, studentId)}
      onClick={(e) => {
        onClick?.(e);
        if (!drawer || e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        drawer.open(sessionId, { studentId, onClose });
      }}
    />
  );
}
