"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CircleDot, Dices, Play, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RandomStage } from "./stages";
import type { ClassroomStudent } from "@/lib/db-classroom";
import { eligibleStudents, pickStudent } from "@/lib/classroom-picker";
import "./name-picker.css";

type Mode = "wheel" | "photo" | "marble";
type Flight = "mix" | "wave" | "orbit" | "spiral" | "bounce" | "fire" | "eight" | "pendulum";
interface Round { students: ClassroomStudent[]; winner: ClassroomStudent; duration: number; mode: Exclude<Mode, "wheel">; flight: Flight; seeds: number[] }
const MODES = [
  { key: "wheel" as const, icon: Dices, title: "Vòng quay", text: "Một lượt quay, một gương mặt bất ngờ.", tone: "amber" },
  { key: "photo" as const, icon: Camera, title: "Gọi tên bằng ảnh", text: "Gương mặt bay khắp màn hình, rồi dừng ở em được gọi.", tone: "violet" },
  { key: "marble" as const, icon: CircleDot, title: "Đua bi", text: "Cùng lăn qua đường đua. Ai về đích đầu tiên?", tone: "sky" },
];

export function NamePicker({ students, onPicked, active, sessionId, photosHref, photoError, onReloadPhotos }: { students: ClassroomStudent[]; onPicked: (s: ClassroomStudent) => void; active: boolean; sessionId: string; photosHref?: string; photoError?: string | null; onReloadPhotos?: () => void }) {
  const [mode, setMode] = useState<Mode>("wheel");
  const [fair, setFair] = useState(true);
  const [called, setCalled] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [flight, setFlight] = useState<Flight>("mix");
  const [sound, setSound] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [winner, setWinner] = useState<ClassroomStudent | null>(null);
  const [wheelRunning, setWheelRunning] = useState(false);
  const [settings, setSettings] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const key = `classroom:called:${sessionId}`;
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); setCalled(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []); } catch { setCalled([]); }
    setLoaded(true);
  }, [key]);
  useEffect(() => { if (loaded) { try { localStorage.setItem(key, JSON.stringify(called)); } catch { /* private mode */ } } }, [called, key, loaded]);
  useEffect(() => { if (!active) { setRound(null); setWheelRunning(false); audio.current?.close().catch(() => {}); audio.current = null; } }, [active]);
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);

  const currentCalled = called.filter(id => students.some(s => s.id === id));
  const pool = useMemo(() => eligibleStudents(students, called, fair), [students, called, fair]);
  const running = !!round || wheelRunning;

  function finish(s: ClassroomStudent) {
    setRound(null); setWheelRunning(false); setWinner(s);
    setCalled(prev => {
      const exhausted = students.every(student => prev.includes(student.id));
      const ids = fair && exhausted ? [] : prev;
      return ids.includes(s.id) ? ids : [...ids, s.id];
    });
    if (sound && audio.current) {
      const ctx = audio.current;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        const t = ctx.currentTime + i * .09;
        osc.frequency.value = freq; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.1, t + .02); gain.gain.exponentialRampToValueAtTime(.001, t + .35);
        osc.connect(gain).connect(ctx.destination); osc.start(t); osc.stop(t + .4);
      });
    }
    onPicked(s);
  }

  function start() {
    const picked = pickStudent(pool);
    if (!picked || running) return;
    if (sound) { try { audio.current ??= new AudioContext(); audio.current.resume().catch(() => {}); } catch { /* optional sound */ } }
    setWinner(null);
    if (mode === "wheel") return;
    setRound({ students: [...pool], winner: picked, duration: seconds * 1000, mode, flight, seeds: pool.map(() => Math.random()) });
  }
  function wheelState(running: boolean) {
    setWheelRunning(running);
    if (running && sound) { try { audio.current ??= new AudioContext(); audio.current.resume().catch(() => {}); } catch { /* optional sound */ } }
  }

  return <div className="name-picker">
    <div className="name-picker-modes" role="group" aria-label="Phương thức gọi tên">
      {MODES.map(m => <button key={m.key} disabled={running} aria-pressed={mode === m.key} data-tone={m.tone} className={`name-picker-mode ${mode === m.key ? "selected" : ""}`} onClick={() => { setMode(m.key); setWinner(null); }}><m.icon size={23} /><span><strong>{m.title}</strong><small>{m.text}</small></span></button>)}
    </div>
    <div className="name-picker-toolbar">
      <label><input type="checkbox" checked={fair} disabled={running} onChange={e => setFair(e.target.checked)} /> Không gọi trùng trong vòng</label>
      <span>{fair && currentCalled.length === students.length && students.length > 0 ? "Đã gọi đủ lớp · Vòng mới sẵn sàng" : `${currentCalled.length}/${students.length} đã được gọi`}</span>
      <button title="Bắt đầu vòng gọi mới" aria-label="Làm mới lượt gọi" disabled={running || !called.length} onClick={() => { setCalled([]); setWinner(null); }}><RotateCcw size={16} /></button>
      <button aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"} aria-pressed={sound} onClick={() => setSound(v => !v)}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
      {mode !== "wheel" && <button disabled={running} aria-label="Cài đặt gọi tên" aria-expanded={settings} onClick={() => setSettings(v => !v)}><Settings2 size={17} /></button>}
    </div>
    {settings && mode !== "wheel" && <div className="name-picker-settings">
      <label>Thời gian <input aria-label="Thời gian gọi tên" type="range" min={5} max={30} step={1} value={seconds} disabled={running} onChange={e => setSeconds(Number(e.target.value))} /><b>{seconds} giây</b></label>
      {mode === "photo" && <label>Kiểu bay <select aria-label="Kiểu bay của ảnh" value={flight} disabled={running} onChange={e => setFlight(e.target.value as Flight)}><option value="mix">Kết hợp</option><option value="bounce">Hỗn loạn</option><option value="spiral">Tròn ốc</option><option value="fire">Đốt lửa</option><option value="wave">Sóng</option><option value="orbit">Hành tinh</option><option value="eight">Số 8</option><option value="pendulum">Con lắc</option></select></label>}
    </div>}
    {mode === "photo" && students.some(s => !s.avatar) && <div className="name-picker-note">{students.filter(s => !s.avatar).length} học viên chưa có ảnh, sẽ dùng chữ cái tên.{photosHref && <Link href={photosHref} target="_blank"> Thêm ảnh trong lớp học ↗</Link>}</div>}
    {photoError && <div className="name-picker-note" role="alert">Không tải được ảnh lớp: {photoError} <button onClick={onReloadPhotos} className="underline">Thử lại</button></div>}
    {!students.length ? <div className="name-picker-no-students"><Camera size={36} /><h3>Chưa có học viên để gọi tên</h3><p>Điểm danh học viên có mặt trước khi bắt đầu.</p></div> : mode === "wheel" ? <div className="name-picker-wheel">{active && <RandomStage managed students={pool} onPicked={finish} onRunningChange={wheelState} />}</div> : <>
      <div className={`name-picker-arena ${mode}`}>
        {round ? <AnimatedRound round={round} onFinish={finish} /> : winner ? <div className="name-picker-winner" role="status"><div className="name-picker-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 47) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${i * .04}s`, transform: `rotate(${i * 31}deg)` }} />)}</div><span className="name-picker-eyebrow">{mode === "marble" ? "VỀ ĐÍCH ĐẦU TIÊN" : "NGƯỜI ĐƯỢC GỌI LÀ…"}</span><div className="name-picker-winner-face"><Avatar name={winner.name} src={winner.avatar ?? undefined} size={160} /></div><h2>{winner.name}</h2><p>Mời em phát biểu 🎤</p></div> : <div className="name-picker-preview">
          {mode === "marble" ? <><div className="name-picker-preview-marbles">{COLORS.slice(0, 5).map((c, i) => <i key={c} style={{ background: `radial-gradient(circle at 30% 25%, #fff, ${c} 45%, #18264e)`, animationDelay: `${i * .15}s` }} />)}</div><span className="name-picker-eyebrow">SẴN SÀNG VÀO ĐƯỜNG ĐUA</span><h2>Mỗi học viên, một viên bi</h2><p>Những cú ngoặt bất ngờ. Một người về đích.</p></> : <><div className="name-picker-preview-faces">{pool.slice(0, 7).map((s, i) => <div key={s.id} style={{ transform: `translateY(${i % 2 ? 14 : -6}px)` }}><Avatar name={s.name} src={s.avatar ?? undefined} size={i === Math.floor(Math.min(pool.length, 7) / 2) ? 84 : 58} /></div>)}</div><span className="name-picker-eyebrow">NHỮNG GƯƠNG MẶT THÂN QUEN</span><h2>Hôm nay sẽ gọi ai?</h2><p>Cùng chờ gương mặt được chọn xuất hiện.</p></>}
        </div>}
        {round && <div className="name-picker-running-label"><span className="name-picker-live-dot" />{mode === "marble" ? "Đường đua đang nóng lên…" : "Đang tìm gương mặt may mắn…"}</div>}
      </div>
      <div className="name-picker-bottom"><span>{running ? "Cùng chờ kết quả…" : `${pool.length} học viên sẵn sàng${fair ? " trong vòng này" : ""}`}</span><Button size="lg" onClick={start} disabled={running || !loaded}><Play size={18} /> {running ? "Đang diễn ra…" : winner ? "Gọi bạn tiếp theo" : mode === "marble" ? "Bắt đầu đua bi" : "Bắt đầu gọi tên"}</Button></div>
    </>}
  </div>;
}

