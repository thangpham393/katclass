"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, Clock, GraduationCap, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, todayISO } from "@/lib/db";
import { fetchCompletedSessions, sessionHours, type TeachingSessionRow } from "@/lib/db-tuition";

interface TeacherTally {
  teacherId: string;
  teacherName: string;
  sessions: TeachingSessionRow[];
  hours: number;
}

/** [from, to] của một tháng dạng YYYY-MM. */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

export default function AdminPayrollPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const sessions = useLoad(() => {
    const [from, to] = monthRange(month);
    return fetchCompletedSessions(from, to);
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
      };
      entry.sessions.push(s);
      entry.hours += sessionHours(s);
      map.set(s.teacher.id, entry);
    }
    return [...map.values()].sort((a, b) => b.sessions.length - a.sessions.length);
  }, [sessions.data]);

  const totalSessions = tallies.reduce((s, t) => s + t.sessions.length, 0);
  const totalHours = tallies.reduce((s, t) => s + t.hours, 0);
  const noTeacher = (sessions.data ?? []).filter((s) => !s.teacher).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Chấm công giáo viên</h1>
          <p className="mt-1 text-muted-foreground">
            Mỗi buổi <span className="font-semibold text-foreground">đã hoàn thành</span> có giáo viên thực dạy = 1 công
            (kể cả dạy thay). Đánh dấu hoàn thành buổi ở trang buổi dạy của giáo viên.
          </p>
        </div>
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
              description="Khi giáo viên hoàn thành buổi dạy (điểm danh xong), công sẽ tự hiện ở đây."
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
                          {new Set(t.sessions.map((s) => s.class?.id)).size} lớp
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
                            return (
                              <div key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                                  {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
                                </span>
                                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                                  {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">{s.class?.name ?? "?"}</span>
                                {s.type === "makeup" && <Badge variant="jade">Buổi bù</Badge>}
                                <span className="shrink-0 text-xs text-muted-foreground">{sessionHours(s)}h</span>
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
