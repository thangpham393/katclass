"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, PenLine, Play, Repeat, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { speakZh } from "@/lib/db-classroom";
import type { VocabRow } from "@/lib/db-content";

type Writer = {
  animateCharacter: () => void;
  loopCharacterAnimation: () => void;
  pauseAnimation: () => void;
  showCharacter: () => void;
  hideCharacter: () => void;
  quiz: (opts: { onComplete?: (s: { totalMistakes: number }) => void }) => void;
  cancelQuiz: () => void;
};

const SPEEDS: { label: string; value: number }[] = [
  { label: "Chậm", value: 0.5 },
  { label: "Vừa", value: 1 },
  { label: "Nhanh", value: 2 },
];

/** Chỉ giữ chữ Hán trong chuỗi (bỏ pinyin, dấu câu, khoảng trắng). */
function hanChars(text: string): string[] {
  return Array.from(text).filter((c) => /[一-鿿]/.test(c));
}

/**
 * Luyện nét chữ Hán bằng hanzi-writer: viết mẫu từng nét theo đúng thứ tự, lặp
 * lại, hoặc bật chế độ đố để học viên lên viết trực tiếp trên màn hình cảm ứng
 * — máy chấm đúng/sai từng nét.
 *
 * Dữ liệu nét tải từ CDN nên cần mạng; mất mạng thì dùng Bảng viết 田字格.
 */
export function StrokeStage({ vocab }: { vocab: VocabRow[] }) {
  const target = useRef<HTMLDivElement>(null);
  const writer = useRef<Writer | null>(null);
  const [char, setChar] = useState("");
  const [speed, setSpeed] = useState(1);
  const [quizing, setQuizing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chữ gợi ý: các chữ Hán xuất hiện trong từ vựng của bài đang dạy
  const suggestions = Array.from(new Set(vocab.flatMap((v) => hanChars(v.hanzi)))).slice(0, 60);
  const current = char || suggestions[0] || "你";

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setQuizing(false);
    setError(null);
    if (!target.current) return;
    target.current.innerHTML = "";

    import("hanzi-writer")
      .then(({ default: HanziWriter }) => {
        if (cancelled || !target.current) return;
        writer.current = HanziWriter.create(target.current, current, {
          width: 340,
          height: 340,
          padding: 12,
          showOutline: true,
          strokeAnimationSpeed: speed,
          delayBetweenStrokes: 220,
          strokeColor: "#111827",
          outlineColor: "#d1d5db",
          radicalColor: "#dc2626",
          drawingColor: "#2549ec",
          highlightColor: "#fbbf24",
        }) as unknown as Writer;
        writer.current.animateCharacter();
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được dữ liệu nét chữ (cần mạng). Dùng tạm Bảng viết 田字格.");
      });

    return () => {
      cancelled = true;
    };
  }, [current, speed]);

  function startQuiz() {
    setResult(null);
    setQuizing(true);
    writer.current?.quiz({
      onComplete: ({ totalMistakes }) => {
        setQuizing(false);
        setResult(
          totalMistakes === 0
            ? "Viết đúng toàn bộ nét — giỏi lắm! 🎉"
            : `Hoàn thành với ${totalMistakes} nét sai — viết lại lần nữa nhé.`,
        );
      },
    });
  }

  const meaning = vocab.find((v) => v.hanzi.includes(current));

  return (
    <div className="flex h-full min-h-0 gap-4">
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4">
        <div className="rounded-3xl border border-ink-700 bg-white p-2">
          <div ref={target} className="h-[340px] w-[340px]" />
        </div>

        {error ? (
          <p className="text-sm font-semibold text-gold-300">{error}</p>
        ) : result ? (
          <p className="text-sm font-semibold text-gold-300">{result}</p>
        ) : (
          <p className="text-sm text-ink-300">
            {quizing ? "Học viên viết trực tiếp lên khung — máy chấm từng nét." : "Bấm Viết mẫu để xem thứ tự nét."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => writer.current?.animateCharacter()}>
            <Play className="h-4 w-4" /> Viết mẫu
          </Button>
          <Button variant="secondary" onClick={() => writer.current?.loopCharacterAnimation()}>
            <Repeat className="h-4 w-4" /> Lặp lại
          </Button>
          <Button variant={quizing ? "gold" : "outline"} onClick={quizing ? () => { writer.current?.cancelQuiz(); setQuizing(false); } : startQuiz}>
            <PenLine className="h-4 w-4" /> {quizing ? "Dừng đố" : "Học viên viết thử"}
          </Button>
          <button
            onClick={() => writer.current?.showCharacter()}
            className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-100 hover:bg-ink-700"
            title="Hiện chữ"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => writer.current?.hideCharacter()}
            className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-100 hover:bg-ink-700"
            title="Ẩn chữ"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={() => speakZh(current)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-100 hover:bg-ink-700"
            title="Đọc mẫu"
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
            {SPEEDS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold",
                  speed === s.value ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-ink-700",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-64 shrink-0 flex-col gap-2 rounded-2xl border border-ink-800 bg-ink-900 p-3">
        <input
          value={char}
          onChange={(e) => setChar(hanChars(e.target.value).slice(-1)[0] ?? "")}
          placeholder="Gõ một chữ Hán…"
          className="zh h-11 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 text-center text-2xl text-white placeholder:text-sm placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {meaning && (
          <div className="rounded-lg bg-ink-800 p-2 text-center">
            <div className="text-sm font-semibold text-brand-300">{meaning.pinyin}</div>
            <div className="text-xs text-ink-200">{meaning.meaning}</div>
          </div>
        )}
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          Chữ trong bài
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {suggestions.length === 0 ? (
            <p className="text-xs text-ink-400">Buổi chưa gán bài có từ vựng — gõ chữ vào ô trên.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {suggestions.map((c) => (
                <button
                  key={c}
                  onClick={() => setChar(c)}
                  className={cn(
                    "zh grid h-12 place-items-center rounded-lg text-2xl transition-colors",
                    c === current ? "bg-brand-600 text-white" : "bg-ink-800 text-white hover:bg-ink-700",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
