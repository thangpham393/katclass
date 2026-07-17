"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ClipboardList, Timer, Trash2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, fetchClassStudents } from "@/lib/db";
import {
  deleteHomework,
  fetchHomework,
  fetchHomeworkSubmissions,
  fetchTestAttempts,
  attemptDeadline,
  questionPreview,
  QUESTION_TYPE_LABELS,
} from "@/lib/db-content";
import { pct } from "@/lib/utils";

export default function TeacherHomeworkDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const homeworkId = params.id;

  const homework = useLoad(() => fetchHomework(homeworkId), [homeworkId]);
  const submissions = useLoad(() => fetchHomeworkSubmissions(homeworkId), [homeworkId]);
  const isTest = homework.data?.kind === "test";
  const attempts = useLoad(
    () => (isTest ? fetchTestAttempts(homeworkId) : Promise.resolve([])),
    [homeworkId, isTest],
  );
  const classId = homework.data?.class_id ?? "";
  const students = useLoad(
    () => (classId ? fetchClassStudents(classId) : Promise.resolve([])),
    [classId],
  );

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Xóa bài tập này? Toàn bộ bài nộp và điểm của học viên sẽ bị xóa theo.")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteHomework(homeworkId);
      router.replace("/teacher/homework");
    } catch (e) {
      setError(dbErrorMessage(e));
      setDeleting(false);
    }
  }

  if (homework.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (homework.error) return <ErrorNote message={homework.error} />;
  if (!homework.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy bài tập này." />
        <Link href="/teacher/homework" className="text-sm font-semibold text-brand-600">← Bài tập</Link>
      </div>
    );
  }

  const hw = homework.data;
  const subs = submissions.data ?? [];
  const subByStudent = new Map(subs.map((s) => [s.student_id, s]));
  const roster = students.data ?? [];
  const notSubmitted = roster.filter((st) => !subByStudent.has(st.student_id));
  // Bài kiểm tra: HV đã bắt đầu nhưng chưa nộp — đang làm hay đã quá giờ?
  const attemptByStudent = new Map((attempts.data ?? []).map((a) => [a.student_id, a]));
  const pendingAttempts = (attempts.data ?? []).filter((a) => !subByStudent.has(a.student_id));
  const scores = subs.map((s) => s.score).filter((s): s is number => s != null);
  const avg = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/teacher/homework"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Bài tập
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{hw.title}</h1>
            {hw.kind === "test" && (
              <Badge variant="destructive">
                <Timer className="h-3 w-3" /> Kiểm tra · {hw.time_limit_minutes} phút
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{hw.class?.name}</span>
            <span>· {hw.questions.length} câu</span>
            {hw.kind === "test" && hw.open_at && (
              <span>
                · Mở đề {new Date(hw.open_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            {hw.due_at && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {hw.kind === "test" ? "Hạn vào làm" : "Hạn"}{" "}
                {new Date(hw.due_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          className="text-rose-600 hover:bg-rose-50"
          disabled={deleting}
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" /> {deleting ? "Đang xóa..." : "Xóa bài tập"}
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Sĩ số lớp" value={roster.length} icon={Users} accent="brand" />
        <StatCard label="Đã nộp" value={`${subs.length}/${roster.length}`} icon={ClipboardList} accent="gold" />
        <StatCard label="Tỷ lệ nộp" value={roster.length ? `${pct(subs.length, roster.length)}%` : "—"} accent="sky" />
        <StatCard label="Điểm trung bình" value={avg ?? "—"} accent="jade" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bài nộp */}
        <Card>
          <CardHeader>
            <CardTitle>
              Bài nộp <Badge variant="muted" className="ml-1">{subs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {submissions.loading ? (
              <LoadingRows rows={3} className="p-0" />
            ) : subs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có học viên nào nộp bài.
              </div>
            ) : (
              <div className="divide-y">
                {subs.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={s.student?.name ?? "?"} src={s.student?.avatar ?? undefined} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.student?.name ?? "Học viên"}</div>
                      <div className="text-xs text-muted-foreground">
                        Nộp {new Date(s.submitted_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`text-lg font-extrabold ${
                          (s.score ?? 0) >= 8 ? "text-emerald-600" : (s.score ?? 0) >= 5 ? "text-gold-600" : "text-rose-600"
                        }`}
                      >
                        {s.score ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground"> / 10</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {notSubmitted.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Chưa nộp ({notSubmitted.length})
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {notSubmitted.map((st) => {
                    // Với bài kiểm tra: phân biệt chưa bắt đầu / đang làm / quá giờ không nộp
                    const att = hw.kind === "test" ? attemptByStudent.get(st.student_id) : undefined;
                    const expired =
                      att && hw.time_limit_minutes != null
                        ? Date.now() > attemptDeadline(att, hw.time_limit_minutes) + 60_000
                        : false;
                    return (
                      <Badge
                        key={st.student_id}
                        variant={expired ? "destructive" : att ? "gold" : "muted"}
                      >
                        {st.student.name}
                        {expired ? " · quá giờ, không nộp" : att ? " · đang làm" : ""}
                      </Badge>
                    );
                  })}
                </div>
                {hw.kind === "test" && pendingAttempts.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    “Quá giờ, không nộp” = đã bấm bắt đầu nhưng không nộp trong thời gian cho phép.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Câu hỏi trong bài */}
        <Card>
          <CardHeader>
            <CardTitle>
              Câu hỏi <Badge variant="muted" className="ml-1">{hw.questions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="divide-y">
              {hw.questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="zh truncate text-sm">{questionPreview(q) || "(chưa có đề bài)"}</div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
