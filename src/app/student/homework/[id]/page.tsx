"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, RotateCcw, Send, Trophy, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage } from "@/lib/db";
import {
  fetchHomework,
  fetchMySubmission,
  submitHomework,
  CHOICE_LETTERS,
  QUESTION_TYPE_LABELS,
  type QuestionAnswer,
  type QuestionRow,
} from "@/lib/db-content";
import { cn } from "@/lib/utils";

function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function StudentHomeworkPlayerPage() {
  const params = useParams<{ id: string }>();
  const homeworkId = params.id;
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const homework = useLoad(() => fetchHomework(homeworkId), [homeworkId]);
  const submission = useLoad(
    () => (studentId ? fetchMySubmission(homeworkId, studentId) : Promise.resolve(null)),
    [homeworkId, studentId],
  );

  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number | null } | null>(null);
  const [redo, setRedo] = useState(false);

  function setAnswer(questionId: string, value: QuestionAnswer) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
  }

  const questions = homework.data?.questions ?? [];
  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q, answers[q.id])).length,
    [questions, answers],
  );

  async function handleSubmit() {
    if (answeredCount < questions.length) {
      setError(`Bạn còn ${questions.length - answeredCount} câu chưa trả lời.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sub = await submitHomework(homeworkId, answers);
      setResult({ score: sub.score });
      setRedo(false);
      submission.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (homework.loading || submission.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (homework.error) return <ErrorNote message={homework.error} />;
  if (!homework.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy bài tập này (hoặc bạn không thuộc lớp được giao)." />
        <Link href="/student/homework" className="text-sm font-semibold text-brand-600">← Bài tập</Link>
      </div>
    );
  }

  const hw = homework.data;
  const existing = submission.data;

  // Màn kết quả: vừa nộp xong, hoặc đã nộp từ trước và chưa bấm "Làm lại"
  const showScore = result ?? (existing && !redo ? { score: existing.score } : null);
  if (showScore) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Link
          href="/student/homework"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Bài tập
        </Link>
        <div className="rounded-3xl border bg-gradient-to-br from-brand-50 to-gold-50 p-10 text-center shadow-soft">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-soft">
            <Trophy className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-2xl font-bold">{hw.title}</h2>
          <p className="mt-1 text-muted-foreground">
            {result ? "Đã nộp bài — hệ thống chấm tự động." : "Bạn đã nộp bài tập này."}
          </p>
          <div className="mt-4 text-6xl font-extrabold text-gradient-brand">
            {showScore.score ?? "—"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">/ 10 điểm</div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setAnswers({});
                setRedo(true);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Làm lại (tính điểm mới)
            </Button>
            <Link href="/student/homework">
              <Button>Xong</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/student/homework"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Bài tập
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{hw.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{hw.class?.name}</span>
          <span>· {questions.length} câu</span>
          {hw.due_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Hạn {new Date(hw.due_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </div>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Bài tập chưa có câu hỏi nào.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="p-5 md:p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                </div>
                <QuestionInput
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && <ErrorNote message={error} />}

      {questions.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-4 shadow-soft backdrop-blur">
          <span className="text-sm text-muted-foreground">
            Đã trả lời <b className="text-foreground">{answeredCount}</b>/{questions.length} câu
          </span>
          <Button size="lg" disabled={submitting} onClick={handleSubmit}>
            <Send className="h-4 w-4" />
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ================= Trạng thái "đã trả lời" theo loại câu ================= */

function isAnswered(q: QuestionRow, a: QuestionAnswer | undefined): boolean {
  if (a === undefined) return false;
  if (q.type === "fill_blank") {
    return Array.isArray(a) && a.length > 0 && a.every((s) => String(s).trim() !== "");
  }
  if (q.type === "reorder") {
    return Array.isArray(a) && a.length === (q.content.tokens?.length ?? 0);
  }
  if (q.type === "matching") {
    const need = q.content.left?.length ?? 0;
    return typeof a === "object" && !Array.isArray(a) && Object.keys(a).length === need;
  }
  return typeof a === "string" && a !== "";
}

/* ================= Ô nhập theo loại câu hỏi ================= */

function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: QuestionRow;
  value: QuestionAnswer | undefined;
  onChange: (v: QuestionAnswer) => void;
}) {
  switch (q.type) {
    case "multiple_choice":
    case "pinyin_choice":
    case "listening":
      return <ChoiceInput q={q} value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "fill_blank":
      return <FillBlankInput q={q} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "reorder":
      return <ReorderInput q={q} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "matching":
      return (
        <MatchingInput
          q={q}
          value={value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {}}
          onChange={onChange}
        />
      );
  }
}

function ChoiceInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string;
  onChange: (v: string) => void;
}) {
  const c = q.content;
  const audioText = c.tts;
  return (
    <div>
      {c.hanzi && (
        <div className="mb-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => speak(c.hanzi!)}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-brand-600 hover:bg-brand-50"
          >
            <Volume2 className="h-4 w-4" />
            <span className="zh text-3xl font-bold">{c.hanzi}</span>
          </button>
        </div>
      )}
      {q.type === "listening" && (
        <div className="mb-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (c.audio_url) new Audio(c.audio_url).play().catch(() => {});
              else if (audioText) speak(audioText);
            }}
            className="grid h-16 w-16 place-items-center rounded-full bg-gradient-brand text-white shadow-soft transition-transform hover:scale-105"
          >
            <Volume2 className="h-7 w-7" />
          </button>
          <span className="text-xs text-muted-foreground">Nhấn để nghe</span>
        </div>
      )}
      {c.prompt && <h3 className="text-base font-semibold">{c.prompt}</h3>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(c.options ?? []).map((opt, i) => {
          const letter = CHOICE_LETTERS[i];
          const active = value === letter;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(letter)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left text-sm font-medium transition-all",
                active
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                  : "hover:border-brand-300 hover:bg-brand-50/40",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  active ? "border-brand-500 bg-brand-600 text-white" : "text-muted-foreground",
                )}
              >
                {letter}
              </span>
              <span className={q.type !== "multiple_choice" ? "zh text-lg" : ""}>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FillBlankInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const parts = (q.content.prompt ?? "").split("___");
  const blanks = Math.max(parts.length - 1, 1);
  const vals = Array.from({ length: blanks }, (_, i) => value[i] ?? "");

  function setBlank(i: number, s: string) {
    const next = [...vals];
    next[i] = s;
    onChange(next);
  }

  return (
    <div>
      <div className="zh rounded-xl bg-muted/50 p-4 text-xl leading-relaxed">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className="mx-1 inline-block min-w-[70px] rounded-lg border-2 border-dashed border-brand-300 px-2 py-0.5 align-middle text-center text-base">
                {vals[i] || `(${i + 1})`}
              </span>
            )}
          </span>
        ))}
      </div>
      {q.content.hint && (
        <div className="mt-2 text-xs text-muted-foreground">Gợi ý: {q.content.hint}</div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {vals.map((v, i) => (
          <Input
            key={i}
            value={v}
            onChange={(e) => setBlank(i, e.target.value)}
            placeholder={blanks > 1 ? `Chỗ trống ${i + 1}` : "Nhập đáp án..."}
          />
        ))}
      </div>
    </div>
  );
}

function ReorderInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const tokens = q.content.tokens ?? [];
  // Pool = các token chưa dùng (theo số lần xuất hiện, vì token có thể lặp)
  const pool = useMemo(() => {
    const used = new Map<string, number>();
    for (const t of value) used.set(t, (used.get(t) ?? 0) + 1);
    return tokens.filter((t) => {
      const n = used.get(t) ?? 0;
      if (n > 0) {
        used.set(t, n - 1);
        return false;
      }
      return true;
    });
  }, [tokens, value]);

  return (
    <div>
      {q.content.translation && (
        <p className="text-sm text-muted-foreground">Nghĩa: {q.content.translation}</p>
      )}
      <div className="zh mt-3 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-3 text-xl">
        {value.length === 0 && (
          <span className="text-sm text-muted-foreground">Nhấn các từ bên dưới để xếp câu...</span>
        )}
        {value.map((t, i) => (
          <button
            key={`${t}-${i}`}
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-xl bg-card px-3 py-1.5 shadow-sm hover:bg-rose-50"
          >
            {t}
          </button>
        ))}
      </div>
      <div className="zh mt-3 flex flex-wrap gap-2">
        {pool.map((t, i) => (
          <button
            key={`${t}-${i}`}
            type="button"
            onClick={() => onChange([...value, t])}
            className="rounded-xl border bg-card px-4 py-2 text-lg hover:bg-brand-50"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchingInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const left = q.content.left ?? [];
  const right = q.content.right ?? [];
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Chọn nghĩa đúng cho từng mục:</p>
      {left.map((l, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="zh w-28 shrink-0 text-lg font-bold text-brand-700">{l}</div>
          <Select
            value={value[String(i)] ?? ""}
            onChange={(e) => onChange({ ...value, [String(i)]: e.target.value })}
          >
            <option value="">— Chọn —</option>
            {right.map((r, j) => (
              <option key={j} value={CHOICE_LETTERS[j].toLowerCase()}>
                {CHOICE_LETTERS[j]}. {r}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
