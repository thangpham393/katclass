"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  GraduationCap,
  Timer,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, sessionClassLabel, todayISO } from "@/lib/db";
import {
  attendanceCount,
  fetchTeachingSessions,
  payHours,
  pickLog,
  sessionHours,
  type TeachingSessionRow,
} from "@/lib/db-tuition";

interface TeacherTally {
  teacherId: string;
  teacherName: string;
  sessions: TeachingSessionRow[];
  hours: number;
  logged: number;
}

/** [from, to] của một tháng dạng YYYY-MM. */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** Ngày YYYY-MM-DD lệch n ngày. */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminPayrollPage() {
  const [tab, setTab] = useState<"day" | "month">("day");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Chấm công giáo viên</h1>
        <p className="mt-1 text-muted-foreground">
          Giáo viên bấm <span className="font-semibold text-foreground">Chấm công</span> ở trang chủ sau mỗi ca dạy —
          hệ thống ghi giờ dạy thực tế, số giờ và nội dung bài học. 1 ca đã chấm = 1 công.
        </p>
      </div>

      <div className="flex w-fit rounded-lg border bg-secondary/40 p-0.5">
        {([
          { key: "day", label: "Theo dõi theo ngày" },
          { key: "month", label: "Bảng công tháng" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "day" ? <DayTracking /> : <MonthTally />}
    </div>
  );
}

/* ---------------- Theo dõi theo ngày ---------------- */

function DayTracking() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);

  const sessions = useLoad(() => fetchTeachingSessions(date, date), [date]);
  const rows = sessions.data ?? [];
  const logged = rows.filter((s) => pickLog(s));
  const pending = rows.filter((s) => !pickLog(s));
  const hours = logged.reduce((sum, s) => sum + payHours(s), 0);
  const noTeacher = rows.filter((s) => !s.teacher).length;
  const d = new Date(date + "T00:00:00");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} aria-label="Ngày trước">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="w-44">
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} aria-label="Ngày sau">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant={date === todayISO() ? "secondary" : "ghost"} size="sm" onClick={() => setDate(todayISO())}>
          Hôm nay
        </Button>
        <span className="text-sm text-muted-foreground">
          {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Ca dạy trong ngày" value={sessions.loading ? "—" : rows.length} icon={CalendarDays} accent="brand" />
        <StatCard label="Đã chấm công" value={sessions.loading ? "—" : logged.length} icon={CalendarCheck} accent="jade" />
        <StatCard label="Chưa chấm công" value={sessions.loading ? "—" : pending.length} icon={Timer} accent="gold" />
        <StatCard label="Tổng giờ đã ghi nhận" value={sessions.loading ? "—" : `${hours}h`} icon={Clock} accent="sky" />
      </section>

      {sessions.error && <ErrorNote message={sessions.error} />}
      {noTeacher > 0 && !sessions.loading && (
        <div className="flex items-center gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-gold-800">
          <CircleAlert className="h-4 w-4" /> {noTeacher} buổi trong ngày chưa gán giáo viên — không tính công được.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ca dạy</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {sessions.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : rows.length === 0 ? (
            <Empty
              icon={CalendarDays}
              title="Không có buổi học nào trong ngày này"
              description="Chọn ngày khác hoặc sinh buổi học từ lịch tuần của lớp."
              className="p-10"
            />
          ) : (
            <div className="divide-y">
              {rows.map((s) => {
                const log = pickLog(s);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {sessionClassLabel(s)}
                        {s.type === "makeup" && <Badge variant="jade" className="ml-2">Buổi bù</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.teacher?.name ?? "Chưa gán GV"}
                        {s.room ? ` · Phòng ${s.room.name}` : ""}
                        {attendanceCount(s) > 0 ? ` · điểm danh ${attendanceCount(s)} HV` : " · chưa điểm danh HV"}
                      </div>
                      {log && (
                        <div className="mt-0.5 text-xs text-emerald-700">
                          Thực dạy {log.actual_start.slice(0, 5)}–{log.actual_end.slice(0, 5)} ·{" "}
                          {sessionHours({ start_time: log.actual_start, end_time: log.actual_end })}h
                          {log.lesson_content ? ` · ${log.lesson_content}` : ""}
                          {log.note ? ` (${log.note})` : ""}
                        </div>
                      )}
                    </div>
                    {log ? (
                      <Badge variant="jade" className="shrink-0">Đã chấm công</Badge>
                    ) : (
                      <Badge variant="gold" className="shrink-0">Chưa chấm công</Badge>
                    )}
                    <Button
                      size="sm"
                      variant={log ? "ghost" : "outline"}
                      className="shrink-0"
                      onClick={() => setLogFor(s)}
                    >
                      {log ? "Sửa" : "Chấm hộ"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TeachingLogModal
        session={logFor}
        currentUserId={user?.id ?? ""}
        onClose={() => setLogFor(null)}
        onSaved={sessions.reload}
      />
    </div>
  );
}

/* ---------------- Bảng công tháng ---------------- */

function MonthTally() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const sessions = useLoad(() => {
    const [from, to] = monthRange(month);
    return fetchTeachingSessions(from, to, { completedOnly: true });
  }, [month]);

  const tallies = useMemo<TeacherTally[]>(() => {
    const map = new Map<string, TeacherTally>();
    for (const s of sessions.data ?? []) {
      if (!s.teacher) continue;
      const entry = map.get(s.teacher.id) ?? {
        teacherId: s.teacher.id,
        teacherName: s.teacher.name,
        sessions: [],
        hours: 0,
        logged: 0,
      };
      entry.sessions.push(s);
      entry.hours += payHours(s);
      if (pickLog(s)) entry.logged += 1;
      map.set(s.teacher.id, entry);
    }
    return [...map.values()].sort((a, b) => b.sessions.length - a.sessions.length);
  }, [sessions.data]);

  const totalSessions = tallies.reduce((s, t) => s + t.sessions.length, 0);
  const totalHours = tallies.reduce((s, t) => s + t.hours, 0);
  const noTeacher = (sessions.data ?? []).filter((s) => !s.teacher).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Số giờ lấy theo <span className="font-semibold text-foreground">giờ dạy thực tế</span> khi ca đã chấm công,
          ca chưa chấm thì tạm tính theo giờ lịch.
        </p>
        <div className="w-44">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="GV có công trong tháng" value={sessions.loading ? "—" : tallies.length} icon={GraduationCap} accent="brand" />
        <StatCard label="Tổng buổi dạy" value={sessions.loading ? "—" : totalSessions} icon={CalendarCheck} accent="jade" />
        <StatCard label="Tổng giờ dạy" value={sessions.loading ? "—" : `${totalHours}h`} icon={Clock} accent="sky" />
        <StatCard label="Buổi chưa gán GV" value={sessions.loading ? "—" : noTeacher} icon={Users} accent="gold" />
      </section>

      {sessions.error && <ErrorNote message={sessions.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Bảng công tháng {month.split("-")[1]}/{month.split("-")[0]}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {sessions.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : tallies.length === 0 ? (
            <Empty
              icon={CalendarCheck}
              title="Chưa có buổi dạy hoàn thành nào trong tháng này"
              description="Khi giáo viên chấm công ca dạy (hoặc điểm danh xong buổi), công sẽ tự hiện ở đây."
              className="p-10"
            />
          ) : (
            <div className="divide-y">
              {tallies.map((t) => {
                const open = expanded === t.teacherId;
                return (
                  <div key={t.teacherId}>
                    <button
                      onClick={() => setExpanded(open ? null : t.teacherId)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <Avatar name={t.teacherName} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{t.teacherName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Set(t.sessions.map((s) => s.class?.id)).size} lớp · đã chấm công {t.logged}/
                          {t.sessions.length} ca
                          {t.sessions.some((s) => s.type === "makeup") && " · có buổi học bù"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-extrabold">{t.sessions.length} công</div>
                        <div className="text-xs text-muted-foreground">{t.hours}h dạy</div>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="mb-3 max-h-72 overflow-y-auto rounded-lg border bg-secondary/30 scrollbar-thin">
                        <div className="divide-y">
                          {t.sessions.map((s) => {
                            const d = new Date(s.date + "T00:00:00");
                            const log = pickLog(s);
                            return (
                              <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                                  {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
                                </span>
                                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                                  {(log?.actual_start ?? s.start_time).slice(0, 5)}–
                                  {(log?.actual_end ?? s.end_time).slice(0, 5)}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {sessionClassLabel(s)}
                                  {log?.lesson_content && (
                                    <span className="font-normal text-muted-foreground"> — {log.lesson_content}</span>
                                  )}
                                </span>
                                {s.type === "makeup" && <Badge variant="jade">Buổi bù</Badge>}
                                {!log && <Badge variant="gold">Chưa chấm công</Badge>}
                                <span className="shrink-0 text-xs text-muted-foreground">{payHours(s)}h</span>
                              </div>
                            );
                          })}
                        </div>
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
