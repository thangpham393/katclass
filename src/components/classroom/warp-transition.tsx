"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Presentation } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Tâm của hiệu ứng — chính là nút vừa bấm, để đường hầm bung ra từ đó. */
interface Warp {
  href: string;
  x: number;
  y: number;
  label: string;
}

interface WarpApi {
  warpTo: (href: string, origin: { x: number; y: number }, label?: string) => void;
}

const WarpCtx = createContext<WarpApi | null>(null);

/** Nếu chưa bọc provider thì nút vào lớp vẫn chuyển trang bình thường. */
export function useWarp() {
  return useContext(WarpCtx);
}

/** Số tia sáng — đủ dày để thành đường hầm, vẫn nhẹ cho máy phòng học. */
const RAYS = 22;
/** Chờ đường hầm phủ kín màn hình rồi mới đổi trang, tránh thấy cảnh trang trắng. */
const PUSH_DELAY = 340;
/** Trang lớp học đã hiện thì giữ thêm chút cho mắt kịp bắt, rồi mới tan lớp phủ. */
const ARRIVE_HOLD = 260;
/** Mạng chậm/không vào được: chốt chặn để lớp phủ không kẹt lại vĩnh viễn. */
const MAX_HOLD = 6000;

/**
 * Lớp phủ "xuyên không" dùng chung cho cả hệ thống: đặt ở root layout nên nó
 * sống xuyên qua lần chuyển trang — giấu luôn khoảnh khắc trang lớp học đang
 * tải dữ liệu buổi, thay vì chớp trắng rồi mới vào.
 */
export function WarpProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [warp, setWarp] = useState<Warp | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const warpTo = useCallback(
    (href: string, origin: { x: number; y: number }, label?: string) => {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        router.push(href);
        return;
      }
      clearTimers();
      setLeaving(false);
      setWarp({ href, x: origin.x, y: origin.y, label: label ?? "Đang vào lớp…" });
      timers.current.push(window.setTimeout(() => router.push(href), PUSH_DELAY));
      timers.current.push(
        window.setTimeout(() => {
          setLeaving(true);
          timers.current.push(window.setTimeout(() => setWarp(null), 420));
        }, MAX_HOLD),
      );
    },
    [clearTimers, router],
  );

  /* --- Đã sang tới trang đích thì tan lớp phủ (không đợi hết chốt chặn) --- */
  useEffect(() => {
    if (!warp || leaving) return;
    if (pathname !== warp.href) return;
    const hold = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => setWarp(null), 420);
    }, ARRIVE_HOLD);
    return () => window.clearTimeout(hold);
  }, [pathname, warp, leaving]);

  const api = useMemo<WarpApi>(() => ({ warpTo }), [warpTo]);

  return (
    <WarpCtx.Provider value={api}>
      {children}
      {warp && <WarpVeil warp={warp} leaving={leaving} />}
    </WarpCtx.Provider>
  );
}

function WarpVeil({ warp, leaving }: { warp: Warp; leaving: boolean }) {
  const rays = useMemo(() => Array.from({ length: RAYS }, (_, i) => i), []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] overflow-hidden bg-ink-950"
      style={{
        animation: leaving
          ? "warp-out 380ms ease-in forwards"
          : "warp-veil 200ms ease-out both",
      }}
    >
      {/* Đường hầm ánh sáng nở ra từ đúng chỗ ngón tay vừa bấm */}
      <div
        className="warp-tunnel absolute h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: warp.x,
          top: warp.y,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(37,73,236,0.85) 12%, rgba(29,53,130,0.55) 30%, rgba(16,21,39,0) 62%)",
          animation: "warp-tunnel 620ms cubic-bezier(0.5, 0, 0.35, 1) forwards",
        }}
      />

      {/* Tia sáng lao ra bốn phía từ cùng tâm đó */}
      <div className="absolute h-0 w-0" style={{ left: warp.x, top: warp.y }}>
        {rays.map((i) => (
          <span
            key={i}
            className="warp-ray"
            style={
              {
                "--a": `${(360 / RAYS) * i}deg`,
                animationDelay: `${(i % 5) * 70}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Vòng xung kích */}
      {[0, 180].map((delay) => (
        <div
          key={delay}
          className="warp-ring absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60"
          style={{
            left: warp.x,
            top: warp.y,
            animation: `warp-ring 700ms cubic-bezier(0.2, 0.7, 0.3, 1) ${delay}ms forwards`,
          }}
        />
      ))}

      <div
        className="absolute inset-x-0 bottom-[18%] text-center"
        style={{ animation: "warp-label 420ms ease-out 260ms both" }}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink-950/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          <Presentation className="h-4 w-4 text-brand-300" />
          {warp.label}
        </div>
      </div>
    </div>
  );
}

/**
 * Nút "Vào lớp dạy": bấm là bung hiệu ứng xuyên không từ chính nút rồi mới
 * sang phòng học. Nạp trước trang lớp khi rê chuột (không nạp sẵn lúc mount —
 * thời khoá biểu có hàng chục thẻ buổi) để lúc bấm gần như vào ngay, hiệu ứng
 * chỉ còn là phần nhìn chứ không phải thời gian chờ thêm.
 */
export function EnterClassroomButton({
  sessionId,
  label = "Vào lớp dạy",
  className,
  iconClassName,
  ...props
}: {
  sessionId: string;
  label?: string;
  iconClassName?: string;
} & ButtonProps) {
  const router = useRouter();
  const warp = useWarp();
  const href = `/classroom/${sessionId}`;

  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (warp) warp.warpTo(href, origin, "Đang vào lớp…");
    else router.push(href);
  }

  return (
    <Button {...props} className={className} onClick={onClick} onMouseEnter={() => router.prefetch?.(href)}>
      <Presentation className={cn("h-4 w-4", iconClassName)} /> {label}
    </Button>
  );
}
