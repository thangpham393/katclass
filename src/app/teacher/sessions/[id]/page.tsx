"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCheck, MessageSquarePlus, MessageSquareText, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
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
import {
  fetchLessons,
  fetchSessionLessons,
  setSessionLessons,
} from "@/lib/db-content";
import { useLoad } from "@/lib/use-load";

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

export default function TeacherSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { user } = useAuth();

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
        <Link href="/teacher" className="text-sm font-semibold text-brand-600">← Trang chủ</Link>
      </div>
    );
  }

  const s = session.data;
  const d = new Date(s.date + "T00:00:00");
  const markedCount = Object.values(rows).filter((r) => r.status).length;
  const totalCount = (students.data?.length ?? 0) + makeupStudents.length;

  return (
    <div className="space-y-6">
      <Link
        href={s.class ? `/teacher/classes/${s.class.id}` : "/teacher"}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {s.class?.name ?? "Trang chủ"}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Điểm danh — {s.class?.name ?? "Buổi học"}
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={markAllPresent} disabled={students.loading}>
            <CheckCheck className="h-4 w-4" /> Tất cả có mặt
          </Button>
          <Button variant="secondary" disabled={saving !== null} onClick={() => handleSave(false)}>
            {saving === "save" ? "Đang lưu..." : "Lưu điểm danh"}
          </Button>
          <Button disabled={saving !== null} onClick={() => handleSave(true)}>
            {saving === "complete" ? "Đang lưu..." : "Lưu & hoàn thành buổi"}
          </Button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Học viên trong lớp
            <Badge variant="muted" className="ml-2">{markedCount}/{totalCount} đã điểm danh</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
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
          <CardContent className="p-5 pt-0">
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

      <SessionContentCard sessionId={sessionId} courseId={s.class?.course?.id ?? null} />

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

/**
 * Nội dung ôn tập của buổi: chọn bài học (ưu tiên bài trong khóa của lớp)
 * để học viên xem lại từ vựng / ngữ pháp / slide sau buổi học.
 */
function SessionContentCard({
  sessionId,
  courseId,
}: {
  sessionId: string;
  courseId: string | null;
}) {
  const assigned = useLoad(() => fetchSessionLessons(sessionId), [sessionId]);
  const lessons = useLoad(() => fetchLessons(), []);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (assigned.data && selected === null) {
      setSelected(assigned.data.map((sl) => sl.lesson.id));
    }
  }, [assigned.data, selected]);

  const all = lessons.data ?? [];
  // Bài trong khóa của lớp lên trước, bài khác khóa xuống dưới
  const sorted = [...all].sort((a, b) => {
    const ax = a.course_id === courseId ? 0 : 1;
    const bx = b.course_id === courseId ? 0 : 1;
    return ax - bx;
  });
  const current = selected ?? [];
  const dirty =
    selected !== null &&
    assigned.data !== null &&
    JSON.stringify([...current].sort()) !==
      JSON.stringify(assigned.data.map((sl) => sl.lesson.id).sort());

  function toggle(id: string) {
    setNotice(null);
    setSelected((ids) => {
      const cur = ids ?? [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }

  async function handleSave() {
    if (selected === null) return;
    setSaving(true);
    setError(null);
    try {
      await setSessionLessons(sessionId, selected);
      assigned.reload();
      setNotice("Đã lưu nội dung ôn tập — học viên xem được ngay trong lớp của mình. ✓");
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" /> Nội dung ôn tập buổi này
          <Badge variant="muted">{current.length} bài</Badge>
        </CardTitle>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Đang lưu..." : "Lưu nội dung"}
        </Button>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {error && <ErrorNote message={error} />}
        {notice && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {notice}
          </div>
        )}
        {assigned.loading || lessons.loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : all.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có bài học nào trong thư viện — soạn bài ở mục “Bài học” trước.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {sorted.map((l) => {
              const picked = current.includes(l.id);
              const inCourse = l.course_id === courseId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all",
                    picked ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-200" : "hover:border-brand-300",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {l.unit != null ? `Bài ${l.unit}: ` : ""}
                      {l.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.course?.name ?? "Chưa gắn khóa"} · {l.lesson_vocab[0]?.count ?? 0} từ vựng
                    </div>
                  </div>
                  {inCourse && <Badge variant="gold">Khóa này</Badge>}
                  {picked && <Badge variant="jade">✓</Badge>}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Nhập nội dung nhận xét.");
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu nhận xét"}</Button>
        </div>
      </form>
    </Modal>
  );
}
