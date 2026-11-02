"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/loading";
import { EmptyRow, TD, Th, useSort } from "@/components/ui/table-kit";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/db";
import {
  LOG_GRACE_HOURS,
  WINDOW_DAYS,
  isLateLog,
  isOverdueLog,
  COMMENT_DAYS,
  isUnmarked,
  type DashSession,
} from "@/lib/db-dashboard";
import { commentDueRows } from "@/lib/dashboard-calc";
import { SectionHead } from "./kit";

interface TeacherRow {
  id: string;
  name: string;
  taught: number;
  late: number;
  missing: number;
  unmarked: number;
  commentDue: number;
}

/**
 * Chất lượng vận hành theo từng giáo viên trong 30 ngày — để nhắc đúng
 * người thay vì nhắc chung cả nhóm.
 */
export function TeacherCard({
  sessions,
  loading,
}: {
  sessions: DashSession[];
  loading: boolean;
}) {
  const rows = useMemo<TeacherRow[]>(() => {
    const now = new Date();
    const today = todayISO();
    const map = new Map<string, TeacherRow>();
    const get = (t: { id: string; name: string }) => {
      let r = map.get(t.id);
      if (!r) {
        r = { id: t.id, name: t.name, taught: 0, late: 0, missing: 0, unmarked: 0, commentDue: 0 };
        map.set(t.id, r);
      }
      return r;
    };
    for (const s of sessions) {
      if (!s.teacher || s.status === "cancelled" || s.date > today) continue;
      const r = get(s.teacher);
      r.taught++;
      if (isLateLog(s)) r.late++;
      if (isOverdueLog(s, now)) r.missing++;
      if (isUnmarked(s)) r.unmarked++;
    }
    // Buổi còn học viên có mặt chưa được nhận xét
    for (const c of commentDueRows(sessions, today)) {
      if (c.teacherId) map.get(c.teacherId)!.commentDue++;
    }
    return [...map.values()];
  }, [sessions]);

  const sort = useSort(
    rows,
    {
      name: (r) => r.name,
      taught: (r) => r.taught,
      late: (r) => r.late,
      missing: (r) => r.missing,
      unmarked: (r) => r.unmarked,
      commentDue: (r) => r.commentDue,
    },
    ["missing", -1],
  );

  const warn = (n: number) => cn(TD, "text-right", n > 0 && "font-semibold text-rose-600");

  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Giáo viên"
        desc={`Trong ${WINDOW_DAYS} ngày: chấm công trễ quá ${LOG_GRACE_HOURS} giờ, buổi đang thiếu công, buổi chưa điểm danh; buổi ${COMMENT_DAYS} ngày qua còn học viên chưa được nhận xét.`}
      />
      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="name" {...sort}>Giáo viên</Th>
                <Th k="taught" {...sort} align="right">Buổi đã dạy</Th>
                <Th k="late" {...sort} align="right">Chấm công trễ</Th>
                <Th k="missing" {...sort} align="right">Đang thiếu công</Th>
                <Th k="unmarked" {...sort} align="right">Chưa điểm danh</Th>
                <Th k="commentDue" {...sort} align="right">Buổi chưa nhận xét</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sort.sorted.length === 0 ? (
                <EmptyRow cols={6}>Chưa có buổi dạy nào trong {WINDOW_DAYS} ngày.</EmptyRow>
              ) : (
                sort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={cn(TD, "font-semibold")}>{r.name}</td>
                    <td className={cn(TD, "text-right")}>{r.taught}</td>
                    <td className={warn(r.late)}>{r.late}</td>
                    <td className={warn(r.missing)}>{r.missing}</td>
                    <td className={warn(r.unmarked)}>{r.unmarked}</td>
                    <td className={warn(r.commentDue)}>{r.commentDue}</td>
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
