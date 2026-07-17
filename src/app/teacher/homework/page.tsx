"use client";

import Link from "next/link";
import { Calendar, ClipboardList, Plus, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { fetchHomeworks } from "@/lib/db-content";

export default function TeacherHomeworkPage() {
  const homeworks = useLoad(fetchHomeworks);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bài tập đã giao</h1>
          <p className="mt-1 text-muted-foreground">
            Hệ thống tự chấm khi học viên nộp — theo dõi tỷ lệ nộp và điểm tại đây.
          </p>
        </div>
        <Link href="/teacher/homework/new">
          <Button><Plus className="h-4 w-4" /> Giao bài tập mới</Button>
        </Link>
      </div>

      {homeworks.error && <ErrorNote message={homeworks.error} />}

      {homeworks.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : (homeworks.data?.length ?? 0) === 0 ? (
        <Empty
          icon={ClipboardList}
          title="Chưa giao bài tập nào"
          description="Tạo câu hỏi ở Ngân hàng câu hỏi, rồi bấm “Giao bài tập mới”."
        />
      ) : (
        <div className="grid gap-3">
          {homeworks.data!.map((h) => {
            const total = h.class?.class_students[0]?.count ?? 0;
            const submitted = h.submissions.length;
            const scores = h.submissions.map((s) => s.score).filter((s): s is number => s != null);
            const avg = scores.length
              ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
              : null;
            const overdue = h.due_at ? new Date(h.due_at) < new Date() : false;
            return (
              <Link key={h.id} href={`/teacher/homework/${h.id}`}>
                <Card className="card-hover">
                  <CardContent className="flex flex-wrap items-center gap-4 p-5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{h.title}</h3>
                        {h.kind === "test" && (
                          <Badge variant="destructive">
                            <Timer className="h-3 w-3" /> Kiểm tra · {h.time_limit_minutes}′
                          </Badge>
                        )}
                        <Badge variant="outline">{h.homework_questions[0]?.count ?? 0} câu</Badge>
                        {overdue && submitted < total && <Badge variant="gold">Quá hạn</Badge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{h.class?.name}</span>
                        {h.due_at && (
                          <>
                            <span>·</span>
                            <Calendar className="h-3 w-3" />
                            Hạn {new Date(h.due_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-6 text-center">
                      <div>
                        <div className="text-lg font-bold">
                          {submitted}
                          <span className="text-sm font-semibold text-muted-foreground">/{total}</span>
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Đã nộp</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-emerald-600">{avg ?? "—"}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Điểm TB</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
