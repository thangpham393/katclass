"use client";

/**
 * Ảnh thumbnail (bìa) cho một giáo trình trong thư viện.
 *
 * Có `cover_url` thì dùng ảnh thật; chưa có thì tự vẽ bìa sách theo bộ
 * (HSK xanh KAT, YCT đỏ/cam cho thiếu nhi, còn lại navy) — luôn có ảnh
 * nhận diện thay vì ô chữ cái trống trơn.
 */

import { cn } from "@/lib/utils";
import { LEVEL_LABELS } from "@/lib/db";

export type TextbookSeries = "HSK" | "YCT" | "OTHER";

export const SERIES_LABELS: Record<TextbookSeries, string> = {
  HSK: "Giáo trình HSK",
  YCT: "Giáo trình YCT (thiếu nhi)",
  OTHER: "Giáo trình khác",
};

export const SERIES_DESCRIPTIONS: Record<TextbookSeries, string> = {
  HSK: "Bộ chuẩn 标准教程 HSK — dùng cho lớp người lớn, luyện thi HSK.",
  YCT: "Bộ chuẩn 标准教程 YCT — dùng cho lớp tiểu học và THCS.",
  OTHER: "Các giáo trình còn lại của trung tâm.",
};

/** Xếp giáo trình vào bộ: ưu tiên level (HSK1.../YCT1...), sau đó mã giáo trình. */
export function textbookSeries(tb: { level?: string | null; code?: string | null }): TextbookSeries {
  const key = `${tb.level ?? ""} ${tb.code ?? ""}`.toUpperCase();
  if (key.includes("YCT")) return "YCT";
  if (key.includes("HSK")) return "HSK";
  return "OTHER";
}

const SERIES_STYLE: Record<TextbookSeries, { bg: string; spine: string }> = {
  HSK: { bg: "from-brand-600 via-brand-700 to-brand-900", spine: "bg-brand-950/40" },
  YCT: { bg: "from-gold-500 via-gold-600 to-gold-800", spine: "bg-gold-950/40" },
  OTHER: { bg: "from-ink-600 via-ink-700 to-ink-900", spine: "bg-ink-950/40" },
};

export function TextbookCover({
  name,
  name_zh,
  level,
  code,
  cover_url,
  className,
}: {
  name: string;
  name_zh?: string | null;
  level?: string | null;
  code?: string | null;
  cover_url?: string | null;
  className?: string;
}) {
  const series = textbookSeries({ level, code });
  const style = SERIES_STYLE[series];
  const watermark = (name_zh ?? name).trim().slice(0, 1);
  const levelLabel = level ? (LEVEL_LABELS[level] ?? level) : null;

  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/10",
        className,
      )}
    >
      {cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover_url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className={cn("h-full w-full bg-gradient-to-br", style.bg)}>
          {/* gáy sách */}
          <div className={cn("absolute inset-y-0 left-0 w-[6px]", style.spine)} />
          <div className="absolute inset-y-0 left-[6px] w-px bg-white/25" />
          {/* chữ Hán chìm làm nền */}
          <div className="zh pointer-events-none absolute -bottom-4 -right-3 text-[5.5rem] font-black leading-none text-white/15">
            {watermark}
          </div>
          <div className="relative flex h-full flex-col justify-between p-2.5 pl-4 text-white">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {series === "OTHER" ? "KAT" : series}
            </div>
            <div className="min-w-0">
              {levelLabel && (
                <div className="text-base font-extrabold leading-none drop-shadow-sm">{levelLabel}</div>
              )}
              {name_zh && (
                <div className="zh mt-1 truncate text-[11px] font-bold text-white/90">{name_zh}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
