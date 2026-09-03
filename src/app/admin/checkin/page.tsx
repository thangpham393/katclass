"use client";

/**
 * CHECK-IN CA DẠY — một ngày, mọi ca, ai đã chấm công ai chưa.
 *
 * Tách khỏi trang Bảng công & lương (vốn gộp chung ba tab) vì đây là việc
 * theo dõi vận hành thuần túy: hành chính cần nhắc giáo viên chấm công,
 * chấm hộ khi giáo viên quên, mà không liên quan gì tới tiền. Trang lương
 * bên kia vẫn khoá riêng bằng `payroll.view`.
 */

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Pencil,
  Clock,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { SessionEditModal } from "@/components/session-edit-modal";
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

/** Ngày YYYY-MM-DD lệch n ngày. */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminCheckinPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);
  const [editFor, setEditFor] = useState<TeachingSessionRow | null>(null);

  const sessions = useLoad(
    () => fetchTeachingSessions(date, date, { includeCancelled: true }),
    [date],
  );
  const rows = sessions.data ?? [];
  const active = rows.filter((s) => s.status !== "cancelled"); // buổi đã hủy không tính công
  const logged = active.filter((s) => pickLog(s));
  const pending = active.filter((s) => !pickLog(s));
  const hours = logged.reduce((sum, s) => sum + payHours(s), 0);
  const noTeacher = active.filter((s) => !s.teacher).length;
  const d = new Date(date + "T00:00:00");

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Check-in ca dạy</h1>
        <p className="mt-1 text-muted-foreground">
          Giáo viên bấm <span className="font-semibold text-foreground">Chấm công</span> ở trang chủ sau mỗi ca dạy —
          hệ thống ghi giờ dạy thực tế, số giờ và nội dung bài học. Ca nào còn vàng là chưa ai chấm.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} aria-label="Ngày trước">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="w-full sm:w-44">
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
        <StatCard label="Ca dạy trong ngày" value={sessions.loading ? "—" : active.length} icon={CalendarDays} accent="brand" />
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
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
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
                  <div
                    key={s.id}
                    className={cn("flex flex-wrap items-center gap-3 py-3", s.status === "cancelled" && "opacity-60")}
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-semibold">
                        {s.class ? (
                          <Link href={`/admin/classes/${s.class.id}`} className="truncate hover:text-brand-600">
                            {s.class.name}
                          </Link>
                        ) : (
                          <span className="truncate">{sessionClassLabel(s)}</span>
                        )}
                        {s.type === "makeup" && <Badge variant="jade">Buổi bù</Badge>}
                        {s.status === "cancelled" && <Badge variant="destructive">Đã hủy</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.teacher?.name ?? "Chưa gán GV"}
                        {s.room ? ` · Phòng ${s.room.name}` : " · chưa xếp phòng"}
                        {s.session_no ? ` · Buổi ${s.session_no}` : ""}
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
                    {s.status === "cancelled" ? null : log ? (
                      <Badge variant="jade" className="shrink-0">Đã chấm công</Badge>
                    ) : (
                      <Badge variant="gold" className="shrink-0">Chưa chấm công</Badge>
                    )}
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditFor(s)}>
                        <Pencil className="h-3.5 w-3.5" /> Sửa lớp
                      </Button>
                      {s.status !== "cancelled" && (
                        <Button size="sm" variant={log ? "ghost" : "outline"} onClick={() => setLogFor(s)}>
                          {log ? "Sửa công" : "Chấm hộ"}
                        </Button>
                      )}
                    </div>
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

      <SessionEditModal session={editFor} onClose={() => setEditFor(null)} onSaved={sessions.reload} />
    </div>
  );
}
