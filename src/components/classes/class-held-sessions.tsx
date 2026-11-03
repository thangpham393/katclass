"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { SCROLL_10, SectionHead, dmy, hm, pct, weekdayOf } from "@/components/dashboard/kit";
import { SessionLink } from "@/components/session-drawer";
import { cn } from "@/lib/utils";
import { fetchClass, fetchClassCourseHistory, todayISO } from "@/lib/db";
import { downloadCSV } from "@/lib/db-finance";
import { fetchClassHeldSessions, type HeldSessionRow } from "@/lib/db-dashboard";
import { useLoad } from "@/lib/use-load";

interface Row {
  id: string;
  no: number | null;
  date: string;
  start: string;
  end: string;
  teacher: string;
  room: string | null;
  off: boolean;
  offReason: string | null;
  logged: boolean;
  content: string | null;
  present: number;
  absent: number;
  marked: number;
  commented: number;
}

function toRow(s: HeldSessionRow): Row {
  const log = Array.isArray(s.teaching_log) ? s.teaching_log[0] ?? null : s.teaching_log;
  const present = s.attendance.filter((a) => a.status === "present" || a.status === "makeup").length;
  return {
    id: s.id,
    no: s.session_no,
    date: s.date,
    start: s.start_time,
    end: s.end_time,
    teacher: s.teacher?.name ?? "—",
    room: s.room?.name ?? null,
    off: s.status === "cancelled",
    offReason: s.cancel_reason,
    logged: !!log,
    content: log?.lesson_content?.trim() || null,
    present,
    absent: s.attendance.length - present,
    marked: s.attendance.length,
    commented: s.session_comments.length,
  };
}

/**
 * CÁC BUỔI ĐÃ HỌC của lớp (tới hôm nay, mới nhất trước): ai dạy, đã chấm
 * công / điểm danh / nhận xét chưa, nội dung bài — bấm ngày để mở buổi.
 * Dùng chung trang chi tiết lớp của hành chính và giáo viên.
 */
