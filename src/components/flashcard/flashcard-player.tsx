"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

/** Thẻ từ vựng tối thiểu để ôn — khớp vocab_items trong Supabase. */
export interface FlashVocab {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  example?: { zh: string; pinyin?: string; vi: string } | null;
  audio_url?: string | null;
  level?: string | null;
}

type Difficulty = "again" | "hard" | "good" | "easy";

export function FlashcardPlayer({ vocab }: { vocab: FlashVocab[] }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<Record<Difficulty, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const total = vocab.length;
  const card = vocab[idx];
  const done = idx >= total;
  const progress = useMemo(() => (idx / total) * 100, [idx, total]);

  function next(d: Difficulty) {
    setStats((s) => ({ ...s, [d]: s[d] + 1 }));
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  function speak() {
    if (typeof window === "undefined" || !card) return;
    if (card.audio_url) {
      new Audio(card.audio_url).play().catch(() => {});
      return;
    }
    const u = new SpeechSynthesisUtterance(card.hanzi);
    u.lang = "zh-CN";
    u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function restart() {
    setIdx(0);
    setFlipped(false);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
  }

  if (done) {
    const score = stats.good * 2 + stats.easy * 3 + stats.hard;
    const max = total * 3;
    const pct = Math.round((score / max) * 100);
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border bg-gradient-to-br from-brand-50 to-gold-50 p-10 text-center shadow-soft">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-white shadow-soft">
            <Trophy className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-2xl font-bold">Hoàn thành bộ thẻ! 🎉</h2>
          <p className="mt-1 text-muted-foreground">
            Bạn đã ôn xong <span className="font-bold text-foreground">{total}</span> từ.
          </p>
          <div className="mt-6 grid grid-cols-4 gap-2 text-center">
            <Stat label="Quên" value={stats.again} tint="bg-rose-100 text-rose-600" />
            <Stat label="Khó" value={stats.hard} tint="bg-amber-100 text-amber-700" />
            <Stat label="OK" value={stats.good} tint="bg-sky-100 text-sky-700" />
            <Stat label="Dễ" value={stats.easy} tint="bg-emerald-100 text-emerald-700" />
          </div>
          <div className="mt-6 text-sm text-muted-foreground">Hiệu suất</div>
          <div className="text-4xl font-extrabold text-gradient-brand">{pct}%</div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={restart} variant="outline">
              <RotateCcw className="h-4 w-4" /> Ôn lại
            </Button>
            <Button onClick={() => history.back()}>
              <ArrowRight className="h-4 w-4" /> Hoàn thành
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Thẻ <span className="font-bold text-foreground">{idx + 1}</span> / {total}
        </span>
        {card.level && (
          <Badge variant="gold">
            <Sparkles className="h-3 w-3" /> {card.level}
          </Badge>
        )}
      </div>
      <Progress value={progress} className="mb-6" />

      <div className="relative" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id + (flipped ? "-b" : "-f")}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={() => setFlipped((f) => !f)}
            className="cursor-pointer select-none rounded-3xl border bg-white shadow-soft min-h-[360px] flex flex-col items-center justify-center p-10 text-center"
          >
            {!flipped ? (
              <>
                <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Nhấn để lật thẻ
                </div>
                <div className="zh text-8xl font-bold text-brand-600">
                  {card.hanzi}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    speak();
                  }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                >
                  <Volume2 className="h-4 w-4" /> Nghe phát âm
                </button>
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Pinyin
                </div>
                <div className="mt-1 text-3xl font-bold text-foreground">{card.pinyin}</div>
                <div className="my-4 h-px w-16 bg-border" />
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Nghĩa
                </div>
                <div className="mt-1 text-2xl font-bold">{card.meaning}</div>
                {card.example && (
                  <div className="mt-5 rounded-2xl bg-muted/60 p-4 text-left max-w-md">
                    <div className="zh text-lg font-medium">{card.example.zh}</div>
                    <div className="text-sm text-muted-foreground">{card.example.pinyin}</div>
                    <div className="mt-1 text-sm">→ {card.example.vi}</div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Button variant="outline" onClick={() => next("again")} className="border-rose-200 text-rose-600 hover:bg-rose-50">
          😵 Quên
        </Button>
        <Button variant="outline" onClick={() => next("hard")} className="border-amber-200 text-amber-700 hover:bg-amber-50">
          😅 Khó
        </Button>
        <Button variant="outline" onClick={() => next("good")} className="border-sky-200 text-sky-700 hover:bg-sky-50">
          🙂 OK
        </Button>
        <Button onClick={() => next("easy")} variant="gold">
          😎 Dễ
        </Button>
      </div>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFlipped(false);
            setIdx((i) => Math.max(0, i - 1));
          }}
        >
          <ArrowLeft className="h-3 w-3" /> Quay lại
        </Button>
        <Button variant="ghost" size="sm" onClick={restart}>
          <RotateCcw className="h-3 w-3" /> Bắt đầu lại
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className={`mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${tint}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
