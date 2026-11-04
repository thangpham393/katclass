"use client";

import Link from "next/link";
import { SessionLink } from "@/components/session-drawer";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/db-finance";
import {
  ABSENT_WARN,
  MISSING_WARN,
  COMMENT_DAYS,
  SCORE_WARN,
  WINDOW_DAYS,
  isUnmarked,
  type DashSession,
} from "@/lib/db-dashboard";
import type { AttentionRow, CareRow, ClassStatRow, CommentDueRow } from "@/lib/dashboard-calc";
import { SCROLL_10, SectionHead, daysBetween, dmy, hm, weekdayOf } from "./kit";

/**
 * Các bảng dùng chung giữa Bảng điều khiển admin và trang chủ giáo viên.
 * Đường dẫn đi qua `links` vì hai phía có trang chi tiết khác nhau (GV
 * không có trang hồ sơ học viên → tên học viên chỉ là chữ).
 */
export interface DashLinks {
  class: (id: string) => string;
  student?: (id: string) => string;
}

export const ADMIN_LINKS: DashLinks = {
  class: (id) => `/admin/classes/${id}`,
  student: (id) => `/admin/students/${id}`,
};

export const TEACHER_LINKS: DashLinks = {
  class: (id) => `/teacher/classes/${id}`,
};

function StudentLink({ id, name, links }: { id: string; name: string; links: DashLinks }) {
  return links.student ? (
    <Link href={links.student(id)} className="font-semibold text-brand-600 hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-semibold">{name}</span>
  );
}

/* ---------------- Buổi học chưa cập nhật ---------------- */

/** Neo cuộn tới bảng "Buổi học chưa cập nhật" trên cùng trang. */
export const OVERDUE_ANCHOR = "buoi-chua-cap-nhat";

