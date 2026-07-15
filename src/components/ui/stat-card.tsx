import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  accent = "brand",
  className,
}: {
  label: string;
  value: string | number;
  delta?: number;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "brand" | "gold" | "jade" | "sky";
  className?: string;
}) {
  const accentMap = {
    brand: "bg-brand-50 text-brand-700 border-brand-100",
    gold: "bg-gold-50 text-gold-700 border-gold-100",
    jade: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
  } as const;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm card-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
          {typeof delta === "number" && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                delta >= 0 ? "bg-brand-50 text-brand-700" : "bg-gold-50 text-gold-700",
              )}
            >
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg border", accentMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
