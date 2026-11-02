"use client";

import { useState } from "react";
import { BookOpen, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { WEEKDAY_LABELS } from "@/lib/db";
import { fetchSessionLessonsBySessions } from "@/lib/db-content";
import { fetchClassLessonLog } from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";

/** Số buổi hiện trước khi bấm "Xem thêm". */
const PAGE = 5;

/**
 * NỘI DUNG ĐÃ DẠY — những gì GV ghi lúc chấm công từng buổi (nội dung bài +
 * ghi chú) kèm bài ôn tập đã gắn, mới nhất trước. Để GV dạy thay và hành
 * chính biết lớp đã học tới đâu mà không phải hỏi GV buổi trước.
 *
 * `before` → chỉ các buổi trước ngày đó (trang điểm danh của một buổi).
 */
export function ClassLessonLog({
  classId,
  before,
  title = "Nội dung đã dạy",
  pageSize = PAGE,
}: {
  classId: string;
  before?: string;
  title?: string;
  pageSize?: number;
}) {
  const [shown, setShown] = useState(pageSize);
  const logs = useLoad(() => fetchClassLessonLog(classId, { before }), [classId, before]);
  const ids = (logs.data ?? []).map((s) => s.id);
  const lessons = useLoad(() => fetchSessionLessonsBySessions(ids), [ids.join(",")]);

  const rows = logs.data ?? [];
  const visible = rows.slice(0, shown);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-brand-600" /> {title}
          <Badge variant="muted">{rows.length}</Badge>
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Giáo viên ghi lúc chấm công ca dạy — xem để nắm lớp đã học tới đâu trước khi vào dạy.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {logs.error ? (
          <ErrorNote message={logs.error} />
        ) : logs.loading ? (
          <LoadingRows rows={3} className="p-0" />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có buổi nào được chấm công kèm nội dung bài.
          </div>
        ) : (
          <>
            <div className="divide-y">
              {visible.map((s) => {
                const log = Array.isArray(s.teaching_log) ? s.teaching_log[0] : s.teaching_log;
                const d = new Date(s.date + "T00:00:00");
                const linked = (lessons.data ?? []).filter((l) => l.session_id === s.id && l.lesson);
                return (
                  <div key={s.id} className="space-y-1.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {s.session_no && <Badge variant="muted">Buổi {s.session_no}</Badge>}
                      <span className="font-semibold text-foreground">
                        {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
                      </span>
                      <span>{s.start_time.slice(0, 5)}</span>
                      {s.teacher && <span>· GV {s.teacher.name}</span>}
                    </div>
                    <div className="whitespace-pre-line">
                      {log?.lesson_content?.trim() || (
                        <span className="italic text-muted-foreground">Không ghi nội dung bài.</span>
                      )}
                    </div>
                    {log?.note?.trim() && (
                      <div className="whitespace-pre-line rounded-md bg-gold-50 px-2.5 py-1.5 text-xs text-gold-800">
                        Ghi chú: {log.note}
                      </div>
                    )}
                    {linked.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {linked.map((l) => (
                          <Badge key={l.lesson!.id} variant="outline">
                            <BookOpen className="h-3 w-3" />
                            {l.lesson!.unit ? `Bài ${l.lesson!.unit}: ` : ""}
                            {l.lesson!.title}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {rows.length > shown && (
              <button
                className="mt-2 text-sm font-semibold text-brand-600"
                onClick={() => setShown((n) => n + 10)}
              >
                Xem thêm {Math.min(10, rows.length - shown)} buổi trước
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
