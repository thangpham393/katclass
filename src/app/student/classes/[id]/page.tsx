"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import {
  fetchClass,
  fetchClassSessions,
  formatSchedules,
  todayISO,
  ATTENDANCE_LABELS,
  WEEKDAY_LABELS,
  LEVEL_LABELS,
  type AttendanceStatus,
} from "@/lib/db";
import {
  fetchHomeworksForStudent,
  fetchSessionLessonsBySessions,
  type SessionLessonRow,
} from "@/lib/db-content";
import { fetchMyAttendance } from "@/lib/db-student";
import { pct } from "@/lib/utils";

const ATTENDANCE_BADGE: Record<AttendanceStatus, "jade" | "gold" | "destructive" | "default"> = {
  present: "jade",
  absent_excused: "gold",
  absent_unexcused: "destructive",
  makeup: "default",
};

export default function StudentClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = params.id;
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const cls = useLoad(() => fetchClass(classId), [classId]);
  const sessions = useLoad(() => fetchClassSessions(classId), [classId]);
  const attendance = useLoad(
    () => (studentId ? fetchMyAttendance(studentId) : Promise.resolve([])),
    [studentId],
  );
  const homeworks = useLoad(
    () => (studentId ? fetchHomeworksForStudent([classId], studentId) : Promise.resolve([])),
    [classId, studentId],
  );

  const sessionIds = (sessions.data ?? []).map((s) => s.id);
  const sessionKey = sessionIds.join(",");
  const sessionLessons = useLoad(
    () => fetchSessionLessonsBySessions(sessionIds),
    [sessionKey],
  );

  const attendanceBySession = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; note: string | null }>();
    for (const a of attendance.data ?? []) {
      if (a.session) map.set(a.session.id, { status: a.status, note: a.note });
    }
    return map;
  }, [attendance.data]);

  const lessonsBySession = useMemo(() => {
    const map = new Map<string, SessionLessonRow[]>();
    for (const sl of sessionLessons.data ?? []) {
      const arr = map.get(sl.session_id) ?? [];
      arr.push(sl);
      map.set(sl.session_id, arr);
    }
    return map;
  }, [sessionLessons.data]);

  if (cls.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (cls.error) return <ErrorNote message={cls.error} />;
  if (!cls.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy lớp học này (hoặc bạn không thuộc lớp)." />
        <Link href="/student/classes" className="text-sm font-semibold text-brand-600">← Lớp của tôi</Link>
      </div>
    );
  }

  const c = cls.data;
  const today = todayISO();
  const all = sessions.data ?? [];
  const completed = all.filter((s) => s.status === "completed");
  const upcoming = all.filter((s) => s.status === "scheduled" && s.date >= today);
  const past = all
    .filter((s) => s.status === "completed" || (s.date < today && s.status !== "cancelled"))
    .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time));

  const myMarked = all.filter((s) => attendanceBySession.has(s.id));
  const myAttended = myMarked.filter(
    (s) => ["present", "makeup"].includes(attendanceBySession.get(s.id)!.status),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/student/classes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Lớp của tôi
      </Link>

      {/* Header lớp */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
          {c.course?.level && (
            <Badge variant="gold">{LEVEL_LABELS[c.course.level] ?? c.course.level}</Badge>
          )}
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{c.name}</h1>
          {c.course && <div className="mt-0.5 text-sm text-white/85">{c.course.name}</div>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {formatSchedules(c.class_schedules)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> GV: {c.teacher?.name ?? "Chưa phân công"}
            </span>
          </div>
        </div>
        <CardContent className="grid grid-cols-3 divide-x p-0 text-center">
          <div className="p-4">
            <div className="text-2xl font-extrabold">
              {completed.length}
              {c.course?.total_sessions ? (
                <span className="text-sm font-semibold text-muted-foreground">/{c.course.total_sessions}</span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">Buổi đã học</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-extrabold">{upcoming.length}</div>
            <div className="text-xs text-muted-foreground">Buổi sắp tới</div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-extrabold">
              {myMarked.length ? `${pct(myAttended.length, myMarked.length)}%` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Chuyên cần của tôi</div>
          </div>
        </CardContent>
      </Card>

      {/* Bài tập của lớp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-600" /> Bài tập của lớp
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {homeworks.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : (homeworks.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Giáo viên chưa giao bài tập nào.
            </div>
          ) : (
            <div className="space-y-2">
              {homeworks.data!.map((h) => {
                const sub = h.submissions[0];
                return (
                  <Link
                    key={h.id}
                    href={`/student/homework/${h.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-brand-300"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{h.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.homework_questions[0]?.count ?? 0} câu
                        {h.due_at && ` · Hạn ${new Date(h.due_at).toLocaleDateString("vi-VN")}`}
                      </div>
                    </div>
                    {sub ? (
                      <Badge variant="jade">Đã nộp · {sub.score ?? "—"} điểm</Badge>
                    ) : (
                      <Badge variant="gold">Chưa làm</Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buổi sắp tới */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-600" /> Buổi học sắp tới
            <Badge variant="muted">{upcoming.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {sessions.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Chưa có buổi nào được xếp lịch.
            </div>
          ) : (
            <div className="divide-y">
              {upcoming.slice(0, 8).map((s) => {
                const d = new Date(s.date + "T00:00:00");
                return (
                  <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-24 shrink-0 font-semibold">
                      {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="text-muted-foreground">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      {s.room && ` · Phòng ${s.room.name}`}
                    </span>
                    <span className="flex-1" />
                    {s.session_no && <Badge variant="muted">Buổi {s.session_no}</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buổi đã diễn ra: điểm danh + nội dung ôn tập */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-brand-600" /> Buổi đã diễn ra & nội dung ôn tập
            <Badge variant="muted">{past.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {sessions.loading || attendance.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : past.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Lớp chưa có buổi học nào diễn ra.
            </div>
          ) : (
            <div className="divide-y">
              {past.map((s) => {
                const d = new Date(s.date + "T00:00:00");
                const att = attendanceBySession.get(s.id);
                const lessons = lessonsBySession.get(s.id) ?? [];
                return (
                  <div key={s.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {s.session_no ? `Buổi ${s.session_no} · ` : ""}
                        {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </span>
                      <span className="flex-1" />
                      {att ? (
                        <Badge variant={ATTENDANCE_BADGE[att.status]}>{ATTENDANCE_LABELS[att.status]}</Badge>
                      ) : (
                        <Badge variant="muted">Chưa điểm danh</Badge>
                      )}
                    </div>
                    {lessons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {lessons.map((sl) => (
                          <Link
                            key={sl.lesson.id}
                            href={`/student/lessons/${sl.lesson.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            <BookOpen className="h-3 w-3" />
                            {sl.lesson.unit ? `Bài ${sl.lesson.unit}: ` : ""}
                            {sl.lesson.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
