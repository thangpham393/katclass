"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCheck, ListChecks, MessageSquarePlus, MessageSquareText, NotebookPen, Pencil, Star, Timer } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { homeForRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  fetchSession,
  fetchClassStudents,
  fetchSessionAttendance,
  fetchSessionComments,
  fetchMakeupForSession,
  saveAttendance,
  updateSessionStatus,
  upsertSessionComment,
  dbErrorMessage,
  ATTENDANCE_LABELS,
  WEEKDAY_LABELS,
  type AttendanceStatus,
  type SessionCommentRow,
} from "@/lib/db";
import { SessionContentCard } from "@/components/session-content-card";
import { PrepareLink } from "@/components/session-prepare";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { Pill } from "@/components/ui/table-kit";
import { fetchTeachingLog, sessionHours, PROGRESS_LABELS, PROGRESS_TONE } from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";
import { fetchSessionParentFlags, flagParentContact } from "@/lib/db-care-requests";
import { ParentContactField, type ParentContact } from "@/components/parent-contact-field";
import { EnterClassroomButton } from "@/components/classroom/warp-transition";
import { ClassLessonLog } from "@/components/classes/class-lesson-log";

const STATUS_ORDER: AttendanceStatus[] = ["present", "absent_excused", "absent_unexcused", "makeup"];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white",
  absent_excused: "border-gold-600 bg-gold-600 text-white",
  absent_unexcused: "border-destructive bg-destructive text-white",
  makeup: "border-sky-600 bg-sky-600 text-white",
};

interface RowState {
  status?: AttendanceStatus;
  note: string;
}

/**
 * Nội dung chi tiết buổi học (điểm danh, nhận xét, chấm công, nội dung dạy) —
 * dùng chung cho trang /teacher/sessions/[id] và ngăn kéo trượt từ phải
 * (SessionDrawer) mở từ thời khóa biểu / trang chủ.
 *
 * `commentStudentId`: bật sẵn ô nhận xét cho học viên này khi danh sách đã nạp,
 * xong gọi `onCommentOpened` để nơi gọi dọn tham số.
 */
