"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Gamepad2, RotateCcw, Volume2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { speakZh, type ClassroomStudent, type PointReason } from "@/lib/db-classroom";
import type { VocabRow } from "@/lib/db-content";

type Game = "menu" | "memory" | "quick" | "listen";

const GAMES: { key: Exclude<Game, "menu">; title: string; desc: string; emoji: string }[] = [
  {
    key: "quick",
    title: "Ai nhanh hơn",
    desc: "Chiếu nghĩa tiếng Việt, học viên giành quyền chọn chữ Hán đúng.",
    emoji: "⚡",
  },
  {
    key: "listen",
    title: "Nghe đoán chữ",
    desc: "Máy đọc từ bằng giọng Trung, học viên chọn chữ vừa nghe.",
    emoji: "🎧",
  },
  {
    key: "memory",
    title: "Lật thẻ trí nhớ",
    desc: "Ghép chữ Hán với nghĩa — chơi theo đội, tính giờ.",
    emoji: "🃏",
  },
];

/** Xáo mảng (bản sao) — dùng chung cho mọi trò. */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Trò chơi từ vựng lấy đúng bộ từ của bài đang dạy. Mọi trò đều kết thúc bằng
 * việc chọn học viên để cộng ★ — giáo viên không phải rời màn hình lớp học.
 */
export function GameStage({
  vocab,
  students,
  onAward,
}: {
  vocab: VocabRow[];
  students: ClassroomStudent[];
  onAward: (studentId: string, points: number, reason: PointReason) => void;
}) {
  const [game, setGame] = useState<Game>("menu");

  if (!vocab.length) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-ink-800 bg-ink-900 text-center text-ink-300">
        <div className="max-w-md p-8">
          <Gamepad2 className="mx-auto mb-3 h-10 w-10 opacity-60" />
          <div className="font-semibold text-white">Chưa có từ vựng để chơi</div>
          <p className="mt-1 text-sm">
            Gán bài học có từ vựng cho buổi (trang chi tiết buổi) là các trò chơi tự lấy từ của bài.
          </p>
        </div>
      </div>
    );
  }

  if (game === "menu") {
    return (
      <div className="flex h-full flex-col justify-center gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-8">
        <div className="text-center">
          <div className="text-lg font-bold text-white">Chọn trò chơi</div>
          <p className="text-sm text-ink-300">{vocab.length} từ của bài đang dạy</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {GAMES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGame(g.key)}
              className="rounded-2xl border border-ink-700 bg-ink-800 p-5 text-left transition-colors hover:border-brand-500 hover:bg-ink-700"
            >
              <div className="text-3xl">{g.emoji}</div>
              <div className="mt-2 text-base font-bold text-white">{g.title}</div>
              <p className="mt-1 text-xs text-ink-300">{g.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setGame("menu")} className="text-ink-200">
          ← Trò khác
        </Button>
        <span className="text-sm font-bold text-white">
          {GAMES.find((g) => g.key === game)?.title}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {game === "memory" ? (
          <MemoryGame vocab={vocab} students={students} onAward={onAward} />
        ) : (
          <ChoiceGame kind={game} vocab={vocab} students={students} onAward={onAward} />
        )}
      </div>
    </div>
  );
}

/** Hàng avatar để chọn ai được cộng điểm sau mỗi câu đúng. */
function AwardRow({
  students,
  onAward,
  label = "Ai trả lời đúng?",
  points = 1,
}: {
  students: ClassroomStudent[];
  onAward: (studentId: string, points: number, reason: PointReason) => void;
  label?: string;
  points?: number;
}) {
  const [given, setGiven] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 p-2">
      <span className="px-1 text-xs font-semibold text-ink-300">{label}</span>
      {students.map((s) => (
        <button
          key={s.id}
          onClick={() => {
            onAward(s.id, points, "game");
            setGiven(s.id);
            window.setTimeout(() => setGiven(null), 1200);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
            given === s.id ? "bg-gold-600 text-white" : "bg-ink-800 text-ink-100 hover:bg-ink-700",
          )}
          title={`+${points} ★ cho ${s.name}`}
        >
          <Avatar name={s.name} src={s.avatar ?? undefined} size={20} className="ring-ink-700" />
          {s.name.split(" ").slice(-1)[0]}
          {given === s.id && <Check className="h-3 w-3" />}
        </button>
      ))}
    </div>
  );
}

