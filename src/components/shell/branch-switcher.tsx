"use client";

import { Building2, ChevronDown } from "lucide-react";
import { useBranch } from "./branch-provider";

/**
 * Nút chuyển chi nhánh trên thanh trên cùng.
 * Chỉ admin / hành chính / kế toán thấy; vai trò khác chỉ hiện tên cơ sở.
 */
export function BranchSwitcher() {
  const { branches, branchId, branch, canSwitch, switchTo } = useBranch();
  if (!branch) return null;

  if (!canSwitch || branches.length < 2) {
    return (
      <span className="hidden items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
        <Building2 className="h-3.5 w-3.5 text-brand-600" />
        {branch.name}
      </span>
    );
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
        <Building2 className="h-4 w-4 text-brand-600" />
      </span>
      <select
        aria-label="Chi nhánh đang xem"
        title="Chuyển chi nhánh"
        value={branchId ?? ""}
        onChange={(e) => switchTo(e.target.value)}
        className="h-9 appearance-none rounded-lg border bg-card pl-8 pr-8 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
