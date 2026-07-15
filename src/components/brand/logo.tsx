import { cn } from "@/lib/utils";

/**
 * Logo KAT — lettermark "KAT" xanh-đỏ-xanh với nét sách đỏ bên dưới,
 * theo nhận diện KAT Education.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-full w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="KAT logo"
    >
      <rect width="64" height="64" rx="14" fill="white" />
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontWeight={900}
        fontSize={26}
        letterSpacing={-1}
      >
        <tspan fill="#1D4ED8">K</tspan>
        <tspan fill="#DC2626">A</tspan>
        <tspan fill="#1D4ED8">T</tspan>
      </text>
      <path
        d="M14 49 Q 32 57 50 49"
        stroke="#DC2626"
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 47 V 54"
        stroke="#DC2626"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
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
      <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
        <LogoMark />
      </div>
      {showText && (
        <div className="leading-tight">
          <div
            className={cn(
              "text-base font-extrabold tracking-tight",
              inverted ? "text-white" : "text-brand-800",
            )}
          >
            KAT <span className="text-gold-600">CLASS</span>
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
