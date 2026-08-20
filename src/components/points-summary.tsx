"use client";

import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/loading";
import { earnedBadges, fetchPointsSummary } from "@/lib/db-classroom";
import { useLoad } from "@/lib/use-load";

/**
 * Sao tích luỹ + huy hiệu của học viên (điểm giáo viên cộng trong giờ học).
 * Ẩn hẳn nếu chưa có điểm nào — lớp chưa dùng chế độ lớp học trực tiếp thì
 * trang chủ không mọc thêm thẻ trống.
 */
export function PointsSummaryCard({
  studentId,
  forParent,
  studentName,
  attendanceRate,
}: {
  studentId: string;
  forParent?: boolean;
  studentName?: string;
  attendanceRate?: number;
}) {
  const summary = useLoad(() => fetchPointsSummary(studentId), [studentId]);

  if (summary.loading) return <Card><LoadingRows rows={2} /></Card>;
  if (!summary.data || summary.data.total === 0) return null;

  const s = summary.data;
  const badges = earnedBadges(s, attendanceRate);
  const who = forParent ? (studentName ?? "Con") : "Em";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-gold-500 text-gold-500" /> Sao tích luỹ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-gold-50 p-3">
            <div className="text-2xl font-extrabold text-gold-700">{s.total}</div>
            <div className="text-xs font-medium text-gold-800">tổng ★</div>
          </div>
          <div className="rounded-xl bg-brand-50 p-3">
            <div className="text-2xl font-extrabold text-brand-700">{s.month}</div>
            <div className="text-xs font-medium text-brand-800">★ tháng này</div>
          </div>
          <div className="rounded-xl bg-secondary p-3">
            <div className="text-2xl font-extrabold">{s.sessions}</div>
            <div className="text-xs font-medium text-muted-foreground">buổi có điểm</div>
          </div>
        </div>

        {badges.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Huy hiệu 30 ngày qua
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span
                  key={b.key}
                  className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm"
                  title={b.hint}
                >
                  <span className="text-base">{b.emoji}</span> {b.label}
                  <span className="font-normal text-muted-foreground">· {b.hint}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {who} tích ★ bằng cách phát biểu, trả lời đúng và tham gia hoạt động trong giờ —
            đủ mốc là có huy hiệu.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
