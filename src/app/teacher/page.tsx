"use client";

import Link from "next/link";
import {
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  School,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchTeacherClasses,
  fetchTeacherSessions,
  formatSchedules,
  todayISO,
  LEVEL_LABELS,
  WEEKDAY_LABELS,
  type SessionRow,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function TeacherHome() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";

  const classes = useLoad(
    () => (teacherId ? fetchTeacherClasses(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  const todaySessions = useLoad(
    () => (teacherId ? fetchTeacherSessions(teacherId, todayISO(), todayISO()) : Promise.resolve([])),
    [teacherId],
  );
  const weekSessions = useLoad(
    () => (teacherId ? fetchTeacherSessions(teacherId, todayISO(1), todayISO(7)) : Promise.resolve([])),
    [teacherId],
  );

  const totalStudents = (classes.data ?? []).reduce(
    (sum, c) => sum + (c.class_students?.[0]?.count ?? 0),
    0,
  );
  const pendingToday = (todaySessions.data ?? []).filter((s) => s.status === "scheduled").length;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Xin chào <span className="text-gradient-brand">{user?.name?.split(" ").pop() ?? "cô/thầy"}</span> 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Hôm nay là{" "}
            <span className="font-semibold">
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            {pendingToday > 0
              ? ` — có ${pendingToday} buổi dạy chưa điểm danh.`
              : " — không còn buổi nào chờ điểm danh."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Lớp phụ trách" value={classes.data?.length ?? "…"} icon={GraduationCap} accent="brand" />
        <StatCard label="Học viên các lớp" value={classes.loading ? "…" : totalStudents} icon={Users} accent="gold" />
        <StatCard label="Buổi dạy hôm nay" value={todaySessions.data?.length ?? "…"} icon={CalendarDays} accent="sky" />
        <StatCard label="Buổi 7 ngày tới" value={weekSessions.data?.length ?? "…"} icon={CalendarClock} accent="jade" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" /> Buổi dạy hôm nay
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              {todaySessions.loading ? (
                <LoadingRows rows={2} className="p-0" />
              ) : todaySessions.error ? (
                <ErrorNote message={todaySessions.error} />
              ) : (todaySessions.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Hôm nay không có buổi dạy nào. 休息一下吧 ☕
                </div>
              ) : (
                todaySessions.data!.map((s) => <SessionRowItem key={s.id} session={s} highlight />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-brand-600" /> Buổi dạy 7 ngày tới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              {weekSessions.loading ? (
                <LoadingRows rows={2} className="p-0" />
              ) : (weekSessions.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có buổi nào — nhờ quản lý sinh buổi học từ lịch tuần của lớp.
                </div>
              ) : (
                weekSessions.data!.map((s) => <SessionRowItem key={s.id} session={s} />)
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <School className="h-4 w-4 text-brand-600" /> Lớp phụ trách
              </CardTitle>
              <Link href="/teacher/classes" className="text-xs font-semibold text-brand-600">
                Xem tất cả
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
              {classes.loading ? (
                <LoadingRows rows={3} className="p-0" />
              ) : classes.error ? (
                <ErrorNote message={classes.error} />
              ) : (classes.data?.length ?? 0) === 0 ? (
                <Empty
                  icon={School}
                  title="Chưa có lớp"
                  description="Bạn chưa được phân công lớp nào. Liên hệ quản lý trung tâm."
                  className="p-8"
                />
              ) : (
                classes.data!.map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/classes/${c.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-brand-50/50"
                  >
                    <div className="zh grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">
                      {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {formatSchedules(c.class_schedules)} · {c.class_students?.[0]?.count ?? 0} HV
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SessionRowItem({ session: s, highlight }: { session: SessionRow; highlight?: boolean }) {
  const d = new Date(s.date + "T00:00:00");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3.5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-center leading-none">
        <div>
          <div className="text-[10px] font-semibold uppercase text-brand-500">{WEEKDAY_LABELS[d.getDay()]}</div>
          <div className="text-sm font-extrabold text-brand-700">{d.getDate()}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{s.class?.name ?? "Lớp?"}</div>
        <div className="text-xs text-muted-foreground">
          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
          {s.room ? ` · Phòng ${s.room.name}` : ""}
          {s.session_no ? ` · Buổi ${s.session_no}` : ""}
          {s.type === "makeup" ? " · Buổi bù" : ""}
        </div>
      </div>
      {s.status === "completed" ? (
        <Badge variant="jade">Đã điểm danh</Badge>
      ) : (
        highlight && <Badge variant="gold">Chưa điểm danh</Badge>
      )}
      <Link href={`/teacher/sessions/${s.id}`}>
        <Button size="sm" variant={highlight && s.status === "scheduled" ? "default" : "outline"}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Điểm danh
        </Button>
      </Link>
    </div>
  );
}
