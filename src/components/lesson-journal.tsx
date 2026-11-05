"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { dmy, hm, weekdayOf } from "@/components/dashboard/kit";
import { SessionLink } from "@/components/session-drawer";
import { todayISO } from "@/lib/db";
import { downloadCSV } from "@/lib/db-finance";
import {
  fetchLessonJournal,
  PROGRESS_LABELS,
  PROGRESS_TONE,
  type LessonJournalRow,
  type LessonProgress,
} from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";

/** Số ngày gần nhất nạp về — cũ hơn xem ở trang lớp. */
const DAYS = 120;

interface Row {
  id: string;
  date: string;
  start: string;
  no: number | null;
  makeup: boolean;
  classId: string;
  className: string;
  teacherId: string;
  teacher: string;
  room: string | null;
  content: string | null;
  homework: string | null;
  /** GV xác nhận không giao BTVN (0066) — `homework` khi đó là lý do. */
  noHomework: boolean;
  nextPlan: string | null;
  progress: LessonProgress | null;
  present: number;
  marked: number;
}

function toRow(s: LessonJournalRow): Row {
  const log = Array.isArray(s.teaching_log) ? s.teaching_log[0] : s.teaching_log;
  return {
    id: s.id,
    date: s.date,
    start: s.start_time,
    no: s.session_no,
    makeup: s.type === "makeup",
    classId: s.class?.id ?? "",
    className: s.class?.name ?? (s.type === "makeup" ? "Buổi học bù" : "—"),
    teacherId: s.teacher?.id ?? "",
    teacher: s.teacher?.name ?? "—",
    room: s.room?.name ?? null,
    content: log?.lesson_content?.trim() || null,
    homework: log?.homework_note?.trim() || null,
    noHomework: log?.homework_status === "none",
    nextPlan: log?.next_plan?.trim() || null,
    progress: log?.progress ?? null,
    present: s.attendance.filter((a) => a.status === "present" || a.status === "makeup").length,
    marked: s.attendance.length,
  };
}