const COLORS = ["#818cf8", "#38bdf8", "#fb7185", "#fbbf24", "#34d399", "#c084fc", "#fb923c"];
const TAU = Math.PI * 2;
function initials(name: string) { return name.trim().split(/\s+/).slice(-2).map(s => s[0]).join("").toUpperCase(); }

/** Canvas keeps every frame off React's render path, including large class rosters. */
function AnimatedRound({ round, onFinish }: { round: Round; onFinish: (s: ClassroomStudent) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish); finish.current = onFinish;
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext("2d")!;
    let w = 800, h = 450, raf = 0, ended = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const imgs = round.students.map(s => { if (!s.avatar) return null; const img = new Image(); img.src = s.avatar; return img; });
    const observer = new ResizeObserver(entries => {
      w = entries[0].contentRect.width; h = entries[0].contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2); el.width = w * dpr; el.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }); observer.observe(el);
    const start = performance.now();
    const duration = reduce ? Math.min(1500, round.duration) : round.duration;
    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration), seconds = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (round.mode === "photo") paintPhotos(ctx, w, h, t, seconds, round, imgs, reduce);
      else paintRace(ctx, w, h, t, seconds, round, imgs, reduce);
      if (progress.current) progress.current.style.transform = `scaleX(${t})`;
      if (t >= 1 && !ended) { ended = true; finish.current(round.winner); } else if (!ended) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { ended = true; cancelAnimationFrame(raf); observer.disconnect(); imgs.forEach(img => { if (img) img.src = ""; }); };
  }, [round]);
  return <><canvas ref={canvas} className="name-picker-canvas" aria-label={round.mode === "marble" ? "Các viên bi học viên đang đua đến đích" : "Ảnh học viên đang bay trên màn hình"} /><div className="name-picker-progress"><div ref={progress} /></div></>;
}

