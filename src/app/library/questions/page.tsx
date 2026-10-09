"use client";
import { QuestionVisualPreview } from "@/components/question-visuals";

import { useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage } from "@/lib/db";
import {
  deleteQuestion,
  fetchLessons,
  fetchQuestionAnswers,
  questionAnswerPreview,
  fetchQuestions,
  questionPreview,
  QUESTION_TYPE_LABELS,
  type QuestionRow,
  type QuestionType,
} from "@/lib/db-content";

import { QuestionModal } from "@/components/library/question-modal";

export default function QuestionBankPage() {
  const [typeFilter, setTypeFilter] = useState<QuestionType | "">("");
  const [lessonFilter, setLessonFilter] = useState("");
  const questions = useLoad(
    () => fetchQuestions({ type: typeFilter, lessonId: lessonFilter || undefined }),
    [typeFilter, lessonFilter],
  );
  const lessons = useLoad(() => fetchLessons(), []);
  const idsKey = (questions.data ?? []).map((q) => q.id).join(",");
  const answers = useLoad(
    () => fetchQuestionAnswers((questions.data ?? []).map((q) => q.id)),
    [idsKey],
  );

  const [editing, setEditing] = useState<QuestionRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(q: QuestionRow) {
    if (!confirm("Xóa câu hỏi này? Câu sẽ bị gỡ khỏi các bài tập đang dùng.")) return;
    setError(null);
    try {
      await deleteQuestion(q.id);
      questions.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Ngân hàng câu hỏi</h1>
          <p className="mt-1 text-muted-foreground">
            Câu hỏi dùng chung để giao bài tập. Học viên xem đáp án và giải thích sau khi nộp bài.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Tạo câu hỏi
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {questions.error && <ErrorNote message={questions.error} />}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <Select
            wrapClassName="w-full sm:w-auto"
            className="w-full sm:w-44"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as QuestionType | "")}
          >
            <option value="">Mọi dạng câu</option>
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
          <Select wrapClassName="w-full sm:w-auto" className="w-full sm:w-64" value={lessonFilter} onChange={(e) => setLessonFilter(e.target.value)}>
            <option value="">Mọi bài học</option>
            {(lessons.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.unit != null ? `Bài ${l.unit}: ` : ""}{l.title}
              </option>
            ))}
          </Select>
          <span className="text-sm text-muted-foreground">
            {questions.data ? `${questions.data.length} câu hỏi` : ""}
          </span>
        </CardContent>
      </Card>

      {questions.loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : (questions.data?.length ?? 0) === 0 ? (
        <Empty
          icon={HelpCircle}
          title="Chưa có câu hỏi nào"
          description="Bấm “Tạo câu hỏi” — hỗ trợ trắc nghiệm, điền từ, sắp xếp câu, nối từ, nghe chọn, chọn pinyin."
        />
      ) : (
        <Card>
          <div className="divide-y">
            {questions.data!.map((q) => (
              <div key={q.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20">
                <Badge variant="outline" className="w-28 shrink-0 justify-center">
                  {QUESTION_TYPE_LABELS[q.type]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="zh truncate text-sm font-medium">{questionPreview(q) || "(chưa có đề bài)"}</div>
<QuestionVisualPreview content={q.content} />
                  <div className="truncate text-xs text-muted-foreground">
                    Đáp án: <b>{questionAnswerPreview(q, answers.data?.[q.id])}</b>
                    {q.lesson && <> · {q.lesson.unit != null ? `Bài ${q.lesson.unit}: ` : ""}{q.lesson.title}</>}
                    {q.level && ` · ${q.level}`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(q)}
                    title="Sửa"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    title="Xóa"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <QuestionModal
          question={editing === "new" ? null : editing}
          answer={editing === "new" ? undefined : answers.data?.[editing.id]}
          lessons={lessons.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            questions.reload();
            answers.reload();
          }}
        />
      )}
    </div>
  );
}