export function ClassHeldSessions({ classId }: { classId: string }) {
  const today = todayISO();
  const list = useLoad(() => fetchClassHeldSessions(classId), [classId]);
  // Lớp đã lên khóa mới (0062): số buổi đánh lại theo từng khóa → ghi kèm tên khóa
  const timeline = useLoad(async () => {
    const [cls, history] = await Promise.all([fetchClass(classId), fetchClassCourseHistory(classId)]);
    return { from: cls?.course_started_on ?? null, current: cls?.course?.name ?? null, history };
  }, [classId]);
  const courseOf = (date: string): string | null => {
    const t = timeline.data;
    if (!t || !t.history.length) return null;
    if (!t.from || date >= t.from) return t.current;
    return t.history.find((h) => (!h.started_on || date >= h.started_on) && date <= h.ended_on)?.course_name ?? null;
  };
  const rows = useMemo(() => (list.data ?? []).map(toRow), [list.data]);

  const sort = useSort(
    rows,
    {
      date: (r) => `${r.date} ${r.start}`,
      teacher: (r) => r.teacher,
      attendance: (r) => (r.off ? null : pct(r.present, r.marked)),
      comments: (r) => (r.off ? null : r.present - r.commented),
    },
    ["date", -1],
  );

  const held = rows.filter((r) => !r.off);
  const present = held.reduce((n, r) => n + r.present, 0);
  const marked = held.reduce((n, r) => n + r.marked, 0);
  const rate = pct(present, marked);

  const exportCSV = () =>
    downloadCSV(
      `buoi-da-hoc-${today}.csv`,
      ["Khóa", "Buổi", "Ngày", "Giờ", "Giáo viên", "Phòng", "Tình trạng", "Có mặt", "Vắng", "Nhận xét", "Nội dung bài"],
      sort.sorted.map((r) => [
        courseOf(r.date) ?? "",
        r.no ?? "",
        dmy(r.date),
        `${hm(r.start)} - ${hm(r.end)}`,
        r.teacher,
        r.room ?? "",
        r.off ? "Lớp nghỉ" : r.logged ? "Đã chấm công" : "Chưa chấm công",
        r.off ? "" : r.present,
        r.off ? "" : r.absent,
        r.off ? "" : `${Math.min(r.commented, r.present)}/${r.present}`,
        r.content ?? r.offReason ?? "",
      ]),
    );

  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Các buổi đã học"
        desc={
          list.loading
            ? "Đang tải…"
            : `${held.length} buổi đã học${rows.length > held.length ? `, ${rows.length - held.length} buổi lớp nghỉ` : ""}${
                rate === null ? "" : ` · chuyên cần ${rate}%`
              }. Bấm ngày để mở buổi: điểm danh, chấm công, viết nhận xét.`
        }
        action={
          <button
            type="button"
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        }
      />
      {list.error && <ErrorNote message={list.error} />}
      {list.loading ? (
        <LoadingRows rows={4} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="date" {...sort}>Buổi học</Th>
                <Th k="teacher" {...sort}>Giáo viên</Th>
                <Th>Tình trạng</Th>
                <Th k="attendance" {...sort}>Điểm danh</Th>
                <Th k="comments" {...sort}>Nhận xét</Th>
                <Th>Nội dung bài</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sort.sorted.length === 0 ? (
                <EmptyRow cols={6}>Lớp chưa học buổi nào.</EmptyRow>
              ) : (
                sort.sorted.map((r) => {
                  const missingComments = Math.max(0, r.present - r.commented);
                  return (
                    <tr key={r.id} className={cn("hover:bg-brand-50/40", r.off && "bg-muted/30")}>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <SessionLink sessionId={r.id} onClose={list.reload} className="font-semibold text-brand-600 hover:underline">
                          {r.no ? `Buổi ${r.no} · ` : ""}
                          {dmy(r.date)}
                        </SessionLink>
                        <div className="text-xs text-muted-foreground">
                          {weekdayOf(r.date)} · {hm(r.start)} - {hm(r.end)}
                          {r.room ? ` · P.${r.room}` : ""}
                        </div>
                        {courseOf(r.date) && (
                          <div className="text-[11px] font-semibold text-brand-700">{courseOf(r.date)}</div>
                        )}
                      </td>
                      <td className={TD}>{r.teacher}</td>
                      <td className={TD}>
                        {r.off ? (
                          <Pill tone="muted">Lớp nghỉ</Pill>
                        ) : r.logged ? (
                          <Pill tone="green">Đã chấm công</Pill>
                        ) : (
                          <Pill tone={r.date < today ? "red" : "amber"}>Chưa chấm công</Pill>
                        )}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        {r.off ? (
                          <span className="text-muted-foreground">—</span>
                        ) : r.marked === 0 ? (
                          <Pill tone="amber">Chưa điểm danh</Pill>
                        ) : (
                          <span>
                            <b>{r.present}</b> có mặt
                            {r.absent > 0 && <span className="text-rose-600"> · {r.absent} vắng</span>}
                          </span>
                        )}
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>
                        {r.off || r.present === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : missingComments === 0 ? (
                          <Pill tone="green">Đủ {r.present}</Pill>
                        ) : (
                          <SessionLink sessionId={r.id} onClose={list.reload}>
                            <Pill tone="amber">
                              Thiếu {missingComments}/{r.present}
                            </Pill>
                          </SessionLink>
                        )}
                      </td>
                      <td className={cn(TD, "max-w-xs")}>
                        <div className="line-clamp-2 text-xs" title={r.content ?? r.offReason ?? undefined}>
                          {r.off
                            ? r.offReason ?? <span className="text-muted-foreground">Không ghi lý do</span>
                            : r.content ?? <span className="italic text-muted-foreground">Chưa ghi</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
