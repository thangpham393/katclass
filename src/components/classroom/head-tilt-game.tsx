"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Flame, Home, Pause, Play, RotateCcw, Trophy, X } from "lucide-react";
import type { VocabRow } from "@/lib/db-content";
import type { TiltSide } from "@/lib/head-tilt";
import { HeadTiltCamera, type TiltMotion } from "./head-tilt-camera";
import "./head-tilt-game.css";

function makeRounds(vocab: VocabRow[]) {
  const words = Array.from(new Map(vocab.map((word) => [word.hanzi, word])).values());
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((answer) => {
    const others = words.filter((word) => word.id !== answer.id);
    const other = others[Math.floor(Math.random() * others.length)];
    return { answer, options: Math.random() < .5 ? [answer, other] : [other, answer] };
  });
}

export function HeadTiltGame({ vocab, active, onExit, children }: {
  vocab: VocabRow[];
  active: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  const [rounds, setRounds] = useState<ReturnType<typeof makeRounds>>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<TiltSide | null>(null);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [cameraRound, setCameraRound] = useState(0);
  const [motion, setMotion] = useState<TiltMotion>({ side: null, progress: 0, angle: 0 });
  const locked = useRef(false);
  const question = rounds[index];
  const correct = picked !== null && question.options[picked === "left" ? 0 : 1]?.id === question.answer.id;

  function choose(side: TiltSide) {
    if (locked.current || paused || finished || !active) return;
    locked.current = true;
    setPicked(side);
    if (question.options[side === "left" ? 0 : 1].id === question.answer.id) {
      setRight((value) => value + 1);
      setScore((value) => value + 10 + ((streak + 1) % 3 === 0 ? 10 : 0));
      setStreak((value) => value + 1);
    } else setStreak(0);
  }

  const next = useCallback(() => {
    if (picked === null) return;
    if (index === rounds.length - 1) { setFinished(true); return; }
    setIndex((value) => value + 1);
    setPicked(null);
    locked.current = false;
    setCameraRound((value) => value + 1);
    setMotion({ side: null, progress: 0, angle: 0 });
  }, [picked, index, rounds.length]);

  useEffect(() => {
    if (picked === null || paused || !active || finished) return;
    const timer = window.setTimeout(next, 1000);
    return () => window.clearTimeout(timer);
  }, [picked, paused, active, finished, next]);

  function restart() {
    setRounds(makeRounds(vocab));
    setIndex(0); setPicked(null); setPaused(false); setScore(0); setRight(0); setStreak(0); setFinished(false);
    locked.current = false;
    setCameraRound((value) => value + 1);
    setMotion({ side: null, progress: 0, angle: 0 });
  }

  const vocabKey = JSON.stringify(vocab.map(({ id, hanzi, pinyin, meaning }) => [id, hanzi, pinyin, meaning]));
  useEffect(() => {
    restart();
    // Shuffle only in the browser, and preserve the round on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabKey]);

  useEffect(() => {
    if (!active) return;
    function key(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.isComposing || target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        choose(event.key === "ArrowLeft" ? "left" : "right");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // The listener must use the current round, pause and streak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, finished, question, streak]);

  if (!rounds.length) return <div className="tilt-game tilt-empty" role="status">Đang chuẩn bị thử thách…</div>;
  if (rounds.length < 2) return <div className="tilt-game tilt-empty"><h2>Cần thêm từ vựng</h2><p>Chọn bài có ít nhất hai chữ Hán khác nhau để chơi.</p><button onClick={onExit}>← Trò khác</button></div>;

  return (
    <div className="tilt-game">
      <header className="tilt-header">
        <div className="tilt-round"><strong>Câu {index + 1}<span> / {rounds.length}</span></strong><span className="tilt-pill">TỪ VỰNG BÀI HỌC</span>
          <div className="tilt-round-track"><i style={{ width: `${(index + (picked ? 1 : 0)) / rounds.length * 100}%` }} /></div>
        </div>
        <div className="tilt-brand"><span className="tilt-brand-icon zh">汉</span><div><b>NGHIÊNG ĐẦU CHỌN CHỮ</b><span className="zh">汉字大挑战</span></div></div>
        <div className="tilt-score"><Trophy size={17} /><div><small>ĐIỂM CỦA BẠN</small><strong>{score}<span> điểm</span></strong></div></div>
      </header>

      {finished ? <section className="tilt-finish"><div className="tilt-trophy">🏆</div><span className="tilt-eyebrow">HOÀN THÀNH THỬ THÁCH</span><h2>Chơi rất tuyệt!</h2><p>Đúng {right}/{rounds.length} câu · <strong>{score} điểm</strong></p><button className="tilt-primary" onClick={restart}><RotateCcw size={17} /> Chơi lại</button></section> : <>
        <div className="tilt-question"><span className="tilt-streak-pill"><Flame size={14} /> Chuỗi đúng <b>{streak}</b></span><div className="tilt-eyebrow">THỬ THÁCH PHẢN XẠ</div><h2>“{question.answer.meaning}” là từ nào?</h2><span className="tilt-live"><i /> {paused ? "ĐANG TẠM DỪNG" : picked ? "ĐÃ CHỌN ĐÁP ÁN" : "NGHIÊNG ĐẦU ĐỂ CHỌN"}</span></div>
        <div className="tilt-arena">
          {(["left", "right"] as const).map((side, optionIndex) => {
            const word = question.options[optionIndex];
            const revealed = picked !== null;
            const isRight = word.id === question.answer.id;
            const state = revealed ? isRight ? "correct" : picked === side ? "wrong" : "dimmed" : motion.side === side ? "tracking" : "idle";
            return <button key={`${index}-${side}`} className={`tilt-card tilt-card-${side} tilt-card-${state}`} onClick={() => choose(side)} disabled={paused || revealed || !active} aria-label={`Chọn ${side === "left" ? "trái" : "phải"}: ${word.hanzi}`}>
              <span className="tilt-card-direction">{side === "left" && <ArrowLeft size={18} />} CHỌN {side === "left" ? "TRÁI" : "PHẢI"} {side === "right" && <ArrowRight size={18} />}</span>
              <span className="tilt-hanzi zh">{word.hanzi}</span><span className="tilt-pinyin">{word.pinyin}</span>
              <span className="tilt-card-caption">{revealed ? word.meaning : "Nghiêng đầu về phía này"}</span>
              {revealed && isRight && <span className="tilt-card-badge"><Check size={24} /></span>}
              {revealed && !isRight && picked === side && <span className="tilt-card-badge"><X size={24} /></span>}
              <span className="tilt-card-fill" style={{ width: `${!revealed && motion.side === side ? motion.progress * 100 : 0}%` }} />
            </button>;
          })}
          <div className="tilt-camera-position"><HeadTiltCamera active={active} answered={picked !== null} paused={paused} round={cameraRound} onChoose={choose} onMotion={setMotion} /></div>
        </div>
        <div className="tilt-feedback" role="status">
          {picked ? correct ? <span className="tilt-feedback-correct">{streak % 3 === 0 ? <><Flame size={21} /> {streak} CÂU ĐÚNG LIÊN TIẾP! +20 điểm</> : <><Check size={21} /> Chính xác! +10 điểm</>}</span> : <span className="tilt-feedback-wrong">Đáp án đúng: {question.answer.hanzi} · {question.answer.pinyin}</span> : <span className="tilt-feedback-idle">Hai lựa chọn. Một cái nghiêng đầu.</span>}
          <p>← Chọn trái <span>{picked ? "Tự chuyển câu sau 1 giây" : "Giữ nghiêng khoảng 1 giây để chọn"}</span> Chọn phải →</p>
        </div>
      </>}

      <footer className="tilt-footer"><div className="tilt-footer-actions"><button className="tilt-pause" onClick={() => setPaused((value) => !value)} disabled={finished}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? "Tiếp tục" : "Tạm dừng"}</button><button onClick={restart}><RotateCcw size={15} /> Chơi lại</button><button onClick={onExit}><Home size={15} /> Trò khác</button></div><span className="tilt-footer-hint">{right} câu đúng · ← → hoặc chạm để chọn</span>{!finished && <button className="tilt-next" onClick={next} disabled={!picked}>{index === rounds.length - 1 ? "Kết quả" : "Câu tiếp theo"}<ArrowRight size={16} /></button>}</footer>
      <div className="tilt-awards">{children}</div>
    </div>
  );
}
