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
    brand: "from-brand-500/15 to-brand-500/0 text-brand-600",
    gold: "from-gold-400/25 to-gold-400/0 text-gold-700",
    jade: "from-emerald-400/20 to-emerald-400/0 text-emerald-700",
    sky: "from-sky-400/20 to-sky-400/0 text-sky-700",
  } as const;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm card-hover",
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-60", accentMap[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
          {typeof delta === "number" && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                delta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
              )}
            >
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-xl bg-white/80 p-2 shadow-sm">
            <Icon className={cn("h-5 w-5", accentMap[accent].split(" ").pop())} />
          </div>
        )}
      </div>
    </div>
  );
}
