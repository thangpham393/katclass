"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { TeachingCard } from "@/components/teaching-card";
import { cn } from "@/lib/utils";
import { todayISO, WEEKDAY_LABELS } from "@/lib/db";
import {
  attendanceCount,
  payHours,
  pickLog,
  fetchTeachingSessions,
  type TeachingSessionRow,
} from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";

/** Cộng/trừ ngày cho một chuỗi YYYY-MM-DD (không lệch múi giờ). */
function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Thứ Hai của tuần chứa ngày iso. */
function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return shiftISO(iso, d.getDay() === 0 ? -6 : 1 - d.getDay());
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]}, ${d.toLocaleDateString("vi-VN")}`;
}

type Filter = "all" | "no_attendance" | "no_log";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "no_attendance", label: "Chưa điểm danh" },
  { key: "no_log", label: "Chưa chấm công" },
];

/**
 * Lịch dạy của giáo viên theo khoảng ngày bất kỳ — xem lại buổi đã dạy,
 * lọc nhanh những buổi còn thiếu điểm danh hoặc chưa chấm công.
 */
export default function TeacherSchedulePage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";

  const [from, setFrom] = useState(() => mondayOf(todayISO()));
  const [to, setTo] = useState(() => shiftISO(mondayOf(todayISO()), 6));
  const [filter, setFilter] = useState<Filter>("all");
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);

  const sessions = useLoad(
    () =>
      teacherId && from <= to
        ? fetchTeachingSessions(from, to, { teacherId })
        : Promise.resolve([]),
    [teacherId, from, to],
  );

  const today = todayISO();

  function setWeek(anchor: string) {
    const mon = mondayOf(anchor);
    setFrom(mon);
    setTo(shiftISO(mon, 6));
  }

  const rows = useMemo(() => {
    const list = sessions.data ?? [];
    return list.filter((s) => {
      if (filter === "no_attendance") return s.date <= today && attendanceCount(s) === 0;
      if (filter === "no_log") return s.date <= today && !pickLog(s);
      return true;
    });
  }, [sessions.data, filter, today]);

  // Gom theo ngày để nhìn ra lịch tuần
  const byDate = useMemo(() => {
    const map = new Map<string, TeachingSessionRow[]>();
    for (const s of rows) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return [...map.entries()];
  }, [rows]);

  const past = (sessions.data ?? []).filter((s) => s.date <= today);
  const missingAttendance = past.filter((s) => attendanceCount(s) === 0).length;
  const missingLog = past.filter((s) => !pickLog(s)).length;
  const hours = (sessions.data ?? []).reduce((sum, s) => sum + payHours(s), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Lịch dạy của tôi</h1>
        <p className="mt-1 text-muted-foreground">
          Xem lại mọi buổi đã dạy theo ngày — buổi nào còn thiếu điểm danh hay chưa chấm công đều hiện rõ ở đây.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-600" /> Khoảng thời gian
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setWeek(shiftISO(from, -7))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Tuần trước
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWeek(today)}>
              Tuần này
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWeek(shiftISO(from, 7))}>
              Tuần sau <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFrom(today.slice(0, 8) + "01");
                setTo(today);
              }}
            >
              Từ đầu tháng
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:flex-none">
              Từ ngày
              <Input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full sm:w-44"
              />
            </label>
            <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:flex-none">
              Đến ngày
              <Input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full sm:w-44"
              />
            </label>
            <div className="flex w-full overflow-x-auto rounded-lg border bg-secondary/40 p-0.5 sm:w-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === f.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {!sessions.loading && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="muted">{sessions.data?.length ?? 0} buổi</Badge>
              <Badge variant="muted">{hours}h dạy</Badge>
              {missingAttendance > 0 && (
                <Badge variant="destructive">{missingAttendance} buổi chưa điểm danh</Badge>
              )}
              {missingLog > 0 && <Badge variant="gold">{missingLog} buổi chưa chấm công</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {sessions.error && <ErrorNote message={sessions.error} />}

      {sessions.loading ? (
        <LoadingRows rows={4} />
      ) : byDate.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {filter === "all"
            ? "Không có ca dạy nào trong khoảng ngày này."
            : "Không còn buổi nào thiếu ở khoảng ngày này. ✓"}
        </div>
      ) : (
        <div className="space-y-6">
          {byDate.map(([date, list]) => (
            <section key={date} className="space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground">
                {fmtDay(date)}
                <span className="ml-2 font-normal">{list.length} ca</span>
              </h2>
              {list.map((s) => (
                <TeachingCard
                  key={s.id}
                  session={s}
                  future={s.date > today}
                  onLog={() => setLogFor(s)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      <TeachingLogModal
        session={logFor}
        currentUserId={teacherId}
        onClose={() => setLogFor(null)}
        onSaved={() => {
          sessions.reload();
          setLogFor(null);
        }}
      />
    </div>
  );
}
