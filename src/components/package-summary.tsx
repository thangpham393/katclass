"use client";

import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { fetchStudentPackages } from "@/lib/db-tuition";

/**
 * Thẻ "gói buổi còn lại" dùng chung cho khu học viên và cổng phụ huynh
 * (RLS quyết định quyền xem). Học viên chưa mua gói thì không hiện gì.
 */
export function PackageSummaryCard({ studentId, forParent }: { studentId: string; forParent?: boolean }) {
  const packages = useLoad(
    () => (studentId ? fetchStudentPackages(studentId) : Promise.resolve([])),
    [studentId],
  );

  const list = packages.data ?? [];
  if (packages.loading || packages.error || list.length === 0) return null;

  const remaining = list.reduce((s, p) => s + p.remaining_sessions, 0);
  const total = list.reduce((s, p) => s + p.total_sessions, 0);
  const low = remaining <= 3;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4",
        low ? "border-gold-300 bg-gold-50" : "bg-card",
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          low ? "bg-gold-100 text-gold-700" : "bg-brand-50 text-brand-600",
        )}
      >
        <Wallet className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {forParent ? "Gói buổi của con" : "Gói buổi của bạn"}
          {low ? (
            <Badge variant="gold">{remaining === 0 ? "Đã hết buổi" : `Chỉ còn ${remaining} buổi`}</Badge>
          ) : (
            <Badge variant="jade">Còn {remaining} buổi</Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {list.map((p) => `${p.name}: còn ${p.remaining_sessions}/${p.total_sessions}`).join(" · ")}
          {low && " — liên hệ trung tâm để gia hạn nhé!"}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("text-2xl font-extrabold tracking-tight", low && "text-gold-700")}>
          {remaining}
          <span className="text-sm font-semibold text-muted-foreground">/{total}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">buổi còn lại</div>
      </div>
    </div>
  );
}
