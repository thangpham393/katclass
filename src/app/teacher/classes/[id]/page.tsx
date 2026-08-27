"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, ListChecks } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchClass,
  fetchClassStudents,
  fetchClassSessions,
  formatSchedules,
  todayISO,
  LEVEL_LABELS,
  SESSION_STATUS_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/db";
import { fetchParticipation } from "@/lib/db-classroom";
import { useLoad } from "@/lib/use-load";
import { EnterClassroomButton } from "@/components/classroom/warp-transition";

export default function TeacherClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = params.id;

  const cls = useLoad(() => fetchClass(classId), [classId]);
  const students = useLoad(() => fetchClassStudents(classId), [classId]);
  const sessions = useLoad(() => fetchClassSessions(classId), [classId]);

  // Mức tham gia trong lớp 30 ngày qua (điểm ★ giáo viên cộng trong giờ)
  const recentSessionIds = (sessions.data ?? [])
    .filter((x) => x.date >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
    .map((x) => x.id);
  const participation = useLoad(
    () => fetchParticipation(recentSessionIds),
    [recentSessionIds.join(",")],
  );

  if (cls.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (cls.error) return <ErrorNote message={cls.error} />;
  if (!cls.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy lớp này (hoặc bạn không phụ trách lớp)." />
        <Link href="/teacher/classes" className="text-sm font-semibold text-brand-600">← Lớp dạy</Link>
      </div>
    );
  }

  const c = cls.data;
  const today = todayISO();
  const list = (sessions.data ?? []).filter((s) => s.status !== "cancelled");
  const upcoming = list.filter((s) => s.date >= today);
  const past = list.filter((s) => s.date < today).reverse();
  const todaySession = list.find((s) => s.date === today && s.status !== "completed");
  // Chỉ gắn nhãn "ít được gọi" khi lớp thực sự có dùng điểm ★ trong giờ
  const hasPoints = Object.keys(participation.data ?? {}).length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/teacher/classes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Lớp dạy
      </Link>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="zh grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 sm:h-14 sm:w-14 sm:text-base">
          {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {c.course?.name ?? "Chưa gắn khóa học"} · {formatSchedules(c.class_schedules)}
          </div>
        </div>
      </div>

      {todaySession && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-brand-800">Buổi học hôm nay</div>
            <div className="text-sm text-brand-700">
              {todaySession.start_time.slice(0, 5)}–{todaySession.end_time.slice(0, 5)}
              {todaySession.room ? ` · Phòng ${todaySession.room.name}` : ""}
              {todaySession.session_no ? ` · Buổi ${todaySession.session_no}` : ""} · điểm danh, trình chiếu,
              hoạt động và chốt buổi trong một màn hình.
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/teacher/sessions/${todaySession.id}/prepare`}>
              <Button size="lg" variant="outline">
                <ListChecks className="h-5 w-5" /> Chuẩn bị bài
              </Button>
            </Link>
            <EnterClassroomButton
              sessionId={todaySession.id}
              size="lg"
              iconClassName="h-5 w-5"
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Buổi sắp tới <Badge variant="muted" className="ml-1">{upcoming.length}</Badge></CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
              {sessions.loading ? (
                <LoadingRows rows={3} className="p-0" />
              ) : upcoming.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có buổi nào sắp tới — nhờ quản lý sinh buổi học từ lịch tuần.
                </div>
              ) : (
                <div className="divide-y">
                  {upcoming.map((s) => <SessionLine key={s.id} s={s} />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buổi đã qua <Badge variant="muted" className="ml-1">{past.length}</Badge></CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
              {past.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có buổi nào đã diễn ra.
                </div>
              ) : (
                <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
                  {past.map((s) => <SessionLine key={s.id} s={s} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>
              Học viên <Badge variant="muted" className="ml-1">{students.data?.length ?? 0}</Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Mức tham gia 30 ngày qua — ★ và số lần phát biểu trong giờ.
            </p>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            {students.loading ? (
              <LoadingRows rows={4} className="p-0" />
            ) : (
              <div className="max-h-[32rem] divide-y overflow-y-auto scrollbar-thin">
                {(students.data ?? []).map((s) => {
                  const p = participation.data?.[s.student_id];
                  const quiet = hasPoints && (p?.speak ?? 0) === 0;
                  return (
                    <div key={s.student_id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={s.student.name} src={s.student.avatar ?? undefined} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{s.student.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p
                            ? `${p.points}★ · phát biểu ${p.speak} lần · ${p.sessions} buổi`
                            : quiet
                              ? "Chưa phát biểu lần nào"
                              : (s.student.phone ?? s.student.email)}
                        </div>
                      </div>
                      {quiet && <Badge variant="gold">Ít được gọi</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionLine({ s }: { s: { id: string; date: string; start_time: string; end_time: string; status: "scheduled" | "completed" | "cancelled"; session_no: number | null; room: { name: string } | null } }) {
  const d = new Date(s.date + "T00:00:00");
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
      <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">
        {s.session_no ? `Buổi ${s.session_no}` : "—"}
      </span>
      <span className="font-medium">
        {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
      </span>
      <span className="text-muted-foreground">
        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
        {s.room ? ` · P.${s.room.name}` : ""}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Badge variant={s.status === "completed" ? "jade" : "gold"}>{SESSION_STATUS_LABELS[s.status]}</Badge>
        <Link href={`/teacher/sessions/${s.id}`}>
          <Button size="sm" variant="outline">
            <ClipboardCheck className="h-3.5 w-3.5" /> {s.status === "completed" ? "Xem" : "Điểm danh"}
          </Button>
        </Link>
      </span>
    </div>
  );
}
