"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type QuizPhase = 1 | 2 | 3;

export interface HanziCanvasHandle {
  animate: () => Promise<void>;
  quiz: (opts?: { phase?: QuizPhase; onComplete?: () => void }) => void;
  cancel: () => void;
  reset: () => void;
}

interface Props {
  character: string;
  size?: number;
  onComplete?: () => void;
}

export const HanziCanvas = forwardRef<HanziCanvasHandle, Props>(function HanziCanvas(
  { character, size = 320, onComplete },
  ref,
) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writerRef = useRef<any>(null);
  const cancelFnRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function init() {
      if (!targetRef.current) return;
      targetRef.current.innerHTML = "";
      try {
        const HanziWriter = (await import("hanzi-writer")).default;
        if (cancelled || !targetRef.current) return;
        const writer = HanziWriter.create(targetRef.current, character, {
          width: size,
          height: size,
          padding: 8,
          strokeColor: "#e11d48",
          radicalColor: "#0ea5e9",
          outlineColor: "#e5e7eb",
          drawingColor: "#0ea5e9",
          highlightColor: "#fb7185",
          strokeAnimationSpeed: 1.1,
          delayBetweenStrokes: 180,
          showCharacter: true,
          showOutline: true,
          showHintAfterMisses: 2,
        });
        writerRef.current = writer;
      } catch (e) {
        if (!cancelled) {
          setError("Không tải được dữ liệu nét cho ký tự này.");
          console.error(e);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelFnRef.current?.();
      cancelFnRef.current = null;
      writerRef.current = null;
    };
  }, [character, size]);

  useImperativeHandle(ref, () => ({
    animate: () =>
      new Promise<void>((resolve) => {
        const w = writerRef.current;
        if (!w) {
          resolve();
          return;
        }
        cancelFnRef.current?.();
        cancelFnRef.current = null;
        w.cancelQuiz?.();
        w.showCharacter();
        w.animateCharacter({ onComplete: () => resolve() });
      }),
    quiz: (opts) => {
      const w = writerRef.current;
      if (!w) return;
      const phase = opts?.phase ?? 1;
      // Huỷ orchestration cũ (nếu có)
      cancelFnRef.current?.();
      cancelFnRef.current = null;
      w.cancelQuiz?.();
      w.hideCharacter();
      if (phase === 3) {
        w.hideOutline?.();
      } else {
        w.showOutline?.();
      }

      if (phase === 1) {
        // Phase 1: demo nét hiện tại bằng animation, lặp lại cho tới khi user viết đúng
        let cancelledPhase = false;
        let demoTimer: ReturnType<typeof setTimeout> | null = null;
        let currentStroke = 0;

        const clearDemo = () => {
          if (demoTimer) {
            clearTimeout(demoTimer);
            demoTimer = null;
          }
        };

        const loopDemo = () => {
          if (cancelledPhase) return;
          const writer = writerRef.current;
          if (!writer) return;
          writer.highlightStroke?.(currentStroke, {
            onComplete: () => {
              if (cancelledPhase) return;
              // Sau khi flash xong, đợi một chút rồi lặp lại nếu user chưa vẽ
              demoTimer = setTimeout(loopDemo, 1300);
            },
          });
        };

        w.quiz({
          showHintAfterMisses: 99, // tự orchestrate, không dùng hint mặc định
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onCorrectStroke: ({ strokeNum, strokesRemaining }: any) => {
            clearDemo();
            currentStroke = strokeNum + 1;
            if (strokesRemaining > 0 && !cancelledPhase) {
              demoTimer = setTimeout(loopDemo, 400);
            }
          },
          onMistake: () => {
            clearDemo();
            if (!cancelledPhase) loopDemo();
          },
          onComplete: () => {
            cancelledPhase = true;
            clearDemo();
            onComplete?.();
            opts?.onComplete?.();
          },
        });

        // Bắt đầu demo nét đầu tiên sau khi quiz init
        demoTimer = setTimeout(loopDemo, 500);

        cancelFnRef.current = () => {
          cancelledPhase = true;
          clearDemo();
          writerRef.current?.cancelQuiz?.();
        };
        return;
      }

      // Phase 2+3: chỉ điều chỉnh outline, không demo
      w.quiz({
        showHintAfterMisses: 99,
        onComplete: () => {
          onComplete?.();
          opts?.onComplete?.();
        },
      });
    },
    cancel: () => {
      cancelFnRef.current?.();
      cancelFnRef.current = null;
      const w = writerRef.current;
      w?.cancelQuiz?.();
    },
    reset: () => {
      cancelFnRef.current?.();
      cancelFnRef.current = null;
      const w = writerRef.current;
      if (!w) return;
      w.cancelQuiz?.();
      w.showOutline?.();
      w.showCharacter();
    },
  }));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div ref={targetRef} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-amber-50/80 p-4 text-center text-xs text-amber-700">
          {error}
        </div>
      )}
    </div>
  );
});
