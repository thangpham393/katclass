"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FileQuestion,
  HelpCircle,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, LEVEL_LABELS } from "@/lib/db";
import { TextbookCover } from "@/components/library/textbook-cover";
import {
  fetchQuestionAnswers,
  fetchQuestions,
  questionPreview,
  QUESTION_TYPE_LABELS,
  type QuestionAnswer,
  type QuestionRow,
} from "@/lib/db-content";
import {
  fetchTextbookLessons,
  fetchTextbooks,
  importTextbook,
  type TextbookImportPayload,
  type TextbookImportResult,
  type TextbookLessonRow,
} from "@/lib/db-library";

function answerPreview(q: QuestionRow, a: QuestionAnswer | undefined): string {
  if (a === undefined) return "—";
  if (typeof a === "string") return a;
  if (Array.isArray(a)) return a.join(q.type === "reorder" ? "" : ", ");
  return Object.entries(a)
    .map(([k, v]) => `${Number(k) + 1}→${String(v).toUpperCase()}`)
    .join(", ");
}

/**
 * Thư viện bài tập — kho bài tập về nhà soạn sẵn theo từng bài của giáo trình.
 * Chọn giáo trình → xem bộ đề của từng bài → giao thẳng cho lớp.
 */
export default function ExerciseLibraryPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "staff";
  const canAssign = user?.role === "teacher";

  const textbooks = useLoad(fetchTextbooks);
  const [textbookId, setTextbookId] = useState("");
  const [q, setQ] = useState("");
  const [previewing, setPreviewing] = useState<TextbookLessonRow | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<TextbookImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = textbooks.data ?? [];
  const current = list.find((tb) => tb.id === textbookId) ?? list[0] ?? null;

  const lessons = useLoad(
    () => (current ? fetchTextbookLessons(current.id) : Promise.resolve([])),
    [current?.id],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (lessons.data ?? []).filter(
      (l) =>
        !needle ||
        [l.title, l.title_zh, l.summary, String(l.unit ?? "")].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
    );
  }, [lessons.data, q]);

  const totalQuestions = (lessons.data ?? []).reduce(
    (s, l) => s + (l.questions[0]?.count ?? 0),
    0,
  );
  const lessonsWithExercises = (lessons.data ?? []).filter(
    (l) => (l.questions[0]?.count ?? 0) > 0,
  ).length;

  async function handleFile(file: File) {
    if (!user) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      let payload: TextbookImportPayload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error("File không phải JSON hợp lệ.");
      }
      const r = await importTextbook(payload, user.id, setProgress);
      setResult(r);
      textbooks.reload();
      lessons.reload();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : dbErrorMessage(e));
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Thư viện bài tập</h1>
          <p className="mt-1 text-muted-foreground">
            Kho bài tập về nhà soạn sẵn theo từng bài của giáo trình — giáo viên chọn bài rồi giao thẳng cho lớp.
          </p>
        </div>
        {canManage && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" />
              {importing ? (progress ?? "Đang import...") : "Nhập bài tập (JSON)"}
            </Button>
          </div>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {textbooks.error && <ErrorNote message={textbooks.error} />}
      {lessons.error && <ErrorNote message={lessons.error} />}
      {result && (
        <div className="rounded-xl border border-jade-200 bg-jade-50 px-4 py-3 text-sm text-jade-800">
          Nhập xong: {result.questionsCreated} câu hỏi thêm mới
          {result.questionsSkipped ? `, ${result.questionsSkipped} câu trùng bỏ qua` : ""} ·{" "}
          {result.lessonsCreated} bài mới, {result.lessonsUpdated} bài cập nhật.
        </div>
      )}

      {textbooks.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : list.length === 0 ? (
        <Empty
          icon={ClipboardList}
          title="Chưa có giáo trình nào"
          description="Nhập giáo trình ở Thư viện giáo trình trước, sau đó nạp bộ bài tập theo từng bài vào đây."
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <span className="text-sm font-medium text-muted-foreground">Giáo trình:</span>
              <Select
                className="w-72"
                value={current?.id ?? ""}
                onChange={(e) => setTextbookId(e.target.value)}
              >
                {list.map((tb) => (
                  <option key={tb.id} value={tb.id}>{tb.name}</option>
                ))}
              </Select>
              <div className="relative min-w-52 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm bài theo tên hoặc số bài..."
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {current && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
              <TextbookCover
                name={current.name}
                name_zh={current.name_zh}
                level={current.level}
                code={current.code}
                cover_url={current.cover_url}
                className="w-16"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{current.name}</span>
                  {current.level && (
                    <Badge variant="gold">{LEVEL_LABELS[current.level] ?? current.level}</Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {lessonsWithExercises}/{lessons.data?.length ?? 0} bài đã có bài tập ·{" "}
                  {totalQuestions} câu hỏi trong kho
                </div>
              </div>
              <Link href="/library/textbooks" className="text-sm font-semibold text-brand-600">
                Xem giáo trình →
              </Link>
            </div>
          )}

          {lessons.loading ? (
            <Card><LoadingRows rows={5} /></Card>
          ) : filtered.length === 0 ? (
            <Empty
              icon={FileQuestion}
              title={q ? "Không tìm thấy bài nào" : "Giáo trình này chưa có bài"}
              description={
                q
                  ? `Không có bài nào khớp với “${q}”.`
                  : "Nhập file JSON bài tập cho giáo trình để nạp bộ đề theo từng bài."
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l) => {
                const count = l.questions[0]?.count ?? 0;
                return (
                  <Card key={l.id} className={count ? "card-hover flex flex-col" : "flex flex-col opacity-70"}>
                    <CardContent className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline">Bài {String(l.unit ?? "?").padStart(2, "0")}</Badge>
                        <Badge variant={count ? "jade" : "muted"}>
                          <HelpCircle className="h-3 w-3" /> {count} câu
                        </Badge>
                      </div>
                      {l.title_zh && (
                        <div className="zh mt-3 text-xl font-bold text-brand-700">{l.title_zh}</div>
                      )}
                      <div className="mt-1 font-semibold">{l.title}</div>
                      {l.summary && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>
                      )}
                      <div className="mt-auto flex gap-2 pt-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          disabled={!count}
                          onClick={() => setPreviewing(l)}
                        >
                          Xem bộ đề
                        </Button>
                        {canAssign && (
                          <Link href="/teacher/homework/new" className="flex-1">
                            <Button size="sm" variant="outline" className="w-full" disabled={!count}>
                              <Send className="h-3.5 w-3.5" /> Giao bài
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {canManage && (
        <Card>
          <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground">
            <div className="font-semibold text-foreground">Cách nạp bài tập về nhà</div>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              <li>Dùng đúng cấu trúc JSON của giáo trình: <code className="rounded bg-muted px-1">textbook.code</code> khớp giáo trình đã có, mỗi bài khớp theo <code className="rounded bg-muted px-1">unit</code>, bài tập nằm trong mảng <code className="rounded bg-muted px-1">questions</code> của bài.</li>
              <li>Bấm <b>Nhập bài tập (JSON)</b>. Câu hỏi trùng nội dung sẽ tự bỏ qua nên nhập lại cùng file vẫn an toàn.</li>
              <li>Giáo viên vào đây chọn bài rồi bấm <b>Giao bài</b>, hoặc lọc theo bài ở <b>Ngân hàng câu hỏi</b>.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {previewing && (
        <ExercisePreviewModal lesson={previewing} onClose={() => setPreviewing(null)} />
      )}
    </div>
  );
}

/* ============ Xem bộ đề của một bài ============ */

function ExercisePreviewModal({
  lesson,
  onClose,
}: {
  lesson: TextbookLessonRow;
  onClose: () => void;
}) {
  const questions = useLoad(() => fetchQuestions({ lessonId: lesson.id }), [lesson.id]);
  const idsKey = (questions.data ?? []).map((x) => x.id).join(",");
  const answers = useLoad(
    () => fetchQuestionAnswers((questions.data ?? []).map((x) => x.id)),
    [idsKey],
  );
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Bài ${lesson.unit ?? "?"} — ${lesson.title}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {questions.data ? `${questions.data.length} câu hỏi` : "Đang tải..."}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? "Ẩn đáp án" : "Hiện đáp án"}
          </Button>
        </div>

        <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {questions.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : questions.error ? (
            <ErrorNote message={questions.error} />
          ) : (questions.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Bài này chưa có bài tập.
            </div>
          ) : (
            questions.data!.map((x, i) => (
              <div key={x.id} className="rounded-xl border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Câu {i + 1}</span>
                  <Badge variant="muted">{QUESTION_TYPE_LABELS[x.type]}</Badge>
                </div>
                <div className="zh mt-1.5 text-sm">{questionPreview(x)}</div>
                {showAnswers && (
                  <div className="mt-1.5 text-xs font-semibold text-emerald-700">
                    Đáp án: {answerPreview(x, answers.data?.[x.id])}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
