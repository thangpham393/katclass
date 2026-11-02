"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* Mảnh ghép dùng chung giữa trang Bảng điều khiển và các khối con của nó. */

/**
 * Bảng cuộn: cao vừa ~10 dòng (dòng hai tầng chữ ≈ 60px + đầu bảng), quá thì
 * cuộn trong khung để hai thẻ đặt cạnh nhau không lệch chiều cao.
 */
export const SCROLL_10 = "max-h-[640px] overflow-auto";

export const WEEKDAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function dmy(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function weekdayOf(iso: string): string {
  return WEEKDAY_NAMES[new Date(iso + "T00:00:00").getDay()];
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(toISO + "T00:00:00").getTime() - new Date(fromISO + "T00:00:00").getTime()) / 86_400_000,
  );
}

/** "18h00 - 19h30" như cách trung tâm vẫn viết lịch. */
export function hm(t: string): string {
  return t.slice(0, 5).replace(":", "h");
}

export function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}

export function SectionHead({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-base font-bold">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: "rose" | "red" | "amber" | "brand" | "green";
}) {
  const box = {
    rose: "bg-rose-50 text-rose-500",
    red: "bg-red-50 text-red-500",
    amber: "bg-amber-100 text-amber-600",
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
  }[tone];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</div>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", box)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </Card>
  );
}
