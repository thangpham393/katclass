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

export type TextbookSeries = "HSK30" | "HSK" | "YCT" | "OTHER";

export const SERIES_LABELS: Record<TextbookSeries, string> = {
  HSK30: "Giáo trình HSK 3.0 (新HSK教程)",
  HSK: "Giáo trình HSK (bộ chuẩn cũ)",
  YCT: "Giáo trình YCT (thiếu nhi)",
  OTHER: "Giáo trình khác",
};

export const SERIES_DESCRIPTIONS: Record<TextbookSeries, string> = {
  HSK30: "Bộ 新HSK教程 theo đại cương HSK 3.0 (ba bậc chín cấp) — giáo trình chính thức mới, dùng cho lớp luyện thi HSK từ 2026.",
  HSK: "Bộ chuẩn 标准教程 HSK — dùng cho lớp người lớn, luyện thi HSK.",
  YCT: "Bộ chuẩn 标准教程 YCT — dùng cho lớp tiểu học và THCS.",
  OTHER: "Các bộ riêng của trung tâm (MSutong, giáo trình chuyên đề...) — cấp độ ghi trên bìa chỉ là trình độ tương đương.",
};

/**
 * Xếp giáo trình vào bộ theo MÃ giáo trình, không theo cấp độ: một bộ riêng
 * như MSutong vẫn ghi level HSK3 để chỉ trình độ tương đương, nhưng nó không
 * thuộc bộ 标准教程 HSK nên phải nằm ở mục "Giáo trình khác".
 * Mã kết thúc bằng "-new30" là bộ 新HSK教程 (đại cương HSK 3.0) — tách riêng
 * khỏi bộ chuẩn cũ để giáo viên không chọn nhầm quyển.
 * Chỉ khi giáo trình chưa có mã mới đoán theo level.
 */
export function textbookSeries(tb: { level?: string | null; code?: string | null }): TextbookSeries {
  const code = (tb.code ?? "").trim().toUpperCase();
  if (code) {
    if (code.endsWith("-NEW30")) return "HSK30";
    if (code.startsWith("YCT")) return "YCT";
    if (code.startsWith("HSK")) return "HSK";
    return "OTHER";
  }
  const level = (tb.level ?? "").toUpperCase();
  if (level.startsWith("YCT")) return "YCT";
  if (level.startsWith("HSK")) return "HSK";
  return "OTHER";
}

/**
 * Màu bìa theo TỪNG CẤP ĐỘ để nhìn lướt là phân biệt được quyển nào:
 * HSK 1 vàng · HSK 2 xanh lá · HSK 3 cam · YCT 1 xanh lá · YCT 2 tím ·
 * YCT 3 xanh dương · YCT 4 cam. Cấp chưa khai báo thì lấy màu mặc định
 * của bộ.
 */
const LEVEL_GRADIENTS: Record<string, string> = {
  HSK1: "from-amber-400 via-amber-500 to-amber-700",
  HSK2: "from-emerald-400 via-emerald-600 to-emerald-800",
  HSK3: "from-orange-400 via-orange-500 to-orange-700",
  HSK4: "from-rose-400 via-rose-500 to-rose-700",
  HSK5: "from-cyan-400 via-cyan-600 to-cyan-800",
  HSK6: "from-indigo-400 via-indigo-600 to-indigo-800",
  YCT1: "from-emerald-400 via-emerald-500 to-emerald-700",
  YCT2: "from-violet-400 via-violet-500 to-violet-700",
  YCT3: "from-sky-400 via-sky-500 to-sky-700",
  YCT4: "from-orange-400 via-orange-500 to-orange-600",
};

const SERIES_GRADIENTS: Record<TextbookSeries, string> = {
  HSK30: "from-brand-500 via-brand-700 to-brand-900",
  HSK: "from-brand-500 via-brand-700 to-brand-900",
  YCT: "from-gold-400 via-gold-600 to-gold-800",
  OTHER: "from-ink-500 via-ink-700 to-ink-900",
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
  // Bộ riêng (OTHER) giữ màu navy của trung tâm, không mượn màu cấp độ HSK/YCT
  // — nếu không, MSutong 4 (level HSK3) trông y hệt quyển HSK 3.
  const gradient =
    (series !== "OTHER" && level && LEVEL_GRADIENTS[level.trim().toUpperCase()]) ||
    SERIES_GRADIENTS[series];
  const watermark = (name_zh ?? name).trim().slice(0, 1);
  // Nhãn nhỏ góc trên bìa: bộ 3.0 ghi rõ phiên bản để phân biệt với bộ cũ.
  const seriesLabel = series === "OTHER" ? "KAT" : series === "HSK30" ? "HSK 3.0" : series;
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
        <div className={cn("h-full w-full bg-gradient-to-br", gradient)}>
          {/* gáy sách */}
          <div className="absolute inset-y-0 left-0 w-[6px] bg-black/25" />
          <div className="absolute inset-y-0 left-[6px] w-px bg-white/25" />
          {/* chữ Hán chìm làm nền */}
          <div className="zh pointer-events-none absolute -bottom-4 -right-3 text-[5.5rem] font-black leading-none text-white/15">
            {watermark}
          </div>
          <div className="relative flex h-full flex-col justify-between p-2.5 pl-4 text-white">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {seriesLabel}
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
