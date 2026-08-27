"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Radio,
  Timer,
  User,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sessionClassLabel, WEEKDAY_LABELS } from "@/lib/db";
import { EnterClassroomButton } from "@/components/classroom/warp-transition";
import {
  attendanceCount,
  pickLog,
  sessionHours,
  type TeachingSessionRow,
} from "@/lib/db-tuition";

/** Ca dạy có đang diễn ra ngay lúc này không (chỉ tính sau khi mount, tránh lệch SSR). */
function useIsLive(s: Pick<TeachingSessionRow, "date" | "start_time" | "end_time">): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const check = () => {
      const now = new Date();
      setLive(
        now >= new Date(`${s.date}T${s.start_time}`) && now <= new Date(`${s.date}T${s.end_time}`),
      );
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [s.date, s.start_time, s.end_time]);
  return live;
}

/**
 * Thẻ một ca dạy — dùng chung cho trang chủ GV, trang "Lịch dạy" (xem lại
 * theo ngày bất kỳ) và trang tổng quan của hành chính (`showTeacher`: thêm
 * tên giáo viên đứng lớp vì đang xem ca của cả trung tâm).
 */
export function TeachingCard({
  session: s,
  future,
  showTeacher,
  onLog,
}: {
  session: TeachingSessionRow;
  future?: boolean;
  showTeacher?: boolean;
  onLog: () => void;
}) {
  const log = pickLog(s);
  const d = new Date(s.date + "T00:00:00");
  const marked = attendanceCount(s);
  const live = useIsLive(s);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3.5",
        log && "border-emerald-200 bg-emerald-50/40",
        live && !log && "border-brand-300 bg-brand-50/40",
      )}
    >
      {/* Hàng thông tin: ô ngày + tên lớp/giờ (co giãn) + trạng thái chấm công */}
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-center leading-none">
          <div>
            <div className="text-[10px] font-semibold uppercase text-brand-500">{WEEKDAY_LABELS[d.getDay()]}</div>
            <div className="text-sm font-extrabold text-brand-700">{d.getDate()}</div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate text-sm font-semibold">{sessionClassLabel(s)}</span>
            {live && (
              <Badge variant="destructive" className="shrink-0">
                <Radio className="h-3 w-3 animate-pulse" /> Đang diễn ra
              </Badge>
            )}
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
            {!future && marked === 0 && (
              <Badge variant="destructive" className="shrink-0">
                <UserX className="h-3 w-3" /> Chưa điểm danh
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
            {s.room ? ` · Phòng ${s.room.name}` : ""}
            {s.session_no ? ` · Buổi ${s.session_no}` : ""}
            {s.type === "makeup" ? " · Buổi bù" : ""}
            {marked > 0 ? ` · điểm danh ${marked} HV` : ""}
          </div>
          {showTeacher && (
            <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-700">
              <User className="h-3 w-3" /> {s.teacher?.name ?? "Chưa phân công giáo viên"}
            </div>
          )}
          {log && (
            <div className="mt-1 text-xs text-emerald-700">
              Thực dạy {log.actual_start.slice(0, 5)}–{log.actual_end.slice(0, 5)} ·{" "}
              {sessionHours({ start_time: log.actual_start, end_time: log.actual_end })}h
              {log.lesson_content ? ` · ${log.lesson_content}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Hàng nút: màn hẹp xếp 2 cột cho dễ bấm, màn rộng nằm ngang một hàng */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href={`/teacher/sessions/${s.id}/prepare`} className="w-full sm:w-auto">
          <Button size="sm" variant={future ? "default" : "outline"} className="w-full sm:w-auto">
            <ListChecks className="h-3.5 w-3.5" /> Chuẩn bị bài
          </Button>
        </Link>
        {!future && (
          <EnterClassroomButton
            sessionId={s.id}
            size="sm"
            className="w-full sm:w-auto"
            iconClassName="h-3.5 w-3.5"
          />
        )}
        <Link href={`/teacher/sessions/${s.id}`} className="w-full sm:w-auto">
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            <ClipboardCheck className="h-3.5 w-3.5" /> Điểm danh HV
          </Button>
        </Link>
        {!future && (
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={onLog}>
            <Timer className="h-3.5 w-3.5" /> {log ? "Sửa công" : "Chấm công"}
          </Button>
        )}
      </div>
    </div>
  );
}
