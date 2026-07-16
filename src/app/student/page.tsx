"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  School,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { PackageSummaryCard } from "@/components/package-summary";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { fetchStudentAttendanceSummary, WEEKDAY_LABELS } from "@/lib/db";
import { fetchHomeworksForStudent } from "@/lib/db-content";
import {
  fetchMyClasses,
  fetchMyComments,
  fetchMyUpcomingSessions,
} from "@/lib/db-student";
import { pct } from "@/lib/utils";

export default function StudentHome() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const classes = useLoad(
    () => (studentId ? fetchMyClasses(studentId) : Promise.resolve([])),
    [studentId],
  );
  const classIds = (classes.data ?? [])
    .filter((c) => c.class && c.class.status !== "cancelled")
    .map((c) => c.class_id);
  const classKey = classIds.join(",");

  const upcoming = useLoad(
    () =>
      studentId && classes.data
        ? fetchMyUpcomingSessions(studentId, classIds, 14)
        : Promise.resolve([]),
    [studentId, classKey, !!classes.data],
  );
  const homeworks = useLoad(
    () =>
      studentId && classes.data
        ? fetchHomeworksForStudent(classIds, studentId)
        : Promise.resolve([]),
    [studentId, classKey, !!classes.data],
  );
  const summary = useLoad(
    () =>
      studentId
        ? fetchStudentAttendanceSummary(studentId)
        : Promise.resolve({ total: 0, byStatus: { present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0 } }),
    [studentId],
  );
  const comments = useLoad(
    () => (studentId ? fetchMyComments(studentId, 3) : Promise.resolve([])),
    [studentId],
  );

  const activeClasses = (classes.data ?? []).filter((c) => c.class?.status === "active");
  const pendingHw = (homeworks.data ?? []).filter((h) => h.submissions.length === 0);
  const attended = (summary.data?.byStatus.present ?? 0) + (summary.data?.byStatus.makeup ?? 0);
  const attendancePct = summary.data && summary.data.total > 0 ? pct(attended, summary.data.total) : null;
  const firstName = (user?.name ?? "").trim().split(" ").slice(-1)[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-gold-500 p-6 text-white shadow-soft md:p-8">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <Badge variant="gold" className="border-white/0 bg-white/20 text-white">
            <Sparkles className="h-3 w-3" /> 你好, {firstName || "bạn"}!
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold md:text-3xl">
            Sẵn sàng học <span className="zh">中文</span> hôm nay?
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/85">
            {pendingHw.length > 0 ? (
              <>Bạn còn <span className="font-bold">{pendingHw.length}</span> bài tập đang chờ làm.</>
            ) : (
              <>Không còn bài tập nào đang chờ — ôn lại từ vựng để nhớ lâu nhé!</>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/student/homework">
              <Button variant="gold" className="bg-white text-brand-700 hover:bg-white/90">
                <ClipboardList className="h-4 w-4" /> Làm bài tập
              </Button>
            </Link>
            <Link href="/student/flashcard">
              <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                <Sparkles className="h-4 w-4" /> Ôn flashcard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Lớp đang học" value={activeClasses.length} icon={School} accent="brand" />
        <StatCard label="Buổi học 14 ngày tới" value={upcoming.data?.length ?? "—"} icon={CalendarClock} accent="sky" />
        <StatCard label="Bài tập chờ làm" value={pendingHw.length} icon={ClipboardList} accent="gold" />
        <StatCard
          label="Chuyên cần"
          value={attendancePct !== null ? `${attendancePct}%` : "—"}
          icon={CheckCircle2}
          accent="jade"
        />
      </section>

      {/* Gói buổi còn lại (chỉ hiện khi đã mua gói) */}
      {studentId && <PackageSummaryCard studentId={studentId} />}

      {classes.error && <ErrorNote message={classes.error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lịch học sắp tới */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-600" /> Lịch học sắp tới
            </CardTitle>
            <Link href="/student/classes" className="text-xs font-semibold text-brand-600 hover:underline">
              Lớp của tôi →
            </Link>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {upcoming.loading || classes.loading ? (
              <LoadingRows rows={4} className="p-0" />
            ) : (upcoming.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có buổi học nào trong 14 ngày tới.
              </div>
            ) : (
              <div className="divide-y">
                {upcoming.data!.slice(0, 6).map((s) => {
                  const d = new Date(s.date + "T00:00:00");
                  const isToday = s.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand-50 py-1.5 text-brand-700">
                        <span className="text-[10px] font-bold uppercase">{WEEKDAY_LABELS[d.getDay()]}</span>
                        <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                        <span className="text-[10px]">Th{d.getMonth() + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{s.class?.name ?? "Lớp học"}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          {s.room && ` · Phòng ${s.room.name}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isToday && <Badge variant="gold">Hôm nay</Badge>}
                        {s.isMakeupForMe && <Badge variant="jade">Học bù</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bài tập chờ làm */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand-600" /> Bài tập chờ làm
            </CardTitle>
            <Link href="/student/homework" className="text-xs font-semibold text-brand-600 hover:underline">
              Xem tất cả →
            </Link>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {homeworks.loading || classes.loading ? (
              <LoadingRows rows={3} className="p-0" />
            ) : pendingHw.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tuyệt vời — bạn đã làm hết bài tập! 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {pendingHw.slice(0, 5).map((h) => {
                  const overdue = h.due_at ? new Date(h.due_at) < new Date() : false;
                  return (
                    <Link
                      key={h.id}
                      href={`/student/homework/${h.id}`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-brand-300 hover:shadow-sm"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{h.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {h.class?.name}
                          {h.due_at && (
                            <span className={overdue ? "font-semibold text-rose-600" : ""}>
                              {" "}· Hạn {new Date(h.due_at).toLocaleDateString("vi-VN")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nhận xét mới nhất của giáo viên */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-brand-600" /> Nhận xét gần đây từ giáo viên
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {comments.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : (comments.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có nhận xét nào — nhận xét của giáo viên sau mỗi buổi học sẽ hiện ở đây.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {comments.data!.map((c) => (
                <div key={c.id} className="rounded-xl border bg-gradient-to-br from-brand-50/60 to-gold-50/60 p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.teacher?.name ?? "Giáo viên"}</span>
                    <span>
                      {c.session?.date
                        ? new Date(c.session.date + "T00:00:00").toLocaleDateString("vi-VN")
                        : ""}
                    </span>
                  </div>
                  {c.rating ? (
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${n <= (c.rating ?? 0) ? "fill-gold-500 text-gold-500" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed">{c.content}</p>
                  <div className="mt-2 text-xs text-muted-foreground">{c.session?.class?.name}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lối tắt thư viện */}
      <Link
        href="/student/library"
        className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:border-brand-300 hover:shadow-sm"
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 text-brand-600">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold">Thư viện bài học</div>
          <div className="text-xs text-muted-foreground">Xem lại nội dung, từ vựng và ngữ pháp các bài đã học</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </div>
  );
}
