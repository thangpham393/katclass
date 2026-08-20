"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, MessageSquareText, Sparkles, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { ATTENDANCE_LABELS, WEEKDAY_LABELS, type AttendanceStatus } from "@/lib/db";
import {
  ACTIVITY_LABELS,
  POINT_REASON_LABELS,
  fetchLatestReportedSession,
  fetchSessionReport,
} from "@/lib/db-classroom";
import { useLoad } from "@/lib/use-load";

/**
 * Nhật ký một buổi học của một học viên: học bài gì, được mấy sao vì việc gì,
 * nhận xét của giáo viên và bài tập về nhà. Dùng chung cho khu học viên
 * (`/student/sessions/[id]`) và cổng phụ huynh (RLS tự lọc theo con).
 */
export function SessionReportView({
  sessionId,
  studentId,
  forParent,
  studentName,
}: {
  sessionId: string;
  studentId: string;
  forParent?: boolean;
  studentName?: string;
}) {
  const report = useLoad(() => fetchSessionReport(sessionId, studentId), [sessionId, studentId]);

  if (report.loading) return <Card><LoadingRows rows={4} /></Card>;
  if (report.error) return <ErrorNote message={report.error} />;
  if (!report.data) return <ErrorNote message="Không xem được buổi học này." />;

  const r = report.data;
  const d = new Date(r.session.date + "T00:00:00");
  const total = r.points.reduce((sum, p) => sum + p.points, 0);
  const who = forParent ? (studentName ?? "Con") : "Em";

  // Gộp số lần theo lý do để kể "làm được gì" thay vì chỉ một con số
  const byReason = r.points.reduce<Record<string, number>>((acc, p) => {
    acc[p.reason] = (acc[p.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-brand p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Nhật ký buổi học</div>
        <div className="mt-1 text-xl font-extrabold">
          {r.session.class?.name ?? "Buổi học bù"} · {WEEKDAY_LABELS[d.getDay()]}{" "}
          {d.toLocaleDateString("vi-VN")}
        </div>
        <div className="mt-1 text-sm opacity-90">
          {r.session.start_time.slice(0, 5)}–{r.session.end_time.slice(0, 5)}
          {r.session.teacher ? ` · GV ${r.session.teacher.name}` : ""}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {r.attendance && (
            <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold">
              {ATTENDANCE_LABELS[r.attendance.status as AttendanceStatus] ?? r.attendance.status}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold">
            <Star className="h-3.5 w-3.5 fill-white" /> {total} sao trong buổi
          </span>
        </div>
      </div>

      {r.lessonContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-600" /> Hôm nay học gì
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-sm">
            <p className="whitespace-pre-line">{r.lessonContent}</p>
            {r.lessons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={`/student/lessons/${l.id}`}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    {l.unit != null ? `Bài ${l.unit} — ` : ""}
                    {l.title} {l.title_zh ? <span className="zh">{l.title_zh}</span> : null} · ôn lại
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(r.points.length > 0 || r.activities.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold-600" /> {who} đã tham gia thế nào
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {r.points.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byReason).map(([reason, count]) => (
                  <span
                    key={reason}
                    className="rounded-lg bg-gold-50 px-3 py-1.5 text-xs font-semibold text-gold-800"
                  >
                    {POINT_REASON_LABELS[reason as keyof typeof POINT_REASON_LABELS] ?? reason} ×{count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Buổi này chưa ghi nhận điểm tương tác.</p>
            )}
            {r.activities.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Hoạt động trong giờ:{" "}
                {r.activities
                  .map((a) => a.title || ACTIVITY_LABELS[a.kind])
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .join(" · ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {r.comment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-brand-600" /> Nhận xét của giáo viên
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-start gap-3">
              {r.session.teacher && (
                <Avatar name={r.session.teacher.name} src={r.session.teacher.avatar ?? undefined} size={36} />
              )}
              <div className="min-w-0 flex-1">
                {r.comment.rating != null && (
                  <div className="mb-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4",
                          i <= r.comment!.rating! ? "fill-gold-500 text-gold-500" : "text-muted-foreground",
                        )}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm">{r.comment.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gold-600" /> Bài tập về nhà
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {r.homeworks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Buổi này không giao bài tập.</p>
          ) : (
            <div className="space-y-2">
              {r.homeworks.map((hw) => (
                <div key={hw.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{hw.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {hw.due_at
                        ? `Hạn nộp ${new Date(hw.due_at).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Không giới hạn thời gian"}
                    </div>
                  </div>
                  {hw.kind === "test" && <Badge variant="gold">Kiểm tra</Badge>}
                  {!forParent && (
                    <Link
                      href={`/student/homework/${hw.id}`}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Làm bài
                    </Link>
                  )}
                </div>
              ))}
              {forParent && (
                <p className="text-xs text-muted-foreground">
                  Nhắc con đăng nhập vào khu học viên để làm bài đúng hạn.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Nhật ký buổi học GẦN NHẤT đã được giáo viên chốt — thẻ đặt ở trang chủ học
 * viên và cổng phụ huynh ("hôm nay con học thế nào"). Chưa có buổi nào chốt
 * thì không hiện gì.
 */
export function LatestSessionReport({
  studentId,
  forParent,
  studentName,
}: {
  studentId: string;
  forParent?: boolean;
  studentName?: string;
}) {
  const latest = useLoad(
    () => (studentId ? fetchLatestReportedSession(studentId) : Promise.resolve(null)),
    [studentId],
  );

  if (latest.loading || !latest.data) return null;
  return (
    <SessionReportView
      sessionId={latest.data}
      studentId={studentId}
      forParent={forParent}
      studentName={studentName}
    />
  );
}