export function OverdueCard({
  rows,
  loading,
  today,
  links,
  onChanged,
}: {
  rows: DashSession[];
  loading: boolean;
  today: string;
  links: DashLinks;
  /** Đóng ngăn kéo chi tiết buổi → nạp lại bảng */
  onChanged?: () => void;
}) {
  const overdueSort = useSort(
    rows,
    {
      date: (s) => s.date,
      class: (s) => s.class?.name ?? "",
      teacher: (s) => s.teacher?.name ?? "",
      kind: (s) => (isUnmarked(s) ? 1 : 0),
      late: (s) => daysBetween(s.date, today),
    },
    ["late", -1],
  );
  return (
    <Card id={OVERDUE_ANCHOR} className="scroll-mt-20 overflow-hidden">
      <SectionHead
        title="Buổi học chưa cập nhật"
        desc='Chưa chấm công quá 24 giờ, hoặc đã chấm công mà chưa điểm danh. Lớp nghỉ thì giáo viên báo "Lớp nghỉ" là hết báo.'
      />
      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[540px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="date" {...overdueSort}>Ngày học</Th>
                <Th k="class" {...overdueSort}>Lớp</Th>
                <Th k="teacher" {...overdueSort}>Giáo viên</Th>
                <Th k="kind" {...overdueSort}>Thiếu</Th>
                <Th k="late" {...overdueSort} align="right">Trễ</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {overdueSort.sorted.length === 0 ? (
                <EmptyRow cols={5}>Các buổi đều đã chấm công và điểm danh 🎉</EmptyRow>
              ) : (
                overdueSort.sorted.map((s) => (
                  <tr key={s.id} className="hover:bg-brand-50/40">
                    <td className={TD}>
                      <SessionLink sessionId={s.id} onClose={onChanged} className="font-semibold text-brand-600 hover:underline">
                        {dmy(s.date)}
                      </SessionLink>
                      <div className="text-xs text-muted-foreground">
                        {weekdayOf(s.date)} · {hm(s.start_time)}
                      </div>
                    </td>
                    <td className={TD}>
                      {s.class ? (
                        <Link href={links.class(s.class.id)} className="font-semibold text-brand-600 hover:underline">
                          {s.class.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">Buổi học bù</span>
                      )}
                      <div className="text-xs text-muted-foreground">{s.room?.name ?? "—"}</div>
                    </td>
                    <td className={TD}>{s.teacher?.name ?? "—"}</td>
                    <td className={TD}>
                      {isUnmarked(s) ? (
                        <Pill tone="amber">Điểm danh</Pill>
                      ) : (
                        <Pill tone="red">Chấm công</Pill>
                      )}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-right")}>
                      {daysBetween(s.date, today)} ngày
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Học viên cần chú ý ---------------- */

const flagPill = (f: AttentionRow["flags"][number]) =>
  f === "parent" ? (
    <Pill key={f} tone="red">Cần liên hệ PH</Pill>
  ) : f === "absent" ? (
    <Pill key={f} tone="red">Nghỉ nhiều</Pill>
  ) : f === "missing" ? (
    <Pill key={f} tone="amber">Thiếu bài tập</Pill>
  ) : (
    <Pill key={f} tone="amber">Kết quả yếu</Pill>
  );

export function AttentionCard({
  rows,
  loading,
  links,
}: {
  rows: AttentionRow[];
  loading: boolean;
  links: DashLinks;
}) {
  const attentionSort = useSort(rows, {
    name: (r) => r.name,
    absent: (r) => r.absent,
    avg: (r) => r.avg,
    missing: (r) => r.missing,
    flags: (r) => r.flags.length,
  });
  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Học viên cần chú ý"
        desc="Bấm vào học viên để xem điểm danh, điểm, chăm sóc."
      />
      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="name" {...attentionSort}>Học viên</Th>
                <Th k="absent" {...attentionSort} align="right">Nghỉ</Th>
                <Th k="avg" {...attentionSort} align="right">Điểm TB</Th>
                <Th k="missing" {...attentionSort} align="right">Thiếu bài</Th>
                <Th k="flags" {...attentionSort}>Cảnh báo</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attentionSort.sorted.length === 0 ? (
                <EmptyRow cols={5}>Không có học viên nào chạm ngưỡng cảnh báo 🎉</EmptyRow>
              ) : (
                attentionSort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={TD}>
                      <StudentLink id={r.id} name={r.name} links={links} />
                      <div className="text-xs text-muted-foreground">{r.className}</div>
                    </td>
                    <td className={cn(TD, "text-right", r.absent >= ABSENT_WARN && "font-semibold text-rose-600")}>
                      {r.absent}
                    </td>
                    <td className={cn(TD, "text-right", r.avg !== null && r.avg < SCORE_WARN && "font-semibold text-rose-600")}>
                      {r.avg === null ? "—" : r.avg.toLocaleString("vi-VN")}
                    </td>
                    <td className={cn(TD, "text-right", r.missing >= MISSING_WARN && "font-semibold text-rose-600")}>
                      {r.missing}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">{r.flags.map(flagPill)}</div>
                      {r.parentNote && (
                        <div className="mt-1 line-clamp-2 max-w-xs text-xs text-muted-foreground" title={r.parentNote}>
                          {r.parentNote}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Chăm sóc đang mở ---------------- */

export function CareCard({
  rows,
  loading,
  error,
  links,
  careHref,
  desc = `Yêu cầu Mới và Đang xử lý, quá hạn tô đỏ. Vắng từ ${ABSENT_WARN} buổi liên tiếp là hệ thống tự mở phiếu.`,
}: {
  rows: CareRow[];
  loading: boolean;
  error: string | null;
  links: DashLinks;
  /** Trang quản lý phiếu; null = vai trò chỉ được xem (giáo viên). */
  careHref: string | null;
  desc?: string;
}) {
  const careSort = useSort(
    rows,
    {
      code: (r) => r.code,
      name: (r) => r.name,
      issue: (r) => r.issue,
      handler: (r) => r.handler,
      due: (r) => r.due || null,
      status: (r) => r.status,
    },
    ["due", 1],
  );
  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Chăm sóc đang mở"
        desc={desc}
        action={
          careHref ? (
            <Link
              href={careHref}
              className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary"
            >
              Mở trang Chăm sóc
            </Link>
          ) : undefined
        }
      />
      {error && <ErrorNote message={error} />}
      {loading ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <Th k="code" {...careSort}>Mã</Th>
                <Th k="name" {...careSort}>Học viên</Th>
                <Th k="issue" {...careSort}>Vấn đề</Th>
                <Th k="handler" {...careSort}>Người xử lý</Th>
                <Th k="due" {...careSort}>Hạn</Th>
                <Th k="status" {...careSort}>Trạng thái</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {careSort.sorted.length === 0 ? (
                <EmptyRow cols={6}>Không có yêu cầu chăm sóc nào đang mở 🎉</EmptyRow>
              ) : (
                careSort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={cn(TD, "whitespace-nowrap")}>
                      {careHref ? (
                        <Link href={careHref} className="font-semibold hover:text-brand-600 hover:underline">
                          {r.code}
                        </Link>
                      ) : (
                        <span className="font-semibold">{r.code}</span>
                      )}
                      <div className="text-xs text-muted-foreground">{dmy(r.since)}</div>
                    </td>
                    <td className={TD}>
                      <StudentLink id={r.studentId} name={r.name} links={links} />
                      <div className="text-xs text-muted-foreground">{r.className}</div>
                    </td>
                    <td className={cn(TD, "max-w-md")}>
                      <div>{r.issue}</div>
                      {r.note && <div className="mt-0.5 text-xs text-foreground/70">↳ {r.note}</div>}
                      <div className="text-xs text-muted-foreground">{r.sourceLabel}</div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      {r.handler ?? <span className="text-muted-foreground">Chưa ai nhận</span>}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      <div className={cn(r.overdue && "font-semibold text-rose-600")}>{dmy(r.due || null)}</div>
                      {r.overdue && (
                        <div className="mt-1">
                          <Pill tone="red">Quá hạn</Pill>
                        </div>
                      )}
                    </td>
                    <td className={TD}>
                      {r.status === "doing" ? (
                        <Pill tone="blue">Đang xử lý</Pill>
                      ) : (
                        <Pill tone="amber">Mới</Pill>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Tình hình các lớp ---------------- */

export function ClassStatsCard({
  rows,
  loading,
  links,
  today,
  emptyText,
}: {
  rows: ClassStatRow[];
  loading: boolean;
  links: DashLinks;
  today: string;
  emptyText: string;
}) {
  const classSort = useSort(rows, {
    name: (r) => r.name,
    teacher: (r) => r.teacher,
    size: (r) => r.size,
    done: (r) => r.done,
    last: (r) => r.last,
    off: (r) => r.off,
    rate: (r) => r.rate,
    pending: (r) => r.pending,
  });
  const exportClasses = () => {
    downloadCSV(
      `tinh-hinh-lop-${today}.csv`,
      ["Lớp", "Lịch", "Giáo viên", "Sĩ số", "Đã dạy", "Buổi gần nhất", "Buổi nghỉ (30 ngày)", "Chuyên cần (%)", "Chưa cập nhật"],
      classSort.sorted.map((r) => [
        r.name,
        r.schedule,
        r.teacher,
        r.size,
        r.done,
        dmy(r.last),
        r.off,
        r.rate ?? "",
        r.pending,
      ]),
    );
  };
  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Tình hình các lớp"
        desc={`Chuyên cần, buổi nghỉ, buổi chưa chấm công / chưa điểm danh tính trong ${WINDOW_DAYS} ngày gần nhất.`}
        action={
          <button
            type="button"
            onClick={exportClasses}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
        }
      />
      {loading ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <Th k="name" {...classSort}>Lớp</Th>
                <Th k="teacher" {...classSort}>Giáo viên</Th>
                <Th k="size" {...classSort} align="right">Sĩ số</Th>
                <Th k="done" {...classSort} align="right">Đã dạy</Th>
                <Th k="last" {...classSort}>Buổi gần nhất</Th>
                <Th k="off" {...classSort} align="right">Buổi nghỉ</Th>
                <Th k="rate" {...classSort} align="right">Chuyên cần</Th>
                <Th k="pending" {...classSort} align="right">Chưa cập nhật</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {classSort.sorted.length === 0 ? (
                <EmptyRow cols={8}>
                  {emptyText}
                </EmptyRow>
              ) : (
                classSort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={TD}>
                      <Link href={links.class(r.id)} className="font-semibold text-brand-600 hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.schedule}</div>
                    </td>
                    <td className={TD}>{r.teacher}</td>
                    <td className={cn(TD, "text-right")}>{r.size}</td>
                    <td className={cn(TD, "text-right")}>{r.done}</td>
                    <td className={cn(TD, "whitespace-nowrap")}>{dmy(r.last)}</td>
                    <td className={cn(TD, "text-right", r.off > 0 && "font-semibold text-rose-600")}>{r.off}</td>
                    <td className={cn(TD, "text-right")}>{r.rate === null ? "—" : `${r.rate}%`}</td>
                    <td className={cn(TD, "text-right", r.pending > 0 && "font-semibold text-rose-600")}>
                      {r.pending}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Chưa nhận xét buổi học ---------------- */

/** Trang chi tiết buổi (điểm danh + nhận xét) — dùng chung cho GV và hành chính. */
export function sessionHref(sessionId: string, studentId?: string): string {
  return `/teacher/sessions/${sessionId}${studentId ? `?comment=${studentId}` : ""}`;
}

export function CommentDueCard({
  rows,
  loading,
  links,
  showTeacher,
  onChanged,
}: {
  rows: CommentDueRow[];
  loading: boolean;
  links: DashLinks;
  showTeacher: boolean;
  /** Đóng ngăn kéo chi tiết buổi → nạp lại bảng */
  onChanged?: () => void;
}) {
  const sort = useSort(
    rows,
    {
      date: (r) => `${r.date} ${r.start_time}`,
      className: (r) => r.className,
      teacher: (r) => r.teacher,
      missing: (r) => r.missing.length,
    },
    ["date", -1],
  );
  const cols = showTeacher ? 4 : 3;
  const total = rows.reduce((n, r) => n + r.missing.length, 0);
  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Học viên chưa nhận xét"
        desc={`Buổi đã dạy trong ${COMMENT_DAYS} ngày qua còn ${total} lượt học viên có mặt chưa được nhận xét. Bấm tên học viên để mở buổi học và viết nhận xét luôn.`}
      />
      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="date" {...sort}>Buổi học</Th>
                <Th k="className" {...sort}>Lớp</Th>
                {showTeacher && <Th k="teacher" {...sort}>Giáo viên</Th>}
                <Th k="missing" {...sort}>Chưa nhận xét</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sort.sorted.length === 0 ? (
                <EmptyRow cols={cols}>Các buổi gần đây đều đã nhận xét đủ 🎉</EmptyRow>
              ) : (
                sort.sorted.map((r) => (
                  <tr key={r.sessionId} className="hover:bg-brand-50/40">
                    <td className={cn(TD, "whitespace-nowrap")}>
                      <SessionLink
                        sessionId={r.sessionId}
                        onClose={onChanged}
                        className="font-semibold text-brand-600 hover:underline"
                      >
                        {dmy(r.date)}
                      </SessionLink>
                      <div className="text-xs text-muted-foreground">
                        {weekdayOf(r.date)} · {hm(r.start_time)}
                      </div>
                    </td>
                    <td className={TD}>
                      <Link href={links.class(r.classId)} className="font-semibold hover:text-brand-600 hover:underline">
                        {r.className}
                      </Link>
                    </td>
                    {showTeacher && <td className={TD}>{r.teacher}</td>}
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.missing.map((m) => (
                          <SessionLink
                            key={m.id}
                            sessionId={r.sessionId}
                            studentId={m.id}
                            onClose={onChanged}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:border-amber-400 hover:bg-amber-100"
                          >
                            {m.name}
                          </SessionLink>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {r.missing.length}/{r.attended}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
