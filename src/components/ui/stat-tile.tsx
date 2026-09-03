import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ô số liệu của bảng điều khiển: nhãn viết hoa nhỏ ở trên, con số to bên dưới,
 * biểu tượng nhạt màu nép góc phải.
 *
 * Khác `StatCard` (dùng trong các trang chi tiết) ở chỗ ô này cố tình phẳng và
 * đều nhau — cả dãy 5-10 ô xếp thành lưới thì con số phải là thứ nổi duy nhất,
 * thêm viền màu hay nền màu vào là mắt không biết đọc ô nào trước.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "gold",
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  tone?: "gold" | "brand" | "jade";
  className?: string;
  /** Chỗ để hạ cỡ chữ khi giá trị là số tiền dài (vd 467.149.500 ₫). */
  valueClassName?: string;
}) {
  const toneClass = {
    gold: "text-gold-600",
    brand: "text-brand-600",
    jade: "text-jade-500",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors sm:p-5",
        href && "hover:border-gold-300",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] text-muted-foreground">
          {label}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", toneClass)} />}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]",
          valueClassName,
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
