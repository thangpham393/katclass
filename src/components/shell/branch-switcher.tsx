"use client";

import { Building2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranch } from "./branch-provider";

/**
 * Chi nhánh đang xem. Admin / hành chính / kế toán đổi được (thẻ <select>),
 * vai trò khác chỉ thấy tên cơ sở.
 * Không tự ẩn/hiện theo khổ màn hình — nơi gọi quyết định qua `className`.
 */
export function BranchSwitcher({ className }: { className?: string }) {
  const { branches, branchId, branch, canSwitch, switchTo } = useBranch();
  if (!branch) return null;

  if (!canSwitch || branches.length < 2) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
        <span className="truncate">{branch.name}</span>
      </span>
    );
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <Building2 className="h-4 w-4 text-brand-600" />
      </span>
      <select
        aria-label="Chi nhánh đang xem"
        title="Chuyển chi nhánh"
        value={branchId ?? ""}
        onChange={(e) => switchTo(e.target.value)}
        className="h-9 w-full appearance-none truncate rounded-lg border bg-card pl-8 pr-8 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