function face(ctx: CanvasRenderingContext2D, s: ClassroomStudent, img: HTMLImageElement | null, x: number, y: number, radius: number, color: string, label: boolean) {
  ctx.save(); ctx.shadowColor = "#0005"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, TAU); ctx.fillStyle = color; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.clip();
  if (img?.complete && img.naturalWidth) {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const gradient = ctx.createRadialGradient(x - radius * .3, y - radius * .4, 0, x, y, radius * 1.5); gradient.addColorStop(0, "#fff"); gradient.addColorStop(.3, color); gradient.addColorStop(1, "#312e81"); ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.max(10, radius * .7)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(initials(s.name), x, y);
  }
  ctx.restore();
  if (label) { ctx.save(); ctx.font = "700 12px system-ui"; ctx.textAlign = "center"; const name = s.name.length > 22 ? s.name.slice(0, 20) + "…" : s.name; const width = ctx.measureText(name).width + 18; ctx.fillStyle = "#0f172acc"; ctx.beginPath(); ctx.roundRect(x - width / 2, y + radius + 8, width, 23, 11); ctx.fill(); ctx.fillStyle = "white"; ctx.fillText(name, x, y + radius + 24); ctx.restore(); }
}

function paintPhotos(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, sec: number, round: Round, imgs: (HTMLImageElement | null)[], reduce: boolean) {
  ctx.save(); ctx.strokeStyle = "#ffffff12"; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();
  const n = round.students.length, r = Math.max(16, Math.min(55, Math.sqrt(w * h / (n * 22))));
  const settle = Math.max(0, (t - .78) / .22), ease = 1 - Math.pow(1 - settle, 3);
  round.students.forEach((s, i) => {
    const seed = round.seeds[i], phase = seed * TAU;
    const k = reduce ? 0 : sec * (1 - ease * .6);
    const pattern = round.flight === "mix" ? ["wave", "orbit", "spiral", "bounce", "fire", "eight", "pendulum"][i % 7] : round.flight;
    let nx = .5, ny = .5;
    if (pattern === "wave") { nx = ((seed + k * .13) % 1); ny = .5 + .34 * Math.sin(k * 1.6 + phase); }
    else if (pattern === "orbit") { nx = .5 + .4 * Math.cos(k * .9 + phase); ny = .5 + .37 * Math.sin(k * .9 + phase); }
    else if (pattern === "spiral") { const radius = .18 + .23 * Math.sin(k * .5 + phase) ** 2; nx = .5 + radius * Math.cos(k * 1.3 + phase); ny = .5 + radius * Math.sin(k * 1.3 + phase); }
    else if (pattern === "fire") { nx = .5 + .38 * Math.sin(k + phase); ny = .9 - .8 * ((seed + k * .14) % 1); }
    else if (pattern === "eight") { nx = .5 + .42 * Math.sin(k + phase); ny = .5 + .32 * Math.sin(2 * k + phase * 2); }
    else if (pattern === "pendulum") { nx = .5 + .42 * Math.sin(k + phase); ny = .22 + .56 * Math.abs(Math.cos(k + phase)); }
    else { nx = .5 + .46 * Math.sin(k * (1 + seed) + phase); ny = .5 + .4 * Math.sin(k * (1.4 + seed) + phase * 2); }
    let x = r + nx * (w - r * 2), y = r + ny * (h - r * 2 - 28), radius = r;
    const win = s.id === round.winner.id;
    ctx.save();
    if (win) { x += (w / 2 - x) * ease; y += (h / 2 - y) * ease; radius += (Math.min(w, h) * .23 - r) * ease; }
    else ctx.globalAlpha = 1 - ease * .93;
    face(ctx, s, imgs[i], x, y, radius, COLORS[i % COLORS.length], t < .8); ctx.restore();
  });
}

