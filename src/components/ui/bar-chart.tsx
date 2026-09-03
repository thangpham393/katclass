"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Biểu đồ cột dựng bằng div, KHÔNG kéo thêm thư viện vẽ (recharts nặng gần
 * bằng cả phần còn lại của trang chỉ để vẽ 12 cái cột). Div cũng thắng SVG ở
 * chỗ chữ luôn nét và cột tự co theo bề rộng màn hình.
 *
 * Hai kiểu: `grouped` (thu và chi đứng cạnh nhau để so) và `stacked` (các
 * nguồn thu chồng lên nhau vì cộng lại mới là tổng doanh thu). Mỗi cột có
 * một khung chú thích hiện khi rê chuột / chạm — số liệu chi tiết không in
 * sẵn lên cột, in hết thì rừng chữ.
 */

export interface ChartSeries {
  label: string;
  /** Mã màu (hex) — đã kiểm tra tương phản và mù màu. */
  color: string;
  values: number[];
}

/** Rút gọn tiền cho vạch trục: 12,5 tr — 1,2 tỉ. */
export function shortMoney(n: number): string {
  const abs = Math.abs(n);
  const f = (v: number) => v.toFixed(v >= 10 || Number.isInteger(v) ? 0 : 1).replace(".", ",");
  if (abs >= 1_000_000_000) return f(n / 1_000_000_000) + " tỉ";
  if (abs >= 1_000_000) return f(n / 1_000_000) + " tr";
  if (abs >= 1_000) return f(n / 1_000) + " ng";
  return String(Math.round(n));
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const unit = [1, 2, 2.5, 5, 10].find((u) => v <= u * pow) ?? 10;
  return unit * pow;
}

export function BarChart({
  labels,
  series,
  stacked = false,
  format = (n) => n.toLocaleString("vi-VN") + " ₫",
  height = 220,
  className,
}: {
  labels: string[];
  series: ChartSeries[];
  stacked?: boolean;
  format?: (n: number) => string;
  height?: number;
  className?: string;
}) {
  const columnTotal = (i: number) =>
    stacked ? series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0) : 0;

  const peak = Math.max(
    0,
    ...labels.map((_, i) =>
      stacked ? columnTotal(i) : Math.max(...series.map((s) => s.values[i] ?? 0)),
    ),
  );
  const max = niceMax(peak);
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  // Nhiều cột (biểu đồ theo ngày) thì chỉ in nhãn cách quãng cho khỏi chồng chữ.
  const labelStep = labels.length > 20 ? 5 : labels.length > 14 ? 2 : 1;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-2">
        {/* Vạch giá trị bên trái */}
        <div
          className="relative w-12 shrink-0 sm:w-16"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${(1 - t) * 100}%` }}
            >
              {t === 0 ? "0" : shortMoney(max * t)}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div
                key={t}
                className={cn(
                  "absolute inset-x-0 border-t",
                  t === 0 ? "border-border" : "border-dashed border-border/60",
                )}
                style={{ top: `${(1 - t) * 100}%` }}
                aria-hidden
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-[3px]">
              {labels.map((label, i) => {
                const total = stacked
                  ? columnTotal(i)
                  : series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0);
                return (
                  <div key={label + i} className="group relative flex h-full min-w-0 flex-1 items-end">
                    {/* Vùng bắt chuột phủ cả cột — cột thấp vẫn rê trúng */}
                    <div className="absolute inset-0 rounded-sm transition-colors group-hover:bg-muted/50" />

                    <div
                      className={cn(
                        "relative flex w-full items-end justify-center gap-[2px]",
                        stacked && "flex-col justify-end gap-[2px]",
                      )}
                      style={{ height: "100%" }}
                    >
                      {(stacked ? [...series].reverse() : series).map((s) => {
                        const v = s.values[i] ?? 0;
                        const h = max > 0 ? (v / max) * 100 : 0;
                        return (
                          <div
                            key={s.label}
                            className={cn(
                              "min-h-0 rounded-t-[4px] transition-opacity",
                              stacked ? "w-full max-w-[34px]" : "min-w-0 flex-1 max-w-[22px]",
                              v === 0 && "opacity-0",
                            )}
                            style={{ height: `${h}%`, backgroundColor: s.color }}
                          />
                        );
                      })}
                    </div>

                    {total > 0 && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-soft group-hover:block">
                        <div className="font-semibold">{label}</div>
                        {series.map((s) => (
                          <div key={s.label} className="mt-0.5 flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="ml-auto pl-2 font-semibold tabular-nums">
                              {format(s.values[i] ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1.5 flex gap-[3px]">
            {labels.map((label, i) => (
              <div
                key={label + i}
                className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
              >
                {i % labelStep === 0 ? label : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
