"use client";

/**
 * Phép tính của bảng điều khiển — dùng chung cho trang admin (cả trung tâm,
 * lọc được theo GV) và trang chủ giáo viên (chỉ lớp/buổi của chính GV đó).
 */

import { WEEKDAY_LABELS, todayISO } from "./db";
import {
  ABSENT_WARN,
  MISSING_WARN,
  SCORE_WARN,
  WINDOW_DAYS,
  hasLog,
  isOverdueLog,
  COMMENT_DAYS,
  isUnmarked,
  type DashClass,
  type DashSession,
  type DashboardData,
} from "./db-dashboard";
import {
  CARE_SOURCE_LABELS,
  careCode,
  isCareOverdue,
  type CareRequestRow,
} from "./db-care-requests";
import { hm, pct } from "@/components/dashboard/kit";
import { computeClassProgress } from "./class-progress";

/** Lịch tuần rút gọn: "T3, T5 · 18h00". */
export function shortSchedule(c: Pick<DashClass, "class_schedules">): string {
  const s = c.class_schedules.slice().sort((a, b) => a.weekday - b.weekday);
  if (!s.length) return "Chưa xếp lịch";
  return `${s.map((x) => WEEKDAY_LABELS[x.weekday]).join(", ")} · ${hm(s[0].start_time)}`;
}

/* ---------------- Trang ---------------- */

export interface AttentionRow {
  id: string;
  name: string;
  className: string;
  absent: number;
  missing: number;
  avg: number | null;
  flags: ("absent" | "missing" | "score")[];
}

export interface ClassStatRow {
  id: string;
  name: string;
  schedule: string;
  teacher: string;
  size: number;
  done: number;
  last: string | null;
  off: number;
  rate: number | null;
  pending: number;
}

export interface CareRow {
  id: string;
  studentId: string;
  code: string;
  since: string;
  name: string;
  className: string;
  issue: string;
  note: string | null;
  sourceLabel: string;
  handler: string | null;
  due: string;
  overdue: boolean;
  status: "new" | "doing";
}


/**
 * `teacher` lọc buổi theo GV đứng buổi; `scopeClasses` = có lọc luôn lớp theo
 * GV chính hay không (trang GV đã tự nạp đúng lớp của mình, kể cả lớp đồng
 * phụ trách, nên tắt đi).
 */
export function computeDashboard(
  data: DashboardData,
  opts: { today: string; teacher?: string; scopeClasses?: boolean },
) {
  const { today, teacher = "" } = opts;
  const scope = opts.scopeClasses ?? true;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  const classes = data.classes.filter((c) => !scope || !teacher || c.teacher?.id === teacher);
  const sessions = data.sessions.filter((s) => !teacher || s.teacher?.id === teacher);
  const held = sessions.filter((s) => s.status !== "cancelled");

  /* Buổi chưa cập nhật: quá hạn chấm công, hoặc chấm công rồi mà chưa điểm danh */
  const overdue = sessions.filter((s) => isOverdueLog(s, now) || isUnmarked(s));

  /* Chuyên cần 30 ngày */
  let present = 0;
  let marked = 0;
  for (const s of held) {
    for (const a of s.attendance) {
      marked++;
      if (a.status === "present" || a.status === "makeup") present++;
    }
  }

  /* Học viên cần chú ý — chỉ học viên đang học trong các lớp đang xét */
  const absentOf = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.status === "cancelled") continue;
    for (const a of s.attendance) {
      if (a.status === "absent_excused" || a.status === "absent_unexcused") {
        absentOf.set(a.student_id, (absentOf.get(a.student_id) ?? 0) + 1);
      }
    }
  }
  const hwByClass = new Map<string, typeof data.homeworks>();
  for (const h of data.homeworks) {
    const list = hwByClass.get(h.class_id) ?? [];
    list.push(h);
    hwByClass.set(h.class_id, list);
  }
  const students = new Map<string, AttentionRow & { scores: number[] }>();
  for (const c of classes) {
    for (const cs of c.class_students) {
      if (cs.status !== "active" || !cs.student || cs.student.study_status === "left") continue;
      const row = students.get(cs.student_id) ?? {
        id: cs.student_id,
        name: cs.student.name,
        className: c.name,
        absent: absentOf.get(cs.student_id) ?? 0,
        missing: 0,
        avg: null,
        flags: [],
        scores: [],
      };
      for (const h of hwByClass.get(c.id) ?? []) {
        const sub = h.submissions.find((x) => x.student_id === cs.student_id);
        if (sub) {
          const sc = sub.score ?? sub.auto_score;
          if (sc !== null && new Date(sub.submitted_at) >= windowStart) row.scores.push(Number(sc));
        } else if (
          h.due_at &&
          new Date(h.due_at) <= now &&
          new Date(h.due_at) >= windowStart &&
          cs.joined_at <= h.due_at.slice(0, 10)
        ) {
          row.missing++;
        }
      }
      students.set(cs.student_id, row);
    }
  }
  const attention: AttentionRow[] = [];
  for (const r of students.values()) {
    r.avg = r.scores.length
      ? Math.round((r.scores.reduce((a, b) => a + b, 0) / r.scores.length) * 10) / 10
      : null;
    if (r.absent >= ABSENT_WARN) r.flags.push("absent");
    if (r.missing >= MISSING_WARN) r.flags.push("missing");
    if (r.avg !== null && r.avg < SCORE_WARN) r.flags.push("score");
    if (r.flags.length) {
      const { scores: _s, ...rest } = r;
      attention.push(rest);
    }
  }
  attention.sort((a, b) => b.flags.length - a.flags.length || b.absent - a.absent);

  /* Tình hình các lớp */
  const classRows: ClassStatRow[] = classes.map((c) => {
    const cs = data.sessions.filter((s) => s.class?.id === c.id);
    const live = cs.filter((s) => s.status !== "cancelled");
    let p = 0;
    let m = 0;
    for (const s of live) {
      for (const a of s.attendance) {
        m++;
        if (a.status === "present" || a.status === "makeup") p++;
      }
    }
    return {
      id: c.id,
      name: c.name,
      schedule: shortSchedule(c),
      teacher: c.teacher?.name ?? "—",
      size: c.class_students.filter((x) => x.status === "active").length,
      done: data.progressByClass[c.id]?.done ?? 0,
      // sessions xếp mới → cũ nên buổi đầu tiên đã diễn ra là buổi gần nhất
      last: live.find((s) => hasLog(s) || s.date < today)?.date ?? null,
      off: cs.length - live.length,
      rate: pct(p, m),
      pending: cs.filter((s) => isOverdueLog(s, now) || isUnmarked(s)).length,
    };
  });

  /*
   * Học viên đang học + số buổi còn lại THEO TIẾN ĐỘ LỚP (tổng buổi khóa − đã
   * học). Dùng cho em chưa có gói học phí trên app (học phí nhập nơi khác).
   * Học nhiều lớp thì lấy lớp còn nhiều buổi nhất — em vẫn đang theo học.
   */
  const classLeft = new Map<string, number | null>();
  for (const c of classes) {
    const p = data.progressByClass[c.id];
    classLeft.set(
      c.id,
      computeClassProgress({
        total: c.course?.total_sessions,
        classStartDate: c.course_started_on ?? c.start_date,
        firstDate: p?.first_date ?? null,
        lastDate: p?.last_date ?? null,
        done: p?.done ?? 0,
        pastPending: p?.past_pending ?? 0,
        upcoming: p?.upcoming ?? 0,
        schedules: c.class_schedules,
      }).remaining,
    );
  }
  const studentInfo = new Map<
    string,
    { name: string; code: string | null; className: string; classLeft: number | null }
  >();
  for (const c of classes) {
    const left = classLeft.get(c.id) ?? null;
    for (const cs of c.class_students) {
      if (cs.status !== "active" || !cs.student || cs.student.study_status === "left") continue;
      const cur = studentInfo.get(cs.student_id);
      if (!cur) {
        studentInfo.set(cs.student_id, {
          name: cs.student.name,
          code: cs.student.student_code,
          className: c.name,
          classLeft: left,
        });
      } else if (left !== null && (cur.classLeft === null || left > cur.classLeft)) {
        cur.classLeft = left;
        cur.className = c.name;
      }
    }
  }

  return {
    overdue,
    unmarked: overdue.filter(isUnmarked).length,
    classes,
    sessions,
    studentInfo,
    attendanceRate: pct(present, marked),
    classCount: classes.length,
    studentCount: students.size,
    attention,
    classRows,
    classIds: new Set(classes.map((c) => c.id)),
    classOfStudent: new Map(
      classes.flatMap((c) =>
        c.class_students.filter((x) => x.status === "active").map((x) => [x.student_id, c.name] as const),
      ),
    ),
  };
}

