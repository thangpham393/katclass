"use client";

import Link from "next/link";
import { Calendar, CheckCircle2, ClipboardList, Clock, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { fetchHomeworksForStudent } from "@/lib/db-content";
import { fetchMyClasses } from "@/lib/db-student";

export default function StudentHomeworkPage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const classes = useLoad(
    () => (studentId ? fetchMyClasses(studentId) : Promise.resolve([])),
    [studentId],
  );
  const classIds = (classes.data ?? []).map((c) => c.class_id);
  const classKey = classIds.join(",");
  const homeworks = useLoad(
    () =>
      studentId && classes.data
        ? fetchHomeworksForStudent(classIds, studentId)
        : Promise.resolve([]),
    [studentId, classKey, !!classes.data],
  );

  const loading = classes.loading || homeworks.loading;
  const list = homeworks.data ?? [];
  const active = list.filter((h) => h.submissions.length === 0);
  const done = list.filter((h) => h.submissions.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Bài tập về nhà</h1>
        <p className="mt-1 text-muted-foreground">
          Bài trắc nghiệm được hệ thống chấm ngay khi nộp.
        </p>
      </div>

      {(classes.error || homeworks.error) && (
        <ErrorNote message={classes.error ?? homeworks.error ?? ""} />
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Đang chờ ({active.length})
        </h2>
        {loading ? (
          <Card><LoadingRows rows={3} /></Card>
        ) : active.length === 0 ? (
          <Empty icon={CheckCircle2} title="Tuyệt vời!" description="Bạn đã hoàn thành mọi bài tập được giao." />
        ) : (
          <div className="grid gap-3">
            {active.map((h) => {
              const overdue = h.due_at ? new Date(h.due_at) < new Date() : false;
              return (
                <Card key={h.id} className="card-hover">
                  <CardContent className="flex flex-wrap items-center gap-4 p-5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{h.title}</h3>
                        {h.kind === "test" && (
                          <Badge variant="destructive">
                            <Timer className="h-3 w-3" /> Kiểm tra · {h.time_limit_minutes} phút
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{h.class?.name}</span>
                        {/* Đề bài kiểm tra chưa bắt đầu bị RLS giấu → số câu = 0, không hiển thị */}
                        {(h.kind !== "test" || (h.homework_questions[0]?.count ?? 0) > 0) && (
                          <span className="text-muted-foreground">· {h.homework_questions[0]?.count ?? 0} câu</span>
                        )}
                        {h.kind === "test" && h.open_at && new Date(h.open_at) > new Date() && (
                          <span className="font-semibold text-gold-700">
                            Mở đề {new Date(h.open_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )}
                        {h.due_at && (
                          <span className={overdue ? "font-semibold text-rose-600" : "text-muted-foreground"}>
                            <Calendar className="mr-1 inline h-3 w-3" />
                            {h.kind === "test" ? "Hạn vào làm" : "Hạn"}{" "}
                            {new Date(h.due_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/student/homework/${h.id}`}>
                      <Button>{h.kind === "test" ? "Vào làm" : "Làm bài"}</Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" /> Đã nộp ({done.length})
        </h2>
        {loading ? (
          <Card><LoadingRows rows={2} /></Card>
        ) : done.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Chưa có bài nào được nộp.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {done.map((h) => {
              const sub = h.submissions[0];
              return (
                <Link key={h.id} href={`/student/homework/${h.id}`}>
                  <Card className="card-hover h-full bg-muted/30">
                    <CardContent className="flex items-center justify-between gap-3 p-5">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{h.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {h.class?.name} · Nộp{" "}
                          {sub ? new Date(sub.submitted_at).toLocaleDateString("vi-VN") : "—"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-extrabold text-emerald-600">
                          {sub?.score ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">/ 10</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!loading && list.length === 0 && (
        <Badge variant="muted">Giáo viên chưa giao bài tập nào cho lớp của bạn.</Badge>
      )}
    </div>
  );
}
