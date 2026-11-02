"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/db";
import { computeClassProgress } from "@/lib/class-progress";
import type { DashClass, DashProgress } from "@/lib/db-dashboard";
import { SCROLL_10, SectionHead, daysBetween, dmy } from "./kit";

/** Lớp kết thúc trong chừng này ngày tới thì phải lo lớp nối tiếp / tái phí. */
export const ENDING_DAYS = 21;
/** Sĩ số dưới mức này là lớp mỏng, cân nhắc gộp. */
export const SMALL_CLASS = 4;

interface PlanRow {
  id: string;
  name: string;
  teacher: string;
  size: number;
  learned: number;
  total: number | null;
  end: string | null;
  endProjected: boolean;
  daysLeft: number | null;
  ending: boolean;
  small: boolean;
}

/**
 * Lớp cần lên kế hoạch: sắp kết thúc (kịp mở lớp nối tiếp, chốt tái phí
 * trước khi học viên rời đi) hoặc sĩ số mỏng (đang lỗ công giáo viên).
 */
export function PlanCard({
  classes,
  progress,
  loading,
}: {
  classes: DashClass[];
  progress: Record<string, DashProgress>;
  loading: boolean;
}) {
  const rows = useMemo<PlanRow[]>(() => {
    const today = todayISO();
    const out: PlanRow[] = [];
    for (const c of classes) {
      const p = progress[c.id];
      const prog = computeClassProgress({
        total: c.course?.total_sessions,
        classStartDate: c.start_date,
        firstDate: p?.first_date ?? null,
        lastDate: p?.last_date ?? null,
        done: p?.done ?? 0,
        pastPending: p?.past_pending ?? 0,
        upcoming: p?.upcoming ?? 0,
        schedules: c.class_schedules,
      });
      const size = c.class_students.filter((x) => x.status === "active").length;
      const daysLeft = prog.endDate ? daysBetween(today, prog.endDate) : null;
      // Chỉ báo "sắp kết thúc" khi biết tổng số buổi của khóa — không thì
      // ngày buổi cuối đã sinh không phải là ngày kết thúc thật.
      const ending = !!prog.total && daysLeft !== null && daysLeft >= 0 && daysLeft <= ENDING_DAYS;
      const small = size < SMALL_CLASS;
      if (!ending && !small) continue;
      out.push({
        id: c.id,
        name: c.name,
        teacher: c.teacher?.name ?? "—",
        size,
        learned: prog.learned,
        total: prog.total,
        end: prog.endDate,
        endProjected: prog.endProjected,
        daysLeft,
        ending,
        small,
      });
    }
    return out;
  }, [classes, progress]);

  const sort = useSort(
    rows,
    {
      name: (r) => r.name,
      size: (r) => r.size,
      progress: (r) => (r.total ? r.learned / r.total : null),
      end: (r) => (r.ending ? r.end : null),
    },
    ["end", 1],
  );

  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Lớp cần lên kế hoạch"
        desc={`Kết thúc trong ${ENDING_DAYS} ngày tới (mở lớp nối tiếp, chốt tái phí) hoặc sĩ số dưới ${SMALL_CLASS}.`}
      />
      {loading ? (
        <LoadingRows rows={2} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="name" {...sort}>Lớp</Th>
                <Th k="size" {...sort} align="right">Sĩ số</Th>
                <Th k="progress" {...sort} align="right">Tiến độ</Th>
                <Th k="end" {...sort}>Kết thúc</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sort.sorted.length === 0 ? (
                <EmptyRow cols={4}>Chưa có lớp nào cần lên kế hoạch.</EmptyRow>
              ) : (
                sort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={TD}>
                      <Link href={`/admin/classes/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.teacher}</div>
                    </td>
                    <td className={cn(TD, "text-right", r.small && "font-semibold text-rose-600")}>{r.size}</td>
                    <td className={cn(TD, "whitespace-nowrap text-right")}>
                      {r.total ? `${r.learned}/${r.total}` : r.learned}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      <div className="flex flex-wrap items-center gap-1">
                        {r.ending && (
                          <Pill tone={(r.daysLeft ?? 99) <= 7 ? "red" : "amber"}>
                            {dmy(r.end)}
                            {r.endProjected ? " (dự kiến)" : ""} · còn {r.daysLeft} ngày
                          </Pill>
                        )}
                        {r.small && <Pill tone="muted">Sĩ số thấp</Pill>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
