"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HanziCanvas, type HanziCanvasHandle, type QuizPhase } from "./hanzi-canvas";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Flag,
  Headphones,
  Languages,
  Pencil,
  PenTool,
  Play,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { Vocab } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode =
  | "meaning"
  | "word"
  | "pinyin"
  | "audio"
  | "mixed"
  | "input"
  | "stroke";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "meaning", label: "Kiểm tra nghĩa từ", icon: Eye },
  { id: "word", label: "Kiểm tra từ", icon: FileText },
  { id: "pinyin", label: "Kiểm tra pinyin", icon: Languages },
  { id: "audio", label: "Kiểm tra phát âm", icon: Headphones },
  { id: "mixed", label: "Luyện tập tổng hợp", icon: Zap },
  { id: "input", label: "Nhập từ vựng", icon: Edit3 },
  { id: "stroke", label: "Luyện thứ tự nét", icon: PenTool },
];

function speak(text: string) {
  if (typeof window === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// Seeded shuffle for stable client/server output
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface MCQ {
  id: string;
  prompt: string;
  hanzi?: string;
  options: string[];
  answer: number;
}

function buildMeaningQuestions(vocab: Vocab[], pool: Vocab[]): MCQ[] {
  // "Từ nào có nghĩa là X?" — options là hanzi
  return vocab.map((v, i) => {
    const distractors = seededShuffle(pool.filter((p) => p.id !== v.id), i + 1).slice(0, 3);
    const opts = seededShuffle([v, ...distractors], i + 7);
    return {
      id: `meaning-${v.id}`,
      prompt: `Từ nào sau đây có nghĩa là: '${v.meaning}'?`,
      options: opts.map((o) => o.hanzi),
      answer: opts.findIndex((o) => o.id === v.id),
    };
  });
}

function buildWordQuestions(vocab: Vocab[], pool: Vocab[]): MCQ[] {
  // Cho hanzi, chọn nghĩa
  return vocab.map((v, i) => {
    const distractors = seededShuffle(pool.filter((p) => p.id !== v.id), i + 13).slice(0, 3);
    const opts = seededShuffle([v, ...distractors], i + 19);
    return {
      id: `word-${v.id}`,
      hanzi: v.hanzi,
      prompt: `'${v.hanzi}' có nghĩa là gì?`,
      options: opts.map((o) => o.meaning),
      answer: opts.findIndex((o) => o.id === v.id),
    };
  });
}

function buildPinyinQuestions(vocab: Vocab[], pool: Vocab[]): MCQ[] {
  // Cho hanzi, chọn pinyin
  return vocab.map((v, i) => {
    const distractors = seededShuffle(pool.filter((p) => p.id !== v.id), i + 23).slice(0, 3);
    const opts = seededShuffle([v, ...distractors], i + 31);
    return {
      id: `pinyin-${v.id}`,
      hanzi: v.hanzi,
      prompt: `Phiên âm đúng của từ '${v.hanzi}' là gì?`,
      options: opts.map((o) => o.pinyin),
      answer: opts.findIndex((o) => o.id === v.id),
    };
  });
}

function buildAudioQuestions(vocab: Vocab[], pool: Vocab[]): (MCQ & { audioText: string })[] {
  // Nghe (hanzi), chọn nghĩa
  return vocab.map((v, i) => {
    const distractors = seededShuffle(pool.filter((p) => p.id !== v.id), i + 41).slice(0, 3);
    const opts = seededShuffle([v, ...distractors], i + 47);
    return {
      id: `audio-${v.id}`,
      audioText: v.hanzi,
      prompt: "Chọn từ bạn nghe được",
      options: opts.map((o) => o.meaning),
      answer: opts.findIndex((o) => o.id === v.id),
    };
  });
}

export function PracticeHub({
  vocab,
  pool,
  classId,
}: {
  vocab: Vocab[];
  pool: Vocab[];
  classId: string;
}) {
  const [mode, setMode] = useState<Mode>("meaning");
  const [completed, setCompleted] = useState<Record<Mode, boolean>>({
    meaning: false,
    word: false,
    pinyin: false,
    audio: false,
    mixed: false,
    input: false,
    stroke: false,
  });

  const markDone = (m: Mode) =>
    setCompleted((c) => (c[m] ? c : { ...c, [m]: true }));

  const doneCount = MODES.filter((m) => completed[m.id]).length;
  const total = MODES.length;
  const allDone = doneCount === total;

  // Khi hoàn thành mode hiện tại, gợi ý chuyển sang mode kế tiếp chưa làm
  function nextUndone(from: Mode): Mode | null {
    const idx = MODES.findIndex((m) => m.id === from);
    for (let i = 1; i <= MODES.length; i++) {
      const m = MODES[(idx + i) % MODES.length];
      if (!completed[m.id]) return m.id;
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            const isDone = completed[m.id];
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
                  active
                    ? "bg-brand-500 text-white shadow-soft"
                    : isDone
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className={cn("h-3.5 w-3.5", active ? "text-white" : "text-emerald-500")} />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 px-1">
          <Progress value={(doneCount / total) * 100} className="h-1.5 flex-1" />
          <span className="text-xs font-semibold text-muted-foreground">
            {doneCount}/{total} phần
          </span>
        </div>
      </div>

      {/* Mode content */}
      {mode === "meaning" && (
        <SingleQuestionQuiz
          questions={buildMeaningQuestions(vocab, pool)}
          mode="meaning"
          onComplete={() => markDone("meaning")}
        />
      )}
      {mode === "word" && (
        <ListQuiz
          questions={buildWordQuestions(vocab, pool)}
          tag="Từ vựng"
          onComplete={() => markDone("word")}
        />
      )}
      {mode === "pinyin" && (
        <ListQuiz
          questions={buildPinyinQuestions(vocab, pool)}
          tag="Từ vựng"
          onComplete={() => markDone("pinyin")}
        />
      )}
      {mode === "audio" && (
        <AudioListQuiz
          questions={buildAudioQuestions(vocab, pool)}
          onComplete={() => markDone("audio")}
        />
      )}
      {mode === "mixed" && (
        <MixedQuiz vocab={vocab} pool={pool} onComplete={() => markDone("mixed")} />
      )}
      {mode === "input" && (
        <InputVocabTable vocab={vocab} onComplete={() => markDone("input")} />
      )}
      {mode === "stroke" && (
        <StrokeOrderDemo vocab={vocab} onComplete={() => markDone("stroke")} />
      )}

      {/* Next-mode suggestion (khi mode hiện tại đã xong nhưng chưa toàn bộ) */}
      {completed[mode] && !allDone && (
        <Card className="border-brand-200 bg-brand-50/50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <span className="font-semibold">Tốt lắm! Tiếp tục phần kế tiếp.</span>
            </div>
            {(() => {
              const nxt = nextUndone(mode);
              if (!nxt) return null;
              const nm = MODES.find((m) => m.id === nxt)!;
              return (
                <Button onClick={() => setMode(nxt)}>
                  {nm.label} <ArrowRight className="h-4 w-4" />
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Completion CTA → Homework */}
      {allDone && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-brand-50 to-gold-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-soft">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Hoàn thành toàn bộ {total} phần luyện tập
                </div>
                <h3 className="mt-1 text-lg font-bold">Sẵn sàng nhận bài tập về nhà 📚</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Giáo viên đã giao bài tập về nhà cho lớp này — vào làm để củng cố kiến thức nhé.
                </p>
              </div>
            </div>
            <Link href="/student/homework">
              <Button size="lg" variant="gold">
                <ClipboardList className="h-4 w-4" /> Đi tới bài tập về nhà <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────────────── Single question quiz (Kiểm tra nghĩa từ) ───────────────────────────── */
function SingleQuestionQuiz({
  questions,
  mode,
  onComplete,
}: {
  questions: MCQ[];
  mode: Mode;
  onComplete?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const total = questions.length;
  const done = Object.keys(checked).length === total;
  const correctCount = Object.entries(checked).filter(([k]) => picked[+k] === questions[+k].answer).length;

  useEffect(() => {
    if (done) onComplete?.();
  }, [done, onComplete]);

  const q = questions[idx];
  const isChecked = !!checked[idx];

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Progress sidebar */}
      <Card className="h-fit">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <FileText className="h-4 w-4 text-brand-500" /> Tiến trình
            </span>
            <span className="text-muted-foreground">{idx + 1}/{total}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((_, i) => {
              const wasChecked = !!checked[i];
              const isCorrect = wasChecked && picked[i] === questions[i].answer;
              const isCurrent = i === idx;
              return (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-bold transition-all",
                    isCurrent && "ring-2 ring-brand-300",
                    wasChecked && isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-700",
                    wasChecked && !isCorrect && "border-rose-400 bg-rose-50 text-rose-700",
                    !wasChecked && !isCurrent && "bg-white text-muted-foreground hover:border-brand-300",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Progress value={(Object.keys(checked).length / total) * 100} className="h-1.5" />
          <div className="text-center text-xs text-muted-foreground">
            {Math.round((Object.keys(checked).length / total) * 100)}% hoàn thành
          </div>
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Câu {idx + 1}/{total}</span>
            <div className="flex gap-2">
              <Badge variant="default" className="bg-brand-100 text-brand-700">Câu {idx + 1}</Badge>
              <Badge variant="muted">{mode === "meaning" ? "Chọn từ" : "Trắc nghiệm"}</Badge>
            </div>
          </div>

          {q.hanzi && (
            <div className="zh mb-4 text-center text-5xl font-bold text-brand-700">{q.hanzi}</div>
          )}
          <h3 className="text-center text-lg font-semibold">{q.prompt}</h3>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isPicked = picked[idx] === i;
              const isCorrect = q.answer === i;
              let state: "idle" | "active" | "correct" | "wrong" | "muted" = "idle";
              if (isChecked) {
                if (isCorrect) state = "correct";
                else if (isPicked) state = "wrong";
                else state = "muted";
              } else if (isPicked) state = "active";
              return (
                <button
                  key={i}
                  disabled={isChecked}
                  onClick={() => setPicked((p) => ({ ...p, [idx]: i }))}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all",
                    state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                    state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                    state === "correct" && "border-emerald-500 bg-emerald-50",
                    state === "wrong" && "border-rose-500 bg-rose-50",
                    state === "muted" && "opacity-60",
                  )}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-bold text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="zh flex-1 text-2xl font-bold">{opt}</span>
                  {state === "correct" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  {state === "wrong" && <XCircle className="h-5 w-5 text-rose-600" />}
                </button>
              );
            })}
          </div>

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={picked[idx] === undefined || isChecked}
            onClick={() => {
              setChecked((c) => ({ ...c, [idx]: true }));
            }}
          >
            Kiểm tra
          </Button>

          {isChecked && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                disabled={idx >= total - 1}
              >
                Câu tiếp <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {done && (
            <div className="mt-6 rounded-2xl border bg-gradient-to-br from-brand-50 to-gold-50 p-5 text-center">
              <Trophy className="mx-auto h-8 w-8 text-gold-500" />
              <div className="mt-2 font-bold">Hoàn thành! Đúng {correctCount}/{total}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────────── List quiz (Kiểm tra từ / pinyin) ───────────────────────────── */
function ListQuiz({
  questions,
  tag,
  onComplete,
}: {
  questions: MCQ[];
  tag: string;
  onComplete?: () => void;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const total = questions.length;
  const answered = Object.keys(picked).length;
  const correct = Object.entries(picked).filter(([k, v]) => v === questions[+k].answer).length;

  useEffect(() => {
    if (submitted) onComplete?.();
  }, [submitted, onComplete]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="flex flex-wrap gap-1">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold",
                    picked[i] !== undefined ? "border-brand-300 bg-brand-50 text-brand-700" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{answered}/{total}</div>
            <div className="mt-2 w-full max-w-md">
              <Progress value={(answered / total) * 100} className="h-1.5" />
              <div className="mt-1 text-xs text-muted-foreground">{answered}/{total}</div>
            </div>
          </div>
          <Button
            disabled={submitted}
            onClick={() => setSubmitted(true)}
            className="shrink-0"
          >
            <Send className="h-4 w-4" /> Nộp bài
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const sel = picked[i];
          return (
            <Card key={q.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold">{i + 1}.</span>
                    <Badge variant="default" className="bg-brand-100 text-brand-700">{tag}</Badge>
                  </div>
                  <button className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                    <Flag className="h-3 w-3" /> Báo lỗi
                  </button>
                </div>
                {q.hanzi && <div className="zh text-3xl font-bold text-brand-700">{q.hanzi}</div>}
                <div className="text-sm font-medium">{q.prompt}</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {q.options.map((opt, oi) => {
                    const isPicked = sel === oi;
                    const isCorrect = q.answer === oi;
                    let state: "idle" | "active" | "correct" | "wrong" | "muted" = "idle";
                    if (submitted) {
                      if (isCorrect) state = "correct";
                      else if (isPicked) state = "wrong";
                      else state = "muted";
                    } else if (isPicked) state = "active";
                    return (
                      <button
                        key={oi}
                        disabled={submitted}
                        onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm transition-all",
                          state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                          state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                          state === "correct" && "border-emerald-500 bg-emerald-50",
                          state === "wrong" && "border-rose-500 bg-rose-50",
                          state === "muted" && "opacity-60",
                        )}
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-bold text-muted-foreground">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="zh flex-1 font-semibold">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">
            <FileText className="mr-1 inline h-3.5 w-3.5" /> {answered}/{total} đã trả lời
          </div>
          <Button disabled={submitted} onClick={() => setSubmitted(true)}>
            <Send className="h-4 w-4" /> Nộp bài
          </Button>
        </CardContent>
      </Card>

      {submitted && (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-gold-50">
          <CardContent className="p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-gold-500" />
            <div className="mt-2 text-xl font-bold">Kết quả: {correct}/{total} câu đúng</div>
            <div className="text-3xl font-extrabold text-gradient-brand">
              {Math.round((correct / total) * 100)}%
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────────────── Audio list quiz (Kiểm tra phát âm) ───────────────────────────── */
function AudioListQuiz({
  questions,
  onComplete,
}: {
  questions: (MCQ & { audioText: string })[];
  onComplete?: () => void;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const total = questions.length;
  const correct = Object.entries(picked).filter(([k, v]) => v === questions[+k].answer).length;

  useEffect(() => {
    if (submitted) onComplete?.();
  }, [submitted, onComplete]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap gap-1">
            {questions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold",
                  picked[i] !== undefined ? "border-brand-300 bg-brand-50 text-brand-700" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <Button disabled={submitted} onClick={() => setSubmitted(true)} className="shrink-0">
            <Send className="h-4 w-4" /> Nộp bài
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const sel = picked[i];
          return (
            <Card key={q.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold">{i + 1}.</span>
                    <Badge variant="default" className="bg-brand-100 text-brand-700">Nghe</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="jade"><Volume2 className="h-3 w-3" /> Nghe</Badge>
                    <button className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                      <Flag className="h-3 w-3" /> Báo lỗi
                    </button>
                  </div>
                </div>
                <div className="text-sm font-medium">Chọn từ bạn nghe được</div>
                <button
                  onClick={() => speak(q.audioText)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                >
                  <Volume2 className="h-4 w-4" /> Phát audio
                </button>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {q.options.map((opt, oi) => {
                    const isPicked = sel === oi;
                    const isCorrect = q.answer === oi;
                    let state: "idle" | "active" | "correct" | "wrong" | "muted" = "idle";
                    if (submitted) {
                      if (isCorrect) state = "correct";
                      else if (isPicked) state = "wrong";
                      else state = "muted";
                    } else if (isPicked) state = "active";
                    return (
                      <button
                        key={oi}
                        disabled={submitted}
                        onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm transition-all",
                          state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                          state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                          state === "correct" && "border-emerald-500 bg-emerald-50",
                          state === "wrong" && "border-rose-500 bg-rose-50",
                          state === "muted" && "opacity-60",
                        )}
                      >
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-bold text-muted-foreground">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1 font-semibold">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {submitted && (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-gold-50">
          <CardContent className="p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-gold-500" />
            <div className="mt-2 text-xl font-bold">Kết quả: {correct}/{total} câu đúng</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────────────────────────── Mixed quiz (Luyện tập tổng hợp) ───────────────────────────── */
function MixedQuiz({
  vocab,
  pool,
  onComplete,
}: {
  vocab: Vocab[];
  pool: Vocab[];
  onComplete?: () => void;
}) {
  // Mix các loại câu hỏi
  const questions = useMemo(() => {
    const meaning = buildMeaningQuestions(vocab, pool);
    const word = buildWordQuestions(vocab, pool);
    const pinyin = buildPinyinQuestions(vocab, pool);
    const audio = buildAudioQuestions(vocab, pool);
    type Mix =
      | (MCQ & { kind: "meaning" })
      | (MCQ & { kind: "word" })
      | (MCQ & { kind: "pinyin" })
      | (MCQ & { audioText: string; kind: "audio" });
    const all: Mix[] = [
      ...meaning.map((q) => ({ ...q, kind: "meaning" as const })),
      ...word.map((q) => ({ ...q, kind: "word" as const })),
      ...pinyin.map((q) => ({ ...q, kind: "pinyin" as const })),
      ...audio.map((q) => ({ ...q, kind: "audio" as const })),
    ];
    return seededShuffle(all, 99).slice(0, Math.min(20, all.length));
  }, [vocab, pool]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const total = questions.length;
  const q = questions[idx];
  const isChecked = !!checked[idx];
  const correctCount = Object.entries(checked).filter(([k]) => picked[+k] === questions[+k].answer).length;
  const done = Object.keys(checked).length === total;

  useEffect(() => {
    if (done) onComplete?.();
  }, [done, onComplete]);

  const labelMap = {
    meaning: "Chọn từ",
    word: "Trắc nghiệm",
    pinyin: "Pinyin",
    audio: "Nghe",
  } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Zap className="h-4 w-4 text-brand-500" /> Tiến trình
            </span>
            <span className="text-muted-foreground">{idx + 1}/{total}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((_, i) => {
              const wasChecked = !!checked[i];
              const isCorrect = wasChecked && picked[i] === questions[i].answer;
              const isCurrent = i === idx;
              return (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-bold transition-all",
                    isCurrent && "ring-2 ring-brand-300",
                    wasChecked && isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-700",
                    wasChecked && !isCorrect && "border-rose-400 bg-rose-50 text-rose-700",
                    !wasChecked && !isCurrent && "bg-white text-muted-foreground hover:border-brand-300",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Progress value={(Object.keys(checked).length / total) * 100} className="h-1.5" />
          <div className="text-center text-xs text-muted-foreground">
            {Math.round((Object.keys(checked).length / total) * 100)}% hoàn thành
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Câu {idx + 1}/{total}</span>
            <div className="flex gap-2">
              <Badge variant="default" className="bg-brand-100 text-brand-700">Câu {idx + 1}</Badge>
              <Badge variant="muted">{labelMap[q.kind]}</Badge>
            </div>
          </div>

          {q.kind === "audio" ? (
            <div className="mb-4 flex flex-col items-center gap-3">
              <button
                onClick={() => speak((q as any).audioText)}
                className="grid h-20 w-20 place-items-center rounded-full bg-gradient-brand text-white shadow-soft hover:scale-105 transition-transform"
              >
                <Volume2 className="h-8 w-8" />
              </button>
              <span className="text-xs text-muted-foreground">Nhấn để nghe</span>
            </div>
          ) : q.hanzi ? (
            <div className="zh mb-4 text-center text-5xl font-bold text-brand-700">{q.hanzi}</div>
          ) : null}

          <h3 className="text-center text-lg font-semibold">{q.prompt}</h3>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isPicked = picked[idx] === i;
              const isCorrect = q.answer === i;
              let state: "idle" | "active" | "correct" | "wrong" | "muted" = "idle";
              if (isChecked) {
                if (isCorrect) state = "correct";
                else if (isPicked) state = "wrong";
                else state = "muted";
              } else if (isPicked) state = "active";
              return (
                <button
                  key={i}
                  disabled={isChecked}
                  onClick={() => setPicked((p) => ({ ...p, [idx]: i }))}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all",
                    state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                    state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                    state === "correct" && "border-emerald-500 bg-emerald-50",
                    state === "wrong" && "border-rose-500 bg-rose-50",
                    state === "muted" && "opacity-60",
                  )}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white text-xs font-bold text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={cn("flex-1 font-bold", q.kind === "meaning" && "zh text-2xl")}>{opt}</span>
                  {state === "correct" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  {state === "wrong" && <XCircle className="h-5 w-5 text-rose-600" />}
                </button>
              );
            })}
          </div>

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={picked[idx] === undefined || isChecked}
            onClick={() => setChecked((c) => ({ ...c, [idx]: true }))}
          >
            Kiểm tra
          </Button>

          {isChecked && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                disabled={idx >= total - 1}
              >
                Câu tiếp <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {done && (
            <div className="mt-6 rounded-2xl border bg-gradient-to-br from-brand-50 to-gold-50 p-5 text-center">
              <Trophy className="mx-auto h-8 w-8 text-gold-500" />
              <div className="mt-2 font-bold">Hoàn thành! Đúng {correctCount}/{total}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────────── Input vocab table (Nhập từ vựng) ───────────────────────────── */
function InputVocabTable({
  vocab,
  onComplete,
}: {
  vocab: Vocab[];
  onComplete?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const total = vocab.length;
  const checkedCount = Object.keys(checked).length;

  useEffect(() => {
    if (checkedCount === total && total > 0) onComplete?.();
  }, [checkedCount, total, onComplete]);

  function checkOne(v: Vocab) {
    setChecked((c) => ({ ...c, [v.id]: true }));
  }
  function checkAll() {
    const c: Record<string, boolean> = {};
    vocab.forEach((v) => (c[v.id] = true));
    setChecked(c);
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Edit3 className="h-5 w-5 text-brand-500" /> Nhập từ vựng — Bài học
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nghe phát âm, xem nghĩa tiếng Việt và nhập chữ Hán đúng.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nhấn <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Tab</kbd> hoặc{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Enter</kbd> để chuyển câu tiếp theo.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Nghe</th>
                <th className="px-3 py-2 text-left">Tiếng Việt</th>
                <th className="px-3 py-2 text-left">Pinyin</th>
                <th className="px-3 py-2 text-left">Nhập chữ Hán</th>
                <th className="px-3 py-2 text-left">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vocab.map((v, i) => {
                const val = values[v.id] ?? "";
                const isChecked = !!checked[v.id];
                const correct = val.trim() === v.hanzi;
                return (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => speak(v.hanzi)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-3 py-3">{v.meaning}</td>
                    <td className="px-3 py-3 italic text-muted-foreground">{v.pinyin}</td>
                    <td className="px-3 py-3">
                      <Input
                        value={val}
                        onChange={(e) => setValues((s) => ({ ...s, [v.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Tab") {
                            if (e.key === "Enter") e.preventDefault();
                            checkOne(v);
                            const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-vocab-input]"));
                            const cur = inputs.findIndex((el) => el === e.currentTarget);
                            inputs[cur + 1]?.focus();
                          }
                        }}
                        data-vocab-input
                        placeholder="输入汉字..."
                        className={cn(
                          "zh text-base",
                          isChecked && correct && "border-emerald-400 bg-emerald-50",
                          isChecked && !correct && val && "border-rose-400 bg-rose-50",
                        )}
                        disabled={isChecked && correct}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {!isChecked ? (
                        <span className="text-muted-foreground">—</span>
                      ) : correct ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600">
                          <XCircle className="h-4 w-4" /> {v.hanzi}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Đã kiểm tra {checkedCount}/{total}</div>
          <Button onClick={checkAll} size="lg">
            <CheckCircle2 className="h-4 w-4" /> Kiểm tra tất cả
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Stroke order demo ───────────────────────────── */
const PHASE_LABEL: Record<QuizPhase, string> = {
  1: "Theo gợi ý nét",
  2: "Tô theo chữ mờ",
  3: "Viết tự do",
};

function StrokeOrderDemo({
  vocab,
  onComplete,
}: {
  vocab: Vocab[];
  onComplete?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  // writeCount[vocabIdx][charIdx] = số lần đã viết (0..3)
  const [writeCount, setWriteCount] = useState<Record<number, Record<number, number>>>({});
  const [active, setActive] = useState<{ ci: number; phase: QuizPhase } | null>(null);
  const [running, setRunning] = useState(false);
  const canvasRefs = useRef<(HanziCanvasHandle | null)[]>([]);
  const cancelRef = useRef(false);
  const v = vocab[idx];
  const total = vocab.length;

  // Reset refs khi đổi từ
  useEffect(() => {
    canvasRefs.current = [];
  }, [idx]);

  // Cancel quiz đang chạy khi unmount hoặc đổi từ
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      canvasRefs.current.forEach((c) => c?.cancel());
    };
  }, [idx]);

  if (!v) return null;
  const chars = [...v.hanzi];
  const pinyinParts = v.pinyin.split(/\s+/);
  const canvasSize = chars.length === 1 ? 300 : chars.length === 2 ? 180 : 140;

  const writeCountFor = (ci: number) => writeCount[idx]?.[ci] ?? 0;
  const charMastered = (ci: number) => writeCountFor(ci) >= 3;
  const wordMastered = chars.every((_, ci) => charMastered(ci));

  useEffect(() => {
    if (wordMastered && !visited.has(idx)) {
      setVisited((s) => new Set(s).add(idx));
    }
  }, [wordMastered, idx, visited]);

  useEffect(() => {
    if (visited.size === total && total > 0) onComplete?.();
  }, [visited, total, onComplete]);

  async function animateAll() {
    for (let i = 0; i < canvasRefs.current.length; i++) {
      const c = canvasRefs.current[i];
      if (c) await c.animate();
    }
  }

  async function startWriting() {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    try {
      for (let ci = 0; ci < chars.length; ci++) {
        const startPhase = (writeCountFor(ci) + 1) as QuizPhase;
        if (startPhase > 3) continue;
        for (let p = startPhase; p <= 3; p = ((p + 1) as QuizPhase)) {
          if (cancelRef.current) return;
          const c = canvasRefs.current[ci];
          if (!c) continue;
          setActive({ ci, phase: p as QuizPhase });
          await new Promise<void>((resolve) => {
            c.quiz({
              phase: p as QuizPhase,
              onComplete: () => {
                setWriteCount((wc) => {
                  const word = { ...(wc[idx] ?? {}) };
                  word[ci] = (word[ci] ?? 0) + 1;
                  return { ...wc, [idx]: word };
                });
                resolve();
              },
            });
          });
          if (cancelRef.current) return;
        }
      }
    } finally {
      setActive(null);
      setRunning(false);
    }
  }

  function stopWriting() {
    cancelRef.current = true;
    canvasRefs.current.forEach((c) => c?.cancel());
    setActive(null);
    setRunning(false);
  }

  function resetAll() {
    stopWriting();
    setWriteCount((wc) => ({ ...wc, [idx]: {} }));
    canvasRefs.current.forEach((c) => c?.reset());
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <PenTool className="h-5 w-5 text-brand-500" /> Luyện thứ tự nét
          </h2>
          <div className="text-sm text-muted-foreground">{idx + 1} / {total}</div>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="mx-auto flex w-full items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/30 p-4">
              {chars.map((c, ci) => {
                const count = writeCountFor(ci);
                const isActive = active?.ci === ci;
                return (
                  <div
                    key={`${idx}-${ci}`}
                    className={cn(
                      "relative rounded-2xl border bg-white transition-all",
                      isActive ? "border-brand-500 ring-2 ring-brand-200" : "border-border",
                    )}
                  >
                    <HanziCanvas
                      ref={(el) => {
                        canvasRefs.current[ci] = el;
                      }}
                      character={c}
                      size={canvasSize}
                    />
                    {/* Dashed cross lines */}
                    <div className="pointer-events-none absolute inset-2">
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-border" />
                      <div className="absolute bottom-0 top-0 left-1/2 -translate-x-1/2 border-l border-dashed border-border" />
                    </div>
                    {/* Counter badge top-right */}
                    <div
                      className={cn(
                        "absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        charMastered(ci)
                          ? "bg-emerald-500 text-white"
                          : count > 0
                            ? "bg-brand-500 text-white"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {charMastered(ci) ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> 3/3
                        </>
                      ) : (
                        <>{count}/3</>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active phase indicator */}
            {active && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
                <span className="zh font-bold text-brand-700">{chars[active.ci]}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold">Lần {active.phase}/3</span>
                <span className="text-muted-foreground">—</span>
                <span className="font-semibold text-brand-700">{PHASE_LABEL[active.phase]}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={animateAll} disabled={running}>
                <Play className="h-3.5 w-3.5" /> Xem thứ tự nét
              </Button>
              {running ? (
                <Button size="sm" variant="destructive" onClick={stopWriting}>
                  Dừng
                </Button>
              ) : (
                <Button size="sm" onClick={startWriting} disabled={wordMastered}>
                  <Pencil className="h-3.5 w-3.5" /> {wordMastered ? "Đã xong" : "Bắt đầu viết"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={resetAll} disabled={running}>
                Làm lại
              </Button>
            </div>

            <div className="text-center text-[11px] text-muted-foreground">
              <span className="font-semibold">3 lượt:</span> 1) theo gợi ý nét · 2) tô chữ mờ · 3) viết tự do
            </div>

            {wordMastered && (
              <div className="mx-auto w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Đã viết đúng {v.hanzi}!
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hán tự</div>
              <div className="zh mt-1 text-6xl font-bold text-brand-700">{v.hanzi}</div>
              {chars.length > 1 && (
                <div className="zh mt-2 flex flex-wrap gap-2 text-xs">
                  {chars.map((c, ci) => (
                    <span key={ci} className="rounded-md border bg-white px-2 py-1">
                      <span className="text-base font-bold">{c}</span>
                      <span className="ml-1 text-muted-foreground italic">{pinyinParts[ci] ?? ""}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-muted-foreground">Pinyin</div>
                <div className="mt-1 font-bold">{v.pinyin}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-muted-foreground">Nghĩa</div>
                <div className="mt-1 font-bold">{v.meaning}</div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                Trước
              </Button>
              <Button
                onClick={() => {
                  const ni = Math.min(total - 1, idx + 1);
                  setIdx(ni);
                  setVisited((s) => new Set(s).add(ni));
                }}
                disabled={idx >= total - 1}
              >
                Tiếp theo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {idx === total - 1 && visited.size < total && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const all = new Set<number>();
                  for (let i = 0; i < total; i++) all.add(i);
                  setVisited(all);
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> Đánh dấu đã luyện toàn bộ
              </Button>
            )}
            {visited.size === total && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Đã luyện hết {total} từ
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