export function SessionDetail({
  sessionId,
  commentStudentId,
  onCommentOpened,
  inDrawer,
}: {
  sessionId: string;
  commentStudentId?: string | null;
  onCommentOpened?: () => void;
  inDrawer?: boolean;
}) {
  const { user } = useAuth();
  // Hành chính mở buổi từ thời khóa biểu → đường lui về khu quản trị của họ
  const staff = user?.role === "admin" || user?.role === "staff";
  const home = homeForRole(user?.role ?? "teacher");
  const classHref = (id: string) => (staff ? `/admin/classes/${id}` : `/teacher/classes/${id}`);

  const session = useLoad(() => fetchSession(sessionId), [sessionId]);
  const classId = session.data?.class_id ?? "";
  const students = useLoad(
    () => (classId ? fetchClassStudents(classId) : Promise.resolve([])),
    [classId],
  );
  const attendance = useLoad(() => fetchSessionAttendance(sessionId), [sessionId]);
  const comments = useLoad(() => fetchSessionComments(sessionId), [sessionId]);
  const makeups = useLoad(() => fetchMakeupForSession(sessionId), [sessionId]);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState<"save" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<{ id: string; name: string } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  // Chọn bài trong modal Chuẩn bị bài xong → dựng lại thẻ nội dung buổi để nạp bài mới
  const [contentKey, setContentKey] = useState(0);
  const log = useLoad(() => fetchTeachingLog(sessionId), [sessionId]);

  // Nạp điểm danh đã có vào state khi dữ liệu về
  useEffect(() => {
    if (!attendance.data) return;
    setRows((prev) => {
      const next = { ...prev };
      for (const a of attendance.data!) {
        next[a.student_id] = { status: a.status, note: a.note ?? "" };
      }
      return next;
    });
  }, [attendance.data]);

  const commentByStudent = useMemo(() => {
    const map = new Map<string, SessionCommentRow>();
    for (const c of comments.data ?? []) map.set(c.student_id, c);
    return map;
  }, [comments.data]);

  // Học viên học bù: có quyền học bù trỏ vào buổi này nhưng không thuộc lớp
  const memberIds = new Set((students.data ?? []).map((s) => s.student_id));
  const makeupStudents = (makeups.data ?? []).filter((m) => !memberIds.has(m.student.id));

  // Mở từ bảng "Chưa nhận xét buổi học" → bật luôn ô nhận xét cho em đó
  // khi danh sách đã nạp xong (mỗi lần mở chỉ bật một lần)
  const [commentTarget, setCommentTarget] = useState(commentStudentId ?? null);
  useEffect(() => {
    if (!commentTarget || students.loading || makeups.loading || comments.loading) return;
    const member = (students.data ?? []).find((st) => st.student_id === commentTarget);
    const makeup = (makeups.data ?? []).find((m) => m.student.id === commentTarget);
    const name = member?.student.name ?? makeup?.student.name;
    if (name) setCommentFor({ id: commentTarget, name });
    setCommentTarget(null);
    onCommentOpened?.();
  }, [commentTarget, students.loading, students.data, makeups.loading, makeups.data, comments.loading, onCommentOpened]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { note: prev[studentId]?.note ?? "", status },
    }));
    setNotice(null);
  }

  function setNote(studentId: string, note: string) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { status: prev[studentId]?.status, note },
    }));
  }

  function markAllPresent() {
    setRows((prev) => {
      const next = { ...prev };
      for (const s of students.data ?? []) {
        if (!next[s.student_id]?.status) {
          next[s.student_id] = { note: next[s.student_id]?.note ?? "", status: "present" };
        }
      }
      return next;
    });
    setNotice(null);
  }

  async function handleSave(complete: boolean) {
    if (!user) return;
    const records = Object.entries(rows)
      .filter(([, r]) => r.status)
      .map(([student_id, r]) => ({
        student_id,
        status: r.status!,
        note: r.note.trim() || null,
      }));
    if (!records.length) {
      setError("Chưa chọn trạng thái điểm danh cho học viên nào.");
      return;
    }
    setSaving(complete ? "complete" : "save");
    setError(null);
    setNotice(null);
    try {
      await saveAttendance(sessionId, records, user.id);
      if (complete && session.data?.status !== "completed") {
        await updateSessionStatus(sessionId, "completed");
        session.reload();
      }
      attendance.reload();
      makeups.reload();
      setNotice(complete ? "Đã lưu điểm danh và hoàn thành buổi học. ✓" : "Đã lưu điểm danh. ✓");
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  if (session.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (session.error) return <ErrorNote message={session.error} />;
  if (!session.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy buổi học này (hoặc bạn không có quyền xem)." />
        <Link href={home} className="text-sm font-semibold text-brand-600">← Trang chủ</Link>
      </div>
    );
  }

  const s = session.data;
  const d = new Date(s.date + "T00:00:00");
  const markedCount = Object.values(rows).filter((r) => r.status).length;
  const totalCount = (students.data?.length ?? 0) + makeupStudents.length;

  return (
    <div className={inDrawer ? "space-y-5" : "space-y-6"}>
      {/* Trong ngăn kéo thanh đầu đã có nút đóng nên chỉ giữ link sang trang lớp */}
      {(!inDrawer || s.class) && (
        <Link
          href={s.class ? classHref(s.class.id) : home}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {!inDrawer && <ArrowLeft className="h-4 w-4" />} {s.class?.name ?? "Trang chủ"}
          {inDrawer && " →"}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={cn("font-extrabold tracking-tight", inDrawer ? "text-xl" : "text-2xl")}>
            Điểm danh — {s.class?.name ?? (s.type === "makeup" ? "Buổi học bù riêng" : "Buổi học")}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
            </span>
            <span>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
            {s.room && <span>· Phòng {s.room.name}</span>}
            {s.session_no && s.class?.course?.total_sessions ? (
              <span>· Buổi {s.session_no}/{s.class.course.total_sessions}</span>
            ) : s.session_no ? (
              <span>· Buổi {s.session_no}</span>
            ) : null}
            <Badge variant={s.status === "completed" ? "jade" : "gold"}>
              {s.status === "completed" ? "Đã hoàn thành" : "Chưa hoàn thành"}
            </Badge>
            {log.data ? (
              <Badge variant="jade">
                Đã chấm công {log.data.actual_start.slice(0, 5)}–{log.data.actual_end.slice(0, 5)} ·{" "}
                {sessionHours({ start_time: log.data.actual_start, end_time: log.data.actual_end })}h
              </Badge>
            ) : (
              !log.loading && <Badge variant="gold">Chưa chấm công</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnterClassroomButton sessionId={sessionId} />
          <PrepareLink sessionId={sessionId} onClose={() => setContentKey((k) => k + 1)}>
            <Button variant="outline">
              <ListChecks className="h-4 w-4" /> Chuẩn bị bài
            </Button>
          </PrepareLink>
          <Button variant={log.data ? "ghost" : "gold"} onClick={() => setLogOpen(true)}>
            <Timer className="h-4 w-4" /> {log.data ? "Sửa chấm công" : "Chấm công ca dạy"}
          </Button>
          <Button disabled={saving !== null} onClick={() => handleSave(true)}>
            {saving === "complete" ? "Đang lưu..." : "Lưu & hoàn thành buổi"}
          </Button>
        </div>
      </div>

      {log.data && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-brand-600" /> Báo cáo buổi học
              {log.data.progress ? (
                <Pill tone={PROGRESS_TONE[log.data.progress]}>{PROGRESS_LABELS[log.data.progress]}</Pill>
              ) : (
                <Pill tone="muted">Chưa đánh giá tiến độ</Pill>
              )}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Sửa
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0 text-sm sm:grid-cols-2 sm:p-5 sm:pt-0">
            {[
              ["Nội dung đã dạy", log.data.lesson_content],
              ["Bài tập về nhà đã giao", log.data.homework_note],
              ["Dự kiến buổi sau", log.data.next_plan],
              ["Ghi chú", log.data.note],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-secondary/30 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                <div className="mt-1 whitespace-pre-line">
                  {value?.trim() || <span className="italic text-muted-foreground">Chưa ghi</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {s.class && (
        <ClassLessonLog classId={s.class.id} before={s.date} title="Các buổi trước đã dạy" pageSize={3} />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            Học viên trong lớp
            <Badge variant="muted" className="ml-2">{markedCount}/{totalCount} đã điểm danh</Badge>
          </CardTitle>
          {/* Nút điểm danh đặt ngay trên danh sách — chọn trạng thái xong lưu luôn tại chỗ */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={markAllPresent} disabled={students.loading}>
              <CheckCheck className="h-4 w-4" /> Tất cả có mặt
            </Button>
            <Button size="sm" variant="secondary" disabled={saving !== null} onClick={() => handleSave(false)}>
              {saving === "save" ? "Đang lưu..." : "Lưu điểm danh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          {error && <ErrorNote message={error} />}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}
          {students.loading || attendance.loading ? (
            <LoadingRows rows={5} className="p-0" />
          ) : (students.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Lớp chưa có học viên nào.
            </div>
          ) : (
            <div className="divide-y">
              {students.data!.map((st) => (
                <StudentRow
                  key={st.student_id}
                  studentId={st.student_id}
                  name={st.student.name}
                  avatar={st.student.avatar}
                  sub={st.student.phone ?? st.student.email}
                  row={rows[st.student_id]}
                  comment={commentByStudent.get(st.student_id)}
                  onStatus={setStatus}
                  onNote={setNote}
                  onComment={() => setCommentFor({ id: st.student_id, name: st.student.name })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {makeupStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Học viên học bù buổi này
              <Badge variant="muted" className="ml-2">{makeupStudents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="divide-y">
              {makeupStudents.map((m) => (
                <StudentRow
                  key={m.student.id}
                  studentId={m.student.id}
                  name={m.student.name}
                  avatar={m.student.avatar}
                  sub={`Bù cho buổi vắng ${m.missed_session ? new Date(m.missed_session.date + "T00:00:00").toLocaleDateString("vi-VN") : ""} · ${m.missed_session?.class?.name ?? ""}`}
                  row={rows[m.student.id]}
                  comment={commentByStudent.get(m.student.id)}
                  onStatus={setStatus}
                  onNote={setNote}
                  onComment={() => setCommentFor({ id: m.student.id, name: m.student.name })}
                  makeupOnly
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <SessionContentCard
        key={contentKey}
        sessionId={sessionId}
        courseId={s.class?.course?.id ?? null}
        textbook={s.class?.textbook ?? null}
      />

      <TeachingLogModal
        session={logOpen ? s : null}
        log={log.data}
        currentUserId={user?.id ?? ""}
        onClose={() => setLogOpen(false)}
        onSaved={() => {
          log.reload();
          session.reload();
        }}
      />

      {commentFor && user && (
        <CommentModal
          sessionId={sessionId}
          teacherId={user.id}
          student={commentFor}
          existing={commentByStudent.get(commentFor.id)}
          onClose={() => setCommentFor(null)}
          onSaved={() => {
            setCommentFor(null);
            comments.reload();
          }}
        />
      )}
    </div>
  );
}

function StudentRow({
  studentId,
  name,
  avatar,
  sub,
  row,
  comment,
  onStatus,
  onNote,
  onComment,
  makeupOnly,
}: {
  studentId: string;
  name: string;
  avatar?: string | null;
  sub?: string;
  row?: RowState;
  comment?: SessionCommentRow;
  onStatus: (studentId: string, status: AttendanceStatus) => void;
  onNote: (studentId: string, note: string) => void;
  onComment: () => void;
  makeupOnly?: boolean;
}) {
  const statuses = makeupOnly ? (["makeup", "absent_unexcused"] as AttendanceStatus[]) : STATUS_ORDER;
  const showNote = row?.status === "absent_excused" || row?.status === "absent_unexcused";

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} src={avatar ?? undefined} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatus(studentId, st)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                row?.status === st
                  ? STATUS_STYLE[st]
                  : "border-input bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {ATTENDANCE_LABELS[st]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onComment}
          title={comment ? "Sửa nhận xét" : "Nhận xét học viên"}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border transition-colors",
            comment
              ? "border-brand-200 bg-brand-50 text-brand-600"
              : "border-input text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {comment ? <MessageSquareText className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
        </button>
      </div>
      {showNote && (
        <div className="mt-2 pl-12">
          <Input
            value={row?.note ?? ""}
            onChange={(e) => onNote(studentId, e.target.value)}
            placeholder="Ghi chú (lý do vắng...)"
            className="h-8 max-w-md text-xs"
          />
        </div>
      )}
    </div>
  );
}

function CommentModal({
  sessionId,
  teacherId,
  student,
  existing,
  onClose,
  onSaved,
}: {
  sessionId: string;
  teacherId: string;
  student: { id: string; name: string };
  existing?: SessionCommentRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(existing?.content ?? "");
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flags = useLoad(() => fetchSessionParentFlags(sessionId), [sessionId]);
  const flag = flags.data?.get(student.id);
  const [contact, setContact] = useState<ParentContact>({ on: false, note: "" });
  useEffect(() => {
    if (flag) setContact({ on: true, note: flag.issue });
  }, [flag]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Nhập nội dung nhận xét.");
      return;
    }
    if (contact.on && !contact.note.trim()) {
      setError("Ghi nội dung cần CSKH trao đổi với phụ huynh.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertSessionComment({
        session_id: sessionId,
        student_id: student.id,
        teacher_id: teacherId,
        content: content.trim(),
        rating: rating || null,
      });
      if (contact.on || flag) await flagParentContact(sessionId, student.id, contact.on ? contact.note : "");
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Nhận xét — ${student.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        {existing?.author && existing.author.id !== teacherId && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Nhận xét của <b className="text-foreground">{existing.author.name}</b>. Sửa và lưu thì nhận xét
            chuyển sang tên bạn.
          </p>
        )}
        <div>
          <span className="text-sm font-medium">Đánh giá buổi học</span>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                className="p-0.5"
                title={`${n} sao`}
              >
                <Star
                  className={cn(
                    "h-7 w-7 transition-colors",
                    n <= rating ? "fill-gold-500 text-gold-500" : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-sm font-medium">Nhận xét (phụ huynh xem được)</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Hôm nay con học tốt phần từ vựng, cần luyện thêm phát âm thanh 3..."
            className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <ParentContactField value={contact} onChange={setContact} status={flag?.status} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving || flags.loading}>{saving ? "Đang lưu..." : "Lưu nhận xét"}</Button>
        </div>
      </form>
    </Modal>
  );
}