export type DashComputed = ReturnType<typeof computeDashboard>;

/** Phiếu chăm sóc → dòng bảng; `classIds` (khi lọc GV) giữ phiếu của lớp đó. */
export function careRowsOf(
  list: CareRequestRow[],
  classIds: Set<string> | null,
  today: string,
): CareRow[] {
  return list
    .filter((r) => !classIds || (r.class_id && classIds.has(r.class_id)))
    .map((r) => ({
      id: r.id,
      studentId: r.student_id,
      code: careCode(r.no),
      since: r.created_at.slice(0, 10),
      name: r.student?.name ?? "—",
      className: [r.class?.name, r.class?.teacher?.name].filter(Boolean).join(" · ") || "—",
      issue: r.issue,
      note: r.note,
      sourceLabel: CARE_SOURCE_LABELS[r.source],
      handler: r.assignee?.name ?? null,
      due: r.due_date ?? "",
      overdue: isCareOverdue(r, today),
      status: r.status === "new" ? "new" : "doing",
    }));
}

export interface CommentDueRow {
  sessionId: string;
  date: string;
  start_time: string;
  classId: string;
  className: string;
  teacherId: string | null;
  teacher: string;
  /** Có mặt / học bù mà chưa có nhận xét buổi. */
  missing: { id: string; name: string }[];
  attended: number;
}

/**
 * Buổi đã dạy (có điểm danh) trong `COMMENT_DAYS` ngày còn học viên có mặt
 * chưa được nhận xét. Học viên vắng thì không cần nhận xét buổi đó.
 */
export function commentDueRows(sessions: DashSession[], today: string): CommentDueRow[] {
  const from = todayISO(-COMMENT_DAYS);
  const rows: CommentDueRow[] = [];
  for (const s of sessions) {
    if (s.status === "cancelled" || !s.class || s.date < from || s.date > today) continue;
    const done = new Set(s.session_comments.map((x) => x.student_id));
    const attended = s.attendance.filter((a) => a.status === "present" || a.status === "makeup");
    const missing = attended
      .filter((a) => !done.has(a.student_id))
      .map((a) => ({ id: a.student_id, name: a.student?.name ?? "Học viên" }));
    if (!missing.length) continue;
    rows.push({
      sessionId: s.id,
      date: s.date,
      start_time: s.start_time,
      classId: s.class.id,
      className: s.class.name,
      teacherId: s.teacher?.id ?? null,
      teacher: s.teacher?.name ?? "—",
      missing,
      attended: attended.length,
    });
  }
  return rows;
}
