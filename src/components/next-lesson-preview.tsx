"use client";

import Link from "next/link";
import { BookOpen, CalendarClock, ClipboardList, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { todayISO, WEEKDAY_LABELS } from "@/lib/db";
import { fetchNextLessonPreviews, fetchSessionLessonsBySessions } from "@/lib/db-content";

/** Buổi tối thiểu cần để hiện phần xem trước (UpcomingSessionRow / SessionRow đều dùng được). */
export interface PreviewSession {
  id: string;
  class_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  session_no?: number | null;
  class?: { id: string; name: string } | null;
}

/**
 * CHUẨN BỊ CHO BUỔI HỌC TỚI (0066) — mỗi lớp lấy buổi sắp tới gần nhất, hiện
 * bài học GV đã gán cho buổi (bấm vào xem trước từ vựng / ngữ pháp), nội dung
 * GV dự kiến dạy (ghi lúc chốt buổi trước) và BTVN cần làm xong trước buổi.
 */
export function NextLessonPreview({
  sessions,
  showClassName = true,
}: {
  /** Buổi sắp tới, đã sắp theo thời gian. */
  sessions: PreviewSession[];
  showClassName?: boolean;
}) {
  const today = todayISO();
  const next: PreviewSession[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    if (!s.class_id || s.date < today || seen.has(s.class_id)) continue;
    seen.add(s.class_id);
    next.push(s);
  }
  const key = next.map((s) => s.id).join(",");

  const lessons = useLoad(() => fetchSessionLessonsBySessions(next.map((s) => s.id)), [key]);
  const previews = useLoad(() => fetchNextLessonPreviews(next.map((s) => s.class_id!)), [key]);

  if (!next.length) return null;

  const items = next.map((s) => {
    const p = previews.data?.find((x) => x.class_id === s.class_id && x.logged_date < s.date);
    return {
      session: s,
      lessons: (lessons.data ?? []).filter((l) => l.session_id === s.id),
      nextPlan: p?.next_plan?.trim() || null,
      homework: p?.homework_note?.trim() || null,
    };
  });
  const hasContent = items.some((i) => i.lessons.length || i.nextPlan || i.homework);
  const loading = lessons.loading || previews.loading;
  if (!loading && !hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gold-500" /> Chuẩn bị cho buổi học tới
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : (
          items
            .filter((i) => i.lessons.length || i.nextPlan || i.homework)
            .map(({ session: s, lessons: ls, nextPlan, homework }) => {
              const d = new Date(s.date + "T00:00:00");
              return (
                <div key={s.id} className="rounded-xl border bg-gradient-to-br from-brand-50/50 to-gold-50/50 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <CalendarClock className="h-4 w-4 text-brand-600" />
                    {showClassName && <span className="font-semibold">{s.class?.name ?? "Lớp học"}</span>}
                    <span className="text-muted-foreground">
                      {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")} · {s.start_time.slice(0, 5)}
                    </span>
                    {s.date === today && <Badge variant="gold">Hôm nay</Badge>}
                    {s.session_no ? <Badge variant="muted">Buổi {s.session_no}</Badge> : null}
                  </div>

                  {nextPlan && (
                    <p className="mt-2 whitespace-pre-line text-sm">
                      <span className="font-semibold text-brand-700">Buổi tới sẽ học:</span> {nextPlan}
                    </p>
                  )}

                  {ls.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">
                        Xem trước từ vựng & ngữ pháp:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ls.map((sl) => (
                          <Link
                            key={sl.lesson.id}
                            href={`/student/lessons/${sl.lesson.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-card px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            <BookOpen className="h-3 w-3" />
                            {sl.lesson.unit ? `Bài ${sl.lesson.unit}: ` : ""}
                            {sl.lesson.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {homework && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-semibold text-foreground">BTVN buổi trước:</span> {homework}
                      </span>
                    </p>
                  )}
                </div>
              );
            })
        )}
      </CardContent>
    </Card>
  );
}
