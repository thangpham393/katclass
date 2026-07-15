"use client";

import { useState } from "react";
import { BarChart3, CalendarX, ClipboardCheck, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { fetchAttendanceStats, ATTENDANCE_LABELS } from "@/lib/db";
import { useLoad } from "@/lib/use-load";
import { pct } from "@/lib/utils";

const RANGE_OPTIONS = [
  { days: 7, label: "7 ngày qua" },
  { days: 30, label: "30 ngày qua" },
  { days: 90, label: "3 tháng qua" },
  { days: 365, label: "12 tháng qua" },
];

export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const stats = useLoad(() => fetchAttendanceStats(days), [days]);

  const s = stats.data;
  const attended = (s?.byStatus.present ?? 0) + (s?.byStatus.makeup ?? 0);
  const attendanceRate = s && s.total > 0 ? `${pct(attended, s.total)}%` : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Báo cáo chuyên cần</h1>
          <p className="mt-1 text-muted-foreground">
            Thống kê điểm danh toàn trung tâm. Doanh thu, học phí sẽ có ở Giai đoạn 2.
          </p>
        </div>
        <Select className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {RANGE_OPTIONS.map((o) => (
            <option key={o.days} value={o.days}>{o.label}</option>
          ))}
        </Select>
      </div>

      {stats.error && <ErrorNote message={stats.error} />}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Lượt điểm danh"
          value={stats.loading ? "…" : s?.total ?? 0}
          icon={ClipboardCheck}
          accent="brand"
        />
        <StatCard
          label="Tỷ lệ chuyên cần"
          value={stats.loading ? "…" : attendanceRate}
          icon={UserCheck}
          accent="jade"
        />
        <StatCard
          label="Vắng có phép"
          value={stats.loading ? "…" : s?.byStatus.absent_excused ?? 0}
          icon={CalendarX}
          accent="gold"
        />
        <StatCard
          label="Vắng không phép"
          value={stats.loading ? "…" : s?.byStatus.absent_unexcused ?? 0}
          icon={UserX}
          accent="sky"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chuyên cần theo lớp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            {stats.loading ? (
              <LoadingRows rows={5} className="p-0" />
            ) : (s?.byClass.length ?? 0) === 0 ? (
              <Empty
                icon={BarChart3}
                title="Chưa có dữ liệu điểm danh"
                description="Khi giáo viên bắt đầu điểm danh các buổi học, thống kê sẽ hiện ở đây."
                className="p-8"
              />
            ) : (
              s!.byClass.slice(0, 15).map((c) => (
                <div key={c.classId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate pr-3 font-medium">{c.className}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {pct(c.attended, c.total)}% · {c.attended}/{c.total} lượt
                    </span>
                  </div>
                  <Progress value={pct(c.attended, c.total)} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Cơ cấu điểm danh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            {stats.loading ? (
              <LoadingRows rows={4} className="p-0" />
            ) : s && s.total > 0 ? (
              (Object.keys(ATTENDANCE_LABELS) as (keyof typeof ATTENDANCE_LABELS)[]).map((k) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{ATTENDANCE_LABELS[k]}</span>
                    <span className="text-muted-foreground">
                      {pct(s.byStatus[k], s.total)}% · {s.byStatus[k]} lượt
                    </span>
                  </div>
                  <Progress value={pct(s.byStatus[k], s.total)} />
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có lượt điểm danh nào trong khoảng thời gian này.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