/* ===================== Ai nhanh hơn / Nghe đoán chữ ===================== */

function ChoiceGame({
  kind,
  vocab,
  students,
  onAward,
}: {
  kind: "quick" | "listen";
  vocab: VocabRow[];
  students: ClassroomStudent[];
  onAward: (studentId: string, points: number, reason: PointReason) => void;
}) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const { answer, options } = useMemo(() => {
    const answer = vocab[Math.floor(Math.random() * vocab.length)];
    const distractors = shuffle(vocab.filter((v) => v.id !== answer.id)).slice(0, 3);
    return { answer, options: shuffle([answer, ...distractors]) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, vocab]);

  const speak = useCallback(() => speakZh(answer.hanzi), [answer]);

  useEffect(() => {
    if (kind === "listen") speak();
  }, [kind, speak]);

  function choose(id: string) {
    if (picked) return;
    setPicked(id);
    setScore((s) => ({ right: s.right + (id === answer.id ? 1 : 0), total: s.total + 1 }));
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 rounded-2xl border border-ink-800 bg-ink-900 p-6">
        {kind === "quick" ? (
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Chữ Hán nào có nghĩa
            </div>
            <div className="mt-2 text-4xl font-extrabold text-white">{answer.meaning}</div>
          </div>
        ) : (
          <button
            onClick={speak}
            className="flex flex-col items-center gap-2 rounded-2xl bg-ink-800 px-10 py-6 hover:bg-ink-700"
          >
            <Volume2 className="h-10 w-10 text-brand-300" />
            <span className="text-sm font-semibold text-ink-200">Nghe lại</span>
          </button>
        )}

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          {options.map((o) => {
            const isAnswer = o.id === answer.id;
            const show = picked !== null;
            return (
              <button
                key={o.id}
                onClick={() => choose(o.id)}
                className={cn(
                  "zh rounded-2xl border-2 py-6 text-5xl font-bold transition-colors",
                  !show
                    ? "border-ink-700 bg-ink-800 text-white hover:border-brand-500"
                    : isAnswer
                      ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                      : picked === o.id
                        ? "border-gold-600 bg-gold-600/20 text-gold-200"
                        : "border-ink-800 bg-ink-900 text-ink-500",
                )}
              >
                {o.hanzi}
                {show && isAnswer && (
                  <div className="mt-1 text-sm font-semibold text-emerald-300">
                    {o.pinyin} · {o.meaning}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-sm text-ink-300">
          <span>
            Đúng {score.right}/{score.total}
          </span>
          <Button
            onClick={() => {
              setPicked(null);
              setRound((r) => r + 1);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Câu tiếp theo
          </Button>
        </div>
      </div>

      <AwardRow students={students} onAward={onAward} />
    </div>
  );
}

/* ===================== Lật thẻ trí nhớ ===================== */

interface MemoryCard {
  key: string;
  pairId: string;
  text: string;
  zh: boolean;
}

function MemoryGame({
  vocab,
  students,
  onAward,
}: {
  vocab: VocabRow[];
  students: ClassroomStudent[];
  onAward: (studentId: string, points: number, reason: PointReason) => void;
}) {
  const [size, setSize] = useState(6);
  const [seed, setSeed] = useState(0);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);

  const cards = useMemo(() => {
    const picks = shuffle(vocab).slice(0, Math.min(size, vocab.length));
    const all: MemoryCard[] = picks.flatMap((v) => [
      { key: `${v.id}-zh`, pairId: v.id, text: v.hanzi, zh: true },
      { key: `${v.id}-vi`, pairId: v.id, text: v.meaning, zh: false },
    ]);
    return shuffle(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, size, seed]);

  function flip(card: MemoryCard) {
    if (matched.includes(card.pairId) || open.includes(card.key) || open.length === 2) return;
    const next = [...open, card.key];
    setOpen(next);
    if (card.zh) speakZh(card.text);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((k) => cards.find((c) => c.key === k)!);
      if (a.pairId === b.pairId) {
        setMatched((m) => [...m, a.pairId]);
        window.setTimeout(() => setOpen([]), 350);
      } else {
        window.setTimeout(() => setOpen([]), 900);
      }
    }
  }

  const done = matched.length === Math.min(size, vocab.length);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-300">Số cặp:</span>
        {[4, 6, 8].map((n) => (
          <button
            key={n}
            onClick={() => {
              setSize(n);
              setSeed((s) => s + 1);
              setOpen([]);
              setMatched([]);
              setMoves(0);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold",
              size === n ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700",
            )}
          >
            {n}
          </button>
        ))}
        <span className="ml-2 text-sm text-ink-300">Lượt lật: {moves}</span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => {
            setSeed((s) => s + 1);
            setOpen([]);
            setMatched([]);
            setMoves(0);
          }}
        >
          <RotateCcw className="h-4 w-4" /> Ván mới
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-ink-800 bg-ink-900 p-4">
        {done && (
          <div className="mb-3 rounded-xl border border-emerald-600/50 bg-emerald-600/10 p-3 text-center text-sm font-semibold text-emerald-200">
            Hoàn thành sau {moves} lượt lật! Thưởng ★ cho đội thắng ở hàng dưới.
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {cards.map((c) => {
            const isOpen = open.includes(c.key) || matched.includes(c.pairId);
            return (
              <button
                key={c.key}
                onClick={() => flip(c)}
                className={cn(
                  "flex h-24 items-center justify-center rounded-2xl border-2 p-2 text-center transition-all",
                  matched.includes(c.pairId)
                    ? "border-emerald-500 bg-emerald-600/15 text-emerald-200"
                    : isOpen
                      ? "border-brand-500 bg-ink-800 text-white"
                      : "border-ink-700 bg-ink-800 text-ink-600 hover:border-brand-500",
                )}
              >
                {isOpen ? (
                  <span className={cn(c.zh ? "zh text-3xl font-bold" : "text-sm font-semibold")}>{c.text}</span>
                ) : (
                  <span className="text-2xl">🀄</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AwardRow students={students} onAward={onAward} label="Thưởng ★ cho:" points={2} />
    </div>
  );
}

/* ===================== Bảng xếp hạng ===================== */

/** Bảng ★ chiếu lên máy chiếu — dùng đầu buổi sau hoặc cuối giờ để tổng kết. */
export function LeaderboardStage({
  students,
  totals,
}: {
  students: ClassroomStudent[];
  totals: Record<string, number>;
}) {
  const rows = students
    .map((s) => ({ ...s, points: totals[s.id] ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const medals = ["🥇", "🥈", "🥉"];

  if (!rows.some((r) => r.points !== 0)) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-ink-800 bg-ink-900 text-center text-ink-300">
        <div className="max-w-sm p-8">
          <div className="text-4xl">🏆</div>
          <div className="mt-2 font-semibold text-white">Chưa có điểm nào trong buổi</div>
          <p className="mt-1 text-sm">Chạm học viên ở cột bên phải để cộng ★, bảng này sẽ hiện ngay.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 rounded-2xl border border-ink-800 bg-ink-900 p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {top.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 p-4",
              i === 0 ? "border-gold-500 bg-gold-600/15" : "border-ink-700 bg-ink-800",
            )}
          >
            <div className="text-4xl">{medals[i]}</div>
            <Avatar name={s.name} src={s.avatar ?? undefined} size={56} className="mt-2 ring-ink-700" />
            <div className="mt-2 text-center text-sm font-bold text-white">{s.name}</div>
            <div className="mt-1 text-2xl font-extrabold text-gold-300">{s.points} ★</div>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1.5">
          {rest.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-ink-800 px-3 py-2">
              <span className="w-6 text-center text-sm font-bold text-ink-400">{i + 4}</span>
              <Avatar name={s.name} src={s.avatar ?? undefined} size={28} className="ring-ink-700" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{s.name}</span>
              <span className="text-sm font-extrabold tabular-nums text-ink-200">{s.points} ★</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
