"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trophy,
  Volume2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import type { Quiz, QuizQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Answer {
  questionId: string;
  correct: boolean;
}

export function QuizPlayer({ quiz }: { quiz: Quiz }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const total = quiz.questions.length;
  const q = quiz.questions[idx];
  const done = idx >= total;
  const score = answers.filter((a) => a.correct).length;

  function record(correct: boolean) {
    if (!submitted) {
      setAnswers((a) => [...a, { questionId: q.id, correct }]);
      setSubmitted(true);
    }
  }

  function nextQ() {
    setSubmitted(false);
    setIdx((i) => i + 1);
  }

  function restart() {
    setIdx(0);
    setAnswers([]);
    setSubmitted(false);
  }

  if (done) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border bg-gradient-to-br from-brand-50 to-gold-50 p-10 text-center shadow-soft">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-soft">
            <Trophy className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-2xl font-bold">Hoàn thành quiz! 🎉</h2>
          <p className="mt-1 text-muted-foreground">
            Bạn trả lời đúng <span className="font-bold text-foreground">{score}/{total}</span> câu.
          </p>
          <div className="mt-4 text-5xl font-extrabold text-gradient-brand">{pct}%</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {pct >= 80 ? "Xuất sắc 太棒了！" : pct >= 60 ? "Khá tốt, tiếp tục cố lên!" : "Cần ôn thêm nhé!"}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="h-4 w-4" /> Làm lại
            </Button>
            <Button onClick={() => history.back()}>
              <ArrowRight className="h-4 w-4" /> Xong
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Câu <span className="font-bold text-foreground">{idx + 1}</span> / {total}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <Clock className="h-3 w-3" /> {quiz.durationMin} phút
          </Badge>
          <Badge variant="gold">{kindLabel[q.kind]}</Badge>
        </div>
      </div>
      <Progress value={(idx / total) * 100} className="mb-6" />

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl border bg-white p-8 shadow-soft"
        >
          <QuestionView question={q} submitted={submitted} onAnswer={record} />
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex justify-end">
        <Button onClick={nextQ} disabled={!submitted} size="lg">
          {idx === total - 1 ? "Xem kết quả" : "Câu tiếp theo"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const kindLabel: Record<QuizQuestion["kind"], string> = {
  "multiple-choice": "Trắc nghiệm",
  "fill-blank": "Điền từ",
  "type-pinyin": "Gõ Pinyin",
  "listen-choose": "Nghe — chọn",
  "sentence-order": "Sắp xếp câu",
  "match-pairs": "Ghép cặp",
};

function QuestionView({
  question,
  submitted,
  onAnswer,
}: {
  question: QuizQuestion;
  submitted: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  switch (question.kind) {
    case "multiple-choice":
      return <MultipleChoice q={question} submitted={submitted} onAnswer={onAnswer} />;
    case "fill-blank":
      return <FillBlank q={question} submitted={submitted} onAnswer={onAnswer} />;
    case "type-pinyin":
      return <TypePinyin q={question} submitted={submitted} onAnswer={onAnswer} />;
    case "listen-choose":
      return <ListenChoose q={question} submitted={submitted} onAnswer={onAnswer} />;
    case "sentence-order":
      return <SentenceOrder q={question} submitted={submitted} onAnswer={onAnswer} />;
    case "match-pairs":
      return <MatchPairs q={question} submitted={submitted} onAnswer={onAnswer} />;
  }
}

function speak(text: string) {
  if (typeof window === "undefined") return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* ---------- multiple-choice ---------- */
function MultipleChoice({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "multiple-choice" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div>
      {q.hanzi && (
        <div className="mb-4 flex items-center justify-center">
          <button
            onClick={() => speak(q.hanzi!)}
            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span className="zh text-2xl font-bold">{q.hanzi}</span>
          </button>
        </div>
      )}
      <h3 className="text-center text-xl font-semibold">{q.prompt}</h3>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = q.answer === i;
          const state = submitted
            ? isCorrect
              ? "correct"
              : isPicked
                ? "wrong"
                : "muted"
            : isPicked
              ? "active"
              : "idle";
          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => {
                setPicked(i);
                onAnswer(i === q.answer);
              }}
              className={cn(
                "rounded-xl border p-4 text-left text-sm font-medium transition-all",
                state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                state === "correct" && "border-emerald-500 bg-emerald-50",
                state === "wrong" && "border-rose-500 bg-rose-50",
                state === "muted" && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span>{opt}</span>
                {submitted && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {submitted && isPicked && !isCorrect && <XCircle className="h-4 w-4 text-rose-600" />}
              </div>
            </button>
          );
        })}
      </div>
      {submitted && q.explanation && (
        <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
          <span className="font-semibold">Giải thích: </span>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

/* ---------- fill-blank ---------- */
function FillBlank({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "fill-blank" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const [val, setVal] = useState("");
  const correct = val.trim() === q.answer.trim();
  return (
    <div>
      <h3 className="text-center text-lg font-semibold">Điền vào chỗ trống</h3>
      <div className="zh mt-6 text-center text-3xl font-bold">
        {q.prompt.split("___").map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span
                className={cn(
                  "inline-block min-w-[90px] mx-1 rounded-lg border-2 border-dashed px-3 py-1 align-middle",
                  submitted
                    ? correct
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-brand-300",
                )}
              >
                {submitted ? q.answer : val || "___"}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="mx-auto mt-6 max-w-sm">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Nhập đáp án..."
          disabled={submitted}
          className="text-center text-lg"
        />
        {q.hint && !submitted && (
          <div className="mt-2 text-center text-xs text-muted-foreground">Gợi ý: {q.hint}</div>
        )}
        {!submitted && (
          <Button
            className="mt-3 w-full"
            variant="outline"
            disabled={!val.trim()}
            onClick={() => onAnswer(correct)}
          >
            Kiểm tra
          </Button>
        )}
        {submitted && (
          <div
            className={cn(
              "mt-3 rounded-xl p-3 text-center text-sm font-semibold",
              correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}
          >
            {correct ? "Chính xác! 太棒了" : `Đáp án đúng: ${q.answer}`}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- type-pinyin ---------- */
function TypePinyin({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "type-pinyin" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const [val, setVal] = useState("");
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const correct = norm(val) === norm(q.answer);
  return (
    <div className="text-center">
      <h3 className="text-sm font-semibold text-muted-foreground">Gõ phiên âm Pinyin (có dấu)</h3>
      <div className="zh mt-4 text-7xl font-bold text-brand-600">{q.hanzi}</div>
      <div className="mt-2 text-sm text-muted-foreground">{q.meaning}</div>
      <button
        onClick={() => speak(q.hanzi)}
        className="mt-3 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-brand-600 hover:bg-brand-50"
      >
        <Volume2 className="h-3.5 w-3.5" /> Nghe phát âm
      </button>

      <div className="mx-auto mt-6 max-w-sm">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="vd: nǐ hǎo"
          disabled={submitted}
          className="text-center text-lg"
        />
        <div className="mt-2 flex flex-wrap justify-center gap-1 text-xs">
          {["ā ē ī ō ū", "á é í ó ú", "ǎ ě ǐ ǒ ǔ", "à è ì ò ù"].map((row) => (
            <span key={row} className="rounded bg-muted px-2 py-1 text-muted-foreground">{row}</span>
          ))}
        </div>
        {!submitted && (
          <Button className="mt-3 w-full" variant="outline" disabled={!val.trim()} onClick={() => onAnswer(correct)}>
            Kiểm tra
          </Button>
        )}
        {submitted && (
          <div className={cn("mt-3 rounded-xl p-3 text-sm font-semibold", correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {correct ? "Chính xác!" : `Đáp án đúng: ${q.answer}`}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- listen-choose ---------- */
function ListenChoose({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "listen-choose" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  // Audio mock: use Web Speech to "play" the answer hanzi
  const audioText = q.options[q.answer];
  return (
    <div>
      <h3 className="text-center text-sm font-semibold text-muted-foreground">Nghe và chọn Hán tự đúng</h3>
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => speak(audioText)}
          className="grid h-24 w-24 place-items-center rounded-full bg-gradient-brand text-white shadow-soft hover:scale-105 transition-transform"
        >
          <Volume2 className="h-9 w-9" />
        </button>
      </div>
      <div className="mt-2 text-center text-xs text-muted-foreground">Nhấn để nghe lại</div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = q.answer === i;
          const state = submitted ? (isCorrect ? "correct" : isPicked ? "wrong" : "muted") : isPicked ? "active" : "idle";
          return (
            <button
              key={i}
              disabled={submitted}
              onClick={() => {
                setPicked(i);
                onAnswer(i === q.answer);
              }}
              className={cn(
                "zh rounded-2xl border bg-white p-6 text-3xl font-bold transition-all",
                state === "idle" && "hover:border-brand-300 hover:bg-brand-50",
                state === "active" && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                state === "correct" && "border-emerald-500 bg-emerald-50 text-emerald-700",
                state === "wrong" && "border-rose-500 bg-rose-50 text-rose-700",
                state === "muted" && "opacity-60",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- sentence-order ---------- */
function SentenceOrder({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "sentence-order" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const shuffled = useMemo(() => {
    const arr = [...q.tokens];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  const [pool, setPool] = useState(shuffled);
  const [picked, setPicked] = useState<string[]>([]);

  const isCorrect = picked.join("|") === q.answer.join("|");

  function pick(token: string, idx: number) {
    if (submitted) return;
    setPool((p) => p.filter((_, i) => i !== idx));
    setPicked((p) => [...p, token]);
  }
  function unpick(idx: number) {
    if (submitted) return;
    const t = picked[idx];
    setPicked((p) => p.filter((_, i) => i !== idx));
    setPool((p) => [...p, t]);
  }

  return (
    <div>
      <h3 className="text-center text-sm font-semibold text-muted-foreground">
        Sắp xếp các từ thành câu đúng
      </h3>
      <p className="mt-2 text-center text-base">{q.translation}</p>

      <div
        className={cn(
          "zh mt-6 min-h-[80px] rounded-2xl border-2 border-dashed p-4 text-2xl flex flex-wrap items-center gap-2 justify-center",
          submitted ? (isCorrect ? "border-emerald-500 bg-emerald-50" : "border-rose-500 bg-rose-50") : "border-brand-200 bg-brand-50/40",
        )}
      >
        {picked.length === 0 && <span className="text-sm text-muted-foreground">Nhấn các từ bên dưới...</span>}
        {picked.map((t, i) => (
          <button
            key={`${t}-${i}`}
            onClick={() => unpick(i)}
            className="rounded-xl bg-white px-3 py-1.5 shadow-sm hover:bg-rose-50"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="zh mt-4 flex flex-wrap justify-center gap-2">
        {pool.map((t, i) => (
          <button
            key={`${t}-${i}`}
            onClick={() => pick(t, i)}
            className="rounded-xl border bg-white px-4 py-2 text-xl hover:bg-brand-50"
          >
            {t}
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="mt-5 flex justify-center">
          <Button variant="outline" disabled={picked.length !== q.answer.length} onClick={() => onAnswer(isCorrect)}>
            Kiểm tra
          </Button>
        </div>
      ) : (
        <div className={cn("zh mt-5 rounded-xl p-3 text-center", isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          {isCorrect ? "Chính xác!" : <>Đáp án đúng: <strong>{q.answer.join("")}</strong></>}
        </div>
      )}
    </div>
  );
}

/* ---------- match-pairs ---------- */
function MatchPairs({
  q,
  submitted,
  onAnswer,
}: {
  q: Extract<QuizQuestion, { kind: "match-pairs" }>;
  submitted: boolean;
  onAnswer: (c: boolean) => void;
}) {
  const lefts = q.pairs.map((p) => p.left);
  const rights = useMemo(() => {
    const arr = q.pairs.map((p) => p.right);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  const [selectedL, setSelectedL] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string | null>(null);

  function clickL(l: string) {
    if (submitted) return;
    setSelectedL(l);
  }
  function clickR(r: string) {
    if (submitted || !selectedL) return;
    const expected = q.pairs.find((p) => p.left === selectedL)?.right;
    if (expected === r) {
      setMatched((m) => ({ ...m, [selectedL]: r }));
      setSelectedL(null);
      if (Object.keys(matched).length + 1 === q.pairs.length) {
        onAnswer(true);
      }
    } else {
      setWrong(r);
      setTimeout(() => setWrong(null), 600);
    }
  }

  return (
    <div>
      <h3 className="text-center text-sm font-semibold text-muted-foreground">Ghép cặp Hán tự — Nghĩa</h3>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {lefts.map((l) => {
            const isMatched = !!matched[l];
            const isSelected = selectedL === l;
            return (
              <button
                key={l}
                disabled={isMatched || submitted}
                onClick={() => clickL(l)}
                className={cn(
                  "zh w-full rounded-xl border bg-white p-4 text-2xl font-bold transition-all",
                  isMatched && "border-emerald-400 bg-emerald-50 text-emerald-700 opacity-70",
                  isSelected && "border-brand-500 bg-brand-50 ring-2 ring-brand-200",
                  !isMatched && !isSelected && "hover:border-brand-300",
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r) => {
            const isMatched = Object.values(matched).includes(r);
            const isWrong = wrong === r;
            return (
              <button
                key={r}
                disabled={isMatched || submitted}
                onClick={() => clickR(r)}
                className={cn(
                  "w-full rounded-xl border bg-white p-4 text-base font-semibold transition-all",
                  isMatched && "border-emerald-400 bg-emerald-50 text-emerald-700 opacity-70",
                  isWrong && "border-rose-500 bg-rose-50 animate-pulse-soft",
                  !isMatched && !isWrong && "hover:border-brand-300",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Đã ghép {Object.keys(matched).length}/{q.pairs.length}
      </div>
    </div>
  );
}