function isoDaysAgo(n: number): string {
  const d = new Date(todayISO() + "T00:00:00");
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const PROGRESS_RANK: Record<LessonProgress, number> = { behind: 0, on_track: 1, ahead: 2 };

/**
 * BUỔI HỌC — mỗi buổi đã chấm công một dòng: nội dung đã dạy, tiến độ so với
 * kế hoạch, BTVN, dự kiến buổi sau, sĩ số có mặt. Để ban quản lý và giáo
 * viên kiểm soát nội dung từng buổi. `admin` → thêm lọc/cột giáo viên.
 */
export function LessonJournal({ admin = false }: { admin?: boolean }) {
  const from = isoDaysAgo(DAYS);
  const list = useLoad(() => fetchLessonJournal(from), [from]);
  const rows = useMemo(() => (list.data ?? []).map(toRow), [list.data]);

  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [progress, setProgress] = useState("");
  const [month, setMonth] = useState("");

  const options = useMemo(() => {
    const classes = new Map<string, string>();
    const teachers = new Map<string, string>();
    const months = new Set<string>();
    for (const r of rows) {
      if (r.classId) classes.set(r.classId, r.className);
      if (r.teacherId) teachers.set(r.teacherId, r.teacher);
      months.add(r.date.slice(0, 7));
    }
    const byName = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1], "vi");
    return {
      classes: [...classes].sort(byName),
      teachers: [...teachers].sort(byName),
      months: [...months].sort().reverse(),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (classId && r.classId !== classId) return false;
      if (teacherId && r.teacherId !== teacherId) return false;
      if (month && !r.date.startsWith(month)) return false;
      if (progress === "none" ? r.progress : progress && r.progress !== progress) return false;
      if (needle) {
        const hay = [r.className, r.teacher, r.room, r.content, r.homework, r.nextPlan].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, classId, teacherId, month, progress]);

  const sort = useSort(
    filtered,
    {
      date: (r) => `${r.date} ${r.start}`,
      class: (r) => r.className,
      no: (r) => r.no,
      content: (r) => r.content,
      progress: (r) => (r.progress ? PROGRESS_RANK[r.progress] : null),
      present: (r) => (r.marked ? r.present / r.marked : null),
    },
    ["date", -1],
  );

  const behind = filtered.filter((r) => r.progress === "behind").length;
  const unrated = filtered.filter((r) => !r.progress).length;

  const exportCSV = () =>
    downloadCSV(
      `buoi-hoc-${todayISO()}.csv`,
      ["Ngày", "Thứ", "Giờ", "Lớp", "Phòng", "Giáo viên", "Buổi", "Nội dung đã dạy", "Tiến độ", "BTVN đã giao", "Dự kiến buổi sau", "Có mặt"],
      sort.sorted.map((r) => [
        dmy(r.date),
        weekdayOf(r.date),
        hm(r.start),
        r.className,
        r.room ?? "",
        r.teacher,
        r.no ?? "",
        r.content ?? "",
        r.progress ? PROGRESS_LABELS[r.progress] : "",
        r.noHomework ? ["Không giao", r.homework].filter(Boolean).join(": ") : r.homework ?? "",
        r.nextPlan ?? "",
        r.marked ? `${r.present}/${r.marked}` : "",
      ]),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Buổi học</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Mỗi buổi đã chấm công một dòng: nội dung đã dạy, tiến độ so với kế hoạch, bài tập về nhà,
            dự kiến buổi sau và sĩ số có mặt. Dữ liệu {DAYS} ngày gần nhất; cũ hơn xem ở trang lớp.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={sort.sorted.length === 0}>
          <Download className="h-4 w-4" /> Xuất Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm lớp, nội dung, bài tập..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} wrapClassName="w-full sm:w-44">
          <option value="">Mọi lớp</option>
          {options.classes.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
        {admin && (
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} wrapClassName="w-full sm:w-44">
            <option value="">Mọi giáo viên</option>
            {options.teachers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
        )}
        <Select value={progress} onChange={(e) => setProgress(e.target.value)} wrapClassName="w-full sm:w-48">
          <option value="">Mọi tiến độ</option>
          {(Object.keys(PROGRESS_LABELS) as LessonProgress[]).map((p) => (
            <option key={p} value={p}>{PROGRESS_LABELS[p]}</option>
          ))}
          <option value="none">Chưa đánh giá</option>
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} wrapClassName="w-full sm:w-40">
          <option value="">Mọi tháng</option>
          {options.months.map((m) => (
            <option key={m} value={m}>Tháng {Number(m.slice(5))}/{m.slice(0, 4)}</option>
          ))}
        </Select>
      </div>

      {list.error && <ErrorNote message={list.error} />}

      <Card className="overflow-hidden">
        {!list.loading && (
          <div className="border-b px-4 py-2.5 text-xs text-muted-foreground">
            {sort.sorted.length} buổi
            {behind > 0 && <span className="font-semibold text-amber-700"> · {behind} buổi chậm kế hoạch</span>}
            {unrated > 0 && <span> · {unrated} buổi chưa đánh giá tiến độ</span>}
          </div>
        )}
        {list.loading ? (
          <LoadingRows rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <Th k="date" {...sort}>Ngày</Th>
                  <Th k="class" {...sort}>Lớp</Th>
                  <Th k="no" {...sort}>Buổi</Th>
                  <Th k="content" {...sort}>Nội dung đã dạy</Th>
                  <Th k="progress" {...sort}>Tiến độ</Th>
                  <Th k="present" {...sort} align="right">Có mặt</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sort.sorted.length === 0 ? (
                  <EmptyRow cols={6}>
                    {rows.length === 0 ? "Chưa có buổi nào được chấm công." : "Không có buổi nào khớp bộ lọc."}
                  </EmptyRow>
                ) : (
                  sort.sorted.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-brand-50/40">
                      <td className={`${TD} whitespace-nowrap`}>
                        <SessionLink sessionId={r.id} onClose={list.reload} className="font-semibold text-brand-600 hover:underline">
                          {dmy(r.date)}
                        </SessionLink>
                        <div className="text-xs text-muted-foreground">
                          {weekdayOf(r.date)} · {hm(r.start)}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="font-medium">{r.className}</div>
                        <div className="text-xs text-muted-foreground">
                          {[r.room, admin ? r.teacher : null].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {r.makeup ? <Pill tone="muted">Bù</Pill> : r.no ?? "—"}
                      </td>
                      <td className={`${TD} max-w-md`}>
                        <div className="whitespace-pre-line">
                          {r.content ?? <span className="italic text-muted-foreground">Chưa ghi</span>}
                        </div>
                        {r.noHomework ? (
                          <div className="mt-1 text-xs text-amber-700">
                            <span className="font-semibold">Không giao BTVN</span>
                            {r.homework && `: ${r.homework}`}
                          </div>
                        ) : r.homework && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">BTVN:</span> {r.homework}
                          </div>
                        )}
                        {r.nextPlan && (
                          <div className="mt-0.5 text-xs text-brand-700">
                            <span className="font-semibold">Buổi sau:</span> {r.nextPlan}
                          </div>
                        )}
                      </td>
                      <td className={TD}>
                        {r.progress ? (
                          <Pill tone={PROGRESS_TONE[r.progress]}>{PROGRESS_LABELS[r.progress]}</Pill>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chưa đánh giá</span>
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {r.marked ? `${r.present}/${r.marked}` : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
