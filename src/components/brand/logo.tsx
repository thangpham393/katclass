import { cn } from "@/lib/utils";

/**
 * Logo KAT — dấu triện đỏ chu sa với chữ 汉 (Hán) trắng,
 * theo ngôn ngữ thiết kế "Mực & Ngọc".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KAT logo"
    >
      <rect width="64" height="64" rx="12" fill="#d03e1d" />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="8"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2"
      />
      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontFamily="'Noto Serif SC', 'Songti SC', serif"
        fontWeight={900}
        fontSize={34}
        fill="#ffffff"
      >
        汉
      </text>
    </svg>
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
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-9 w-9 overflow-hidden rounded-lg shadow-seal">
        <LogoMark />
      </div>
      {showText && (
        <div className="leading-tight">
          <div
            className={cn(
              "text-base font-extrabold tracking-tight",
              inverted ? "text-white" : "text-ink-900",
            )}
          >
            KAT <span className={inverted ? "text-brand-300" : "text-brand-600"}>CLASS</span>
          </div>
          <div
            className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.18em]",
              inverted ? "text-white/60" : "text-muted-foreground",
            )}
          >
            Tiếng Trung · Du học · Kỹ năng
          </div>
        </div>
      )}
    </div>
  );
}