function track(w: number, h: number, p: number) { return { x: w * (.5 + .34 * Math.sin(p * Math.PI * 5)), y: h * (.11 + .77 * p) }; }
function paintRace(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, sec: number, round: Round, imgs: (HTMLImageElement | null)[], reduce: boolean) {
  const lane = Math.max(36, Math.min(68, w * .14));
  // A continuous winding course with bumpers, rotating gates and a checkerboard finish.
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath(); for (let i = 0; i <= 220; i++) { const p = track(w, h, i / 220); if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.strokeStyle = "#60a5fa55"; ctx.lineWidth = lane + 12; ctx.stroke(); ctx.strokeStyle = "#182d50"; ctx.lineWidth = lane; ctx.stroke(); ctx.strokeStyle = "#dbeafe55"; ctx.lineWidth = 2; ctx.setLineDash([5, 10]); ctx.stroke(); ctx.setLineDash([]);
  for (const p of [.14, .34, .55, .75]) {
    const pos = track(w, h, p); ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(reduce ? 0 : sec * (p > .4 ? -1.8 : 1.8));
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-lane * .4, 0); ctx.lineTo(lane * .4, 0); ctx.moveTo(0, -lane * .4); ctx.lineTo(0, lane * .4); ctx.stroke(); ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const p of [.23, .44, .65]) { const pos = track(w, h, p); for (let j = -1; j <= 1; j += 2) { ctx.fillStyle = "#fbbf24"; ctx.shadowColor = "#fbbf2488"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(pos.x + j * lane * .35, pos.y, 7, 0, TAU); ctx.fill(); } } ctx.shadowBlur = 0;
  const end = track(w, h, 1); for (let row = 0; row < 2; row++) for (let col = 0; col < 8; col++) { ctx.fillStyle = (row + col) % 2 ? "#0f172a" : "#fff"; ctx.fillRect(end.x - lane / 2 + col * lane / 8, end.y + row * 7, lane / 8, 7); }
  ctx.fillStyle = "#bfdbfe"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("XUẤT PHÁT", w / 2, h * .055); ctx.fillText("VỀ ĐÍCH", end.x, Math.min(h - 8, end.y + 34));
  ctx.restore();
  const n = round.students.length, radius = Math.max(7, Math.min(17, 23 - n * .12));
  round.students.forEach((s, i) => {
    const seed = round.seeds[i], win = s.id === round.winner.id;
    // Each racer gets different accelerations and overtakes; no frame-time bias in the selected winner.
    const p = reduce ? t * (win ? 1 : .86) : Math.max(0, Math.min(win ? 1 : .96, t * (win ? 1 : .73 + seed * .2) + Math.sin(t * TAU * 2 + seed * TAU) * .065 * Math.sin(t * Math.PI)));
    const pos = track(w, h, p); const jitter = Math.sin(p * 30 + seed * TAU) * lane * .25;
    const x = pos.x + jitter, y = pos.y + Math.sin(seed * TAU) * 8 * (1 - t);
    if (t > .1) { ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = COLORS[i % COLORS.length]; ctx.beginPath(); ctx.ellipse(x, y - radius, radius * .7, radius * 2.3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    face(ctx, s, imgs[i], x, y, radius, COLORS[i % COLORS.length], n <= 14 || win && t > .8);
  });
}
