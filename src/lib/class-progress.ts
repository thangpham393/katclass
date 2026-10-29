import { todayISO, type ScheduleRow, type SessionRow } from "@/lib/db";

/**
 * Tiến độ một lớp: đã học bao nhiêu buổi, còn bao nhiêu, bắt đầu/kết thúc ngày nào.
 *
 * - "Đã học" = buổi đã chấm công + buổi đã qua ngày mà GV chưa chấm công
 *   (buổi đó gần như chắc đã dạy, chỉ thiếu thao tác) — tách riêng `pastPending`
 *   để nhắc chấm công.
 * - Ngày kết thúc: đã sinh đủ số buổi của khóa → ngày của buổi thứ N; chưa đủ →
 *   lấy buổi cuối đã sinh rồi đếm tiếp theo lịch tuần (`endProjected = true`).
 */
export interface ClassProgress {
  total: number | null; // số buổi của khóa (null = khóa không ghi)
  done: number;
  pastPending: number;
  upcoming: number; // đã sinh, chưa tới ngày
  learned: number; // done + pastPending
  remaining: number | null; // total - learned
  notGenerated: number; // số buổi còn thiếu chưa sinh (0 nếu không biết total)
  startDate: string | null;
  endDate: string | null;
  endProjected: boolean;
}

export interface ProgressInput {
  total: number | null | undefined;
  classStartDate: string | null;
  firstDate: string | null;
  lastDate: string | null;
  done: number;
  pastPending: number;
  upcoming: number;
  /** Ngày của buổi thứ `total` (không tính buổi hủy), nếu đã sinh tới đó. */
  nthDate?: string | null;
  schedules: Pick<ScheduleRow, "weekday">[];
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Đếm tiếp `count` buổi theo lịch tuần, bắt đầu từ ngày sau `after`; trả về ngày buổi cuối. */
function projectEnd(after: string, count: number, schedules: Pick<ScheduleRow, "weekday">[]): string | null {
  if (!schedules.length || count <= 0) return null;
  const cursor = new Date(after + "T00:00:00");
  let left = count;
  for (let i = 0; i < 366 * 3; i++) {
    cursor.setDate(cursor.getDate() + 1);
    left -= schedules.filter((s) => s.weekday === cursor.getDay()).length;
    if (left <= 0) return isoOf(cursor);
  }
  return null;
}

export function computeClassProgress(p: ProgressInput): ClassProgress {
  const total = p.total || null;
  const learned = p.done + p.pastPending;
  const generated = learned + p.upcoming;
  const notGenerated = total ? Math.max(0, total - generated) : 0;

  let endDate = p.lastDate;
  let endProjected = false;
  if (total && notGenerated > 0) {
    const today = todayISO(-1);
    const base = p.lastDate && p.lastDate > today ? p.lastDate : today;
    endDate = projectEnd(base, notGenerated, p.schedules);
    endProjected = true;
  } else if (total && p.nthDate) {
    endDate = p.nthDate;
  }

  return {
    total,
    done: p.done,
    pastPending: p.pastPending,
    upcoming: p.upcoming,
    learned,
    remaining: total ? Math.max(0, total - learned) : null,
    notGenerated,
    startDate: p.firstDate ?? p.classStartDate,
    endDate,
    endProjected,
  };
}

/** Tiến độ từ danh sách buổi đầy đủ của lớp (trang chi tiết). */
export function progressFromSessions(
  sessions: Pick<SessionRow, "date" | "status">[],
  opts: { total: number | null | undefined; classStartDate: string | null; schedules: Pick<ScheduleRow, "weekday">[] },
): ClassProgress {
  const today = todayISO();
  const live = sessions.filter((s) => s.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date));
  return computeClassProgress({
    ...opts,
    firstDate: live[0]?.date ?? null,
    lastDate: live[live.length - 1]?.date ?? null,
    done: live.filter((s) => s.status === "completed").length,
    pastPending: live.filter((s) => s.status === "scheduled" && s.date < today).length,
    upcoming: live.filter((s) => s.status === "scheduled" && s.date >= today).length,
    nthDate: opts.total ? live[opts.total - 1]?.date ?? null : null,
  });
}

export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("vi-VN") : "—";
}
