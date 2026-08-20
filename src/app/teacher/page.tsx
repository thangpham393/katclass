"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Presentation,
  School,
  Timer,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { cn } from "@/lib/utils";
import {
  fetchTeacherClasses,
  formatSchedules,
  sessionClassLabel,
  todayISO,
  LEVEL_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/db";
import {
  attendanceCount,
  fetchTeachingSessions,
  payHours,
  pickLog,
  sessionHours,
  type TeachingSessionRow,
} from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";

type DayTab = "yesterday" | "today" | "tomorrow";

const DAY_TABS: { key: DayTab; label: string; offset: number }[] = [
  { key: "yesterday", label: "Hôm qua", offset: -1 },
  { key: "today", label: "Hôm nay", offset: 0 },
  { key: "tomorrow", label: "Ngày mai", offset: 1 },
];

export default function TeacherHome() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const [tab, setTab] = useState<DayTab>("today");
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);

  const classes = useLoad(
    () => (teacherId ? fetchTeacherClasses(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  // Nạp 1 lần cả 3 ngày (hôm qua → ngày mai) rồi lọc ở client
  const sessions = useLoad(
    () =>
      teacherId
        ? fetchTeachingSessions(todayISO(-1), todayISO(1), { teacherId })
        : Promise.resolve([]),
    [teacherId],
  );
  const monthSessions = useLoad(
    () =>
      teacherId
        ? fetchTeachingSessions(todayISO().slice(0, 8) + "01", todayISO(), {
            teacherId,
            completedOnly: true,
          })
        : Promise.resolve([]),
    [teacherId],
  );

  const byDay = useMemo(() => {
    const map: Record<DayTab, TeachingSessionRow[]> = { yesterday: [], today: [], tomorrow: [] };
    for (const t of DAY_TABS) {
      const date = todayISO(t.offset);
      map[t.key] = (sessions.data ?? []).filter((s) => s.date === date);
    }
    return map;
  }, [sessions.data]);

  const today = byDay.today;
  const pendingToday = today.filter((s) => !pickLog(s)).length;
  const monthHours = (monthSessions.data ?? []).reduce((sum, s) => sum + payHours(s), 0);
  const totalStudents = (classes.data ?? []).reduce(
    (sum, c) => sum + (c.class_students?.[0]?.count ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Xin chào <span className="text-gradient-brand">{user?.name?.split(" ").pop() ?? "cô/thầy"}</span> 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Hôm nay là{" "}
          <span className="font-semibold">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          {sessions.loading
            ? "…"
            : pendingToday > 0
              ? ` — còn ${pendingToday} ca dạy chưa chấm công.`
              : today.length > 0
                ? " — đã chấm công đủ các ca hôm nay. ✓"
                : " — hôm nay không có ca dạy nào."}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Ca dạy hôm nay" value={sessions.loading ? "…" : today.length} icon={CalendarDays} accent="brand" />
        <StatCard label="Chưa chấm công" value={sessions.loading ? "…" : pendingToday} icon={Timer} accent="gold" />
        <StatCard
          label="Công tháng này"
          value={monthSessions.loading ? "…" : `${monthSessions.data!.length} công`}
          icon={ClipboardCheck}
          accent="jade"
        />
        <StatCard label="Giờ dạy tháng này" value={monthSessions.loading ? "…" : `${monthHours}h`} icon={Clock} accent="sky" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" /> Ca dạy của tôi
              </CardTitle>
              <div className="flex rounded-lg border bg-secondary/40 p-0.5">
                {DAY_TABS.map((t) => {
                  const count = byDay[t.key].length;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.label}
                      {!sessions.loading && count > 0 && (
                        <span className="ml-1.5 text-[10px] text-brand-600">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              {sessions.loading ? (
                <LoadingRows rows={2} className="p-0" />
              ) : sessions.error ? (
                <ErrorNote message={sessions.error} />
              ) : byDay[tab].length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {tab === "today"
                    ? "Hôm nay không có ca dạy nào. 休息一下吧 ☕"
                    : tab === "yesterday"
                      ? "Hôm qua bạn không có ca dạy nào."
                      : "Ngày mai bạn chưa có ca dạy nào."}
                </div>
              ) : (
                byDay[tab].map((s) => (
                  <TeachingCard
                    key={s.id}
                    session={s}
                    future={tab === "tomorrow"}
                    onLog={() => setLogFor(s)}
                  />
                ))
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-brand-600" /> Học viên các lớp
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3 p-6 pt-0 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {classes.loading ? "…" : `${totalStudents} học viên đang theo học`}
            </CardContent>
          </Card>
        </div>
      </section>

      <TeachingLogModal
        session={logFor}
        currentUserId={teacherId}
        onClose={() => setLogFor(null)}
        onSaved={() => {
          sessions.reload();
          monthSessions.reload();
        }}
      />
    </div>
  );
}

function TeachingCard({
  session: s,
  future,
  onLog,
}: {
  session: TeachingSessionRow;
  future?: boolean;
  onLog: () => void;
}) {
  const log = pickLog(s);
  const d = new Date(s.date + "T00:00:00");
  const marked = attendanceCount(s);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3.5",
        log && "border-emerald-200 bg-emerald-50/40",
      )}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-center leading-none">
        <div>
          <div className="text-[10px] font-semibold uppercase text-brand-500">{WEEKDAY_LABELS[d.getDay()]}</div>
          <div className="text-sm font-extrabold text-brand-700">{d.getDate()}</div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{sessionClassLabel(s)}</div>
        <div className="text-xs text-muted-foreground">
          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
          {s.room ? ` · Phòng ${s.room.name}` : ""}
          {s.session_no ? ` · Buổi ${s.session_no}` : ""}
          {s.type === "makeup" ? " · Buổi bù" : ""}
          {marked > 0 ? ` · điểm danh ${marked} HV` : ""}
        </div>
        {log && (
          <div className="mt-1 text-xs text-emerald-700">
            Thực dạy {log.actual_start.slice(0, 5)}–{log.actual_end.slice(0, 5)} ·{" "}
            {sessionHours({ start_time: log.actual_start, end_time: log.actual_end })}h
            {log.lesson_content ? ` · ${log.lesson_content}` : ""}
          </div>
        )}
      </div>

      {log ? (
        <Badge variant="jade" className="shrink-0">
          <CheckCircle2 className="h-3 w-3" /> Đã chấm công
        </Badge>
      ) : future ? (
        <Badge variant="muted" className="shrink-0">
          <CalendarClock className="h-3 w-3" /> Sắp diễn ra
        </Badge>
      ) : (
        <Badge variant="gold" className="shrink-0">
          Chưa chấm công
        </Badge>
      )}

      <div className="flex shrink-0 gap-2">
        {!future && (
          <Link href={`/classroom/${s.id}`}>
            <Button size="sm">
              <Presentation className="h-3.5 w-3.5" /> Vào lớp dạy
            </Button>
          </Link>
        )}
        <Link href={`/teacher/sessions/${s.id}`}>
          <Button size="sm" variant="outline">
            <ClipboardCheck className="h-3.5 w-3.5" /> Điểm danh HV
          </Button>
        </Link>
        {!future && (
          <Button size="sm" variant="outline" onClick={onLog}>
            <Timer className="h-3.5 w-3.5" /> {log ? "Sửa công" : "Chấm công"}
          </Button>
        )}
      </div>
    </div>
  );
}
