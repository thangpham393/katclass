import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo chính thức KAT Chinese Class (file gốc ở `public/`).
 *
 * Hai bản dùng cho hai loại nền:
 *   - Nền sáng → bản ngang đầy đủ `logo.png` (chữ xanh/đỏ của trung tâm).
 *   - Nền tối (sidebar, ngăn kéo, màn đăng nhập) → chữ trong logo là xanh
 *     đậm nên đọc không ra; thay bằng con dấu tròn đặt trên ô trắng + tên
 *     trung tâm gõ bằng chữ trắng.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="KAT Chinese Class"
      width={173}
      height={173}
      priority
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

export function Logo({
  className,
  showText = true,
  inverted = false,
}: {
  className?: string;
  showText?: boolean;
  inverted?: boolean;
}) {
  if (!showText) {
    return (
      <div className={cn("relative h-9 w-9 shrink-0", className)}>
        <LogoMark />
      </div>
    );
  }

  if (!inverted) {
    return (
      <Image
        src="/logo.png"
        alt="KAT Chinese Class"
        width={981}
        height={172}
        priority
        className={cn("h-9 w-auto object-contain", className)}
      />
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white p-0.5 shadow-sm">
        <LogoMark />
      </div>
      <div className="leading-tight">
        <div className="text-base font-extrabold tracking-tight text-white">
          KAT CHINESE <span className="text-gold-400">CLASS</span>
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Tiếng Trung · Du học
        </div>
      </div>
    </div>
  );
}
