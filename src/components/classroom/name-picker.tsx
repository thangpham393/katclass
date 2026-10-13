"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CircleDot, Dices, Play, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RandomStage } from "./stages";
import type { ClassroomStudent } from "@/lib/db-classroom";
import { eligibleStudents, pickStudent } from "@/lib/classroom-picker";
import { FLIGHT_PALETTES, flightPattern, flightPoint, portraitFlightPoint, type Flight, type FlightPattern } from "@/lib/classroom-flight";
import "./name-picker.css";

type Mode = "wheel" | "photo" | "marble";
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
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(.45);
  const [musicError, setMusicError] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [winner, setWinner] = useState<ClassroomStudent | null>(null);
  const [wheelRunning, setWheelRunning] = useState(false);
  const [settings, setSettings] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const music = useRef<HTMLAudioElement>(null);
  const musicWanted = useRef(false);
  function stopMusic() { musicWanted.current = false; if (music.current) { music.current.pause(); music.current.currentTime = 0; } }
  function playMusic(restart = true, enabled = sound) {
    const el = music.current;
    if (!el || !enabled || !active) return;
    if (restart) el.currentTime = 0;
    el.volume = volume; musicWanted.current = true; setMusicError(false);
    el.play().then(() => { if (!musicWanted.current) el.pause(); }).catch(() => { if (musicWanted.current) setMusicError(true); });
  }
  const key = `classroom:called:${sessionId}`;
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); setCalled(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []); } catch { setCalled([]); }
    setLoaded(true);
  }, [key]);
  useEffect(() => { if (loaded) { try { localStorage.setItem(key, JSON.stringify(called)); } catch { /* private mode */ } } }, [called, key, loaded]);
  useEffect(() => { if (!active) { setRound(null); setWheelRunning(false); stopMusic(); audio.current?.close().catch(() => {}); audio.current = null; } }, [active]);
  useEffect(() => { const el = music.current; return () => { musicWanted.current = false; el?.pause(); audio.current?.close().catch(() => {}); }; }, []);
  useEffect(() => { if (music.current) music.current.volume = volume; }, [volume]);

  const currentCalled = called.filter(id => students.some(s => s.id === id));
  const pool = useMemo(() => eligibleStudents(students, called, fair), [students, called, fair]);
  const running = !!round || wheelRunning;
  function toggleMusic() {
    const next = !sound; setSound(next);
    if (!next) stopMusic(); else if (running) playMusic(false, true);
  }

  function finish(s: ClassroomStudent) {
    stopMusic();
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
    playMusic();
    if (sound) { try { audio.current ??= new AudioContext(); audio.current.resume().catch(() => {}); } catch { /* optional sound */ } }
    setWinner(null);
    if (mode === "wheel") return;
    setRound({ students: [...pool], winner: picked, duration: seconds * 1000, mode, flight, seeds: pool.map(() => Math.random()) });
  }
  function wheelState(running: boolean) {
    setWheelRunning(running);
    if (running) playMusic();
    if (running && sound) { try { audio.current ??= new AudioContext(); audio.current.resume().catch(() => {}); } catch { /* optional sound */ } }
  }

  return <div className={`name-picker${round?.mode === "photo" ? " name-picker-photo-running" : ""}`}>
    <audio ref={music} src="/audio/classroom-random.mp3" preload="metadata" loop data-testid="picker-music" />
    <div className="name-picker-modes" role="group" aria-label="Phương thức gọi tên">
      {MODES.map(m => <button key={m.key} disabled={running} aria-pressed={mode === m.key} data-tone={m.tone} className={`name-picker-mode ${mode === m.key ? "selected" : ""}`} onClick={() => { setMode(m.key); setWinner(null); }}><m.icon size={23} /><span><strong>{m.title}</strong><small>{m.text}</small></span></button>)}
    </div>
    <div className="name-picker-toolbar">
      <label><input type="checkbox" checked={fair} disabled={running} onChange={e => setFair(e.target.checked)} /> Không gọi trùng trong vòng</label>
      <span>{fair && currentCalled.length === students.length && students.length > 0 ? "Đã gọi đủ lớp · Vòng mới sẵn sàng" : `${currentCalled.length}/${students.length} đã được gọi`}</span>
      <button title="Bắt đầu vòng gọi mới" aria-label="Làm mới lượt gọi" disabled={running || !called.length} onClick={() => { setCalled([]); setWinner(null); }}><RotateCcw size={16} /></button>
      <button title={sound ? "Tắt nhạc nền" : "Bật nhạc nền"} aria-label={sound ? "Tắt nhạc nền" : "Bật nhạc nền"} aria-pressed={sound} onClick={toggleMusic}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
      <button disabled={running} aria-label="Cài đặt gọi tên" aria-expanded={settings} onClick={() => setSettings(v => !v)}><Settings2 size={17} /></button>
    </div>
    {settings && <div className="name-picker-settings">
      {mode !== "wheel" && <label>Thời gian <input aria-label="Thời gian gọi tên" type="range" min={5} max={30} step={1} value={seconds} disabled={running} onChange={e => setSeconds(Number(e.target.value))} /><b>{seconds} giây</b></label>}
      {mode === "photo" && <label>Kiểu bay <select aria-label="Kiểu bay của ảnh" value={flight} disabled={running} onChange={e => setFlight(e.target.value as Flight)}><option value="mix">Kết hợp</option><option value="bounce">Hỗn loạn</option><option value="spiral">Tròn ốc</option><option value="fire">Đốt lửa</option><option value="wave">Sóng</option><option value="orbit">Hành tinh</option><option value="eight">Số 8</option><option value="pendulum">Con lắc</option></select></label>}
      <label><Volume2 size={15} /> Nhạc nền · random.mp3 <input aria-label="Âm lượng nhạc nền" type="range" min={0} max={1} step={.05} value={volume} onChange={e => setVolume(Number(e.target.value))} /><b>{Math.round(volume * 100)}%</b></label>
    </div>}
    {musicError && <div className="name-picker-note name-picker-music-error" role="alert">Chưa phát được nhạc nền. <button className="underline" onClick={() => playMusic(false)}>Phát lại nhạc</button></div>}
    {mode === "photo" && students.some(s => !s.avatar) && <div className="name-picker-note">{students.filter(s => !s.avatar).length} học viên chưa có ảnh, sẽ dùng chữ cái tên.{photosHref && <Link href={photosHref} target="_blank"> Thêm ảnh trong lớp học ↗</Link>}</div>}
    {photoError && <div className="name-picker-note" role="alert">Không tải được ảnh lớp: {photoError} <button onClick={onReloadPhotos} className="underline">Thử lại</button></div>}
    {!students.length ? <div className="name-picker-no-students"><Camera size={36} /><h3>Chưa có học viên để gọi tên</h3><p>Điểm danh học viên có mặt trước khi bắt đầu.</p></div> : mode === "wheel" ? <div className="name-picker-wheel">{active && <RandomStage managed students={pool} onPicked={finish} onRunningChange={wheelState} />}</div> : <>
      <div className={`name-picker-arena ${mode}`} data-flight={mode === "photo" ? flight : undefined} style={mode === "photo" ? { background: `linear-gradient(110deg, ${FLIGHT_PALETTES[flight].join(", ")})` } : undefined}>
        {mode === "photo" && !round && <FlightBackdrop flight={flight} />}
        {round ? <AnimatedRound round={round} onFinish={finish} /> : winner ? <div className="name-picker-winner" role="status"><div className="name-picker-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 47) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${i * .04}s`, transform: `rotate(${i * 31}deg)` }} />)}</div><span className="name-picker-eyebrow">{mode === "marble" ? "VỀ ĐÍCH ĐẦU TIÊN" : "NGƯỜI ĐƯỢC GỌI LÀ…"}</span><div className="name-picker-winner-face"><Avatar name={winner.name} src={winner.avatar ?? undefined} size={160} /></div><h2>{winner.name}</h2><p>Mời em phát biểu 🎤</p></div> : <div className="name-picker-preview">
          {mode === "marble" ? <><div className="name-picker-preview-marbles">{COLORS.slice(0, 5).map((c, i) => <i key={c} style={{ background: `radial-gradient(circle at 30% 25%, #fff, ${c} 45%, #18264e)`, animationDelay: `${i * .15}s` }} />)}</div><span className="name-picker-eyebrow">SẴN SÀNG VÀO ĐƯỜNG ĐUA</span><h2>Mỗi học viên, một viên bi</h2><p>Những cú ngoặt bất ngờ. Một người về đích.</p></> : <><div className="name-picker-preview-faces">{pool.slice(0, 7).map((s, i) => <div key={s.id} style={{ transform: `translateY(${i % 2 ? 14 : -6}px)` }}><Avatar name={s.name} src={s.avatar ?? undefined} size={i === Math.floor(Math.min(pool.length, 7) / 2) ? 84 : 58} /></div>)}</div><span className="name-picker-eyebrow">NHỮNG GƯƠNG MẶT THÂN QUEN</span><h2>Hôm nay sẽ gọi ai?</h2><p>Cùng chờ gương mặt được chọn xuất hiện.</p></>}
        </div>}
        {round && <div className="name-picker-running-label"><span className="name-picker-live-dot" />{mode === "marble" ? "Đường đua đang nóng lên…" : "Đang tìm gương mặt may mắn…"}</div>}
        {round?.mode === "photo" && <button className="name-picker-stage-mute" aria-label={sound ? "Tắt nhạc nền" : "Bật nhạc nền"} aria-pressed={sound} onClick={toggleMusic}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>}
      </div>
      <div className="name-picker-bottom"><span>{running ? "Cùng chờ kết quả…" : `${pool.length} học viên sẵn sàng${fair ? " trong vòng này" : ""}`}</span><Button size="lg" onClick={start} disabled={running || !loaded}><Play size={18} /> {running ? "Đang diễn ra…" : winner ? "Gọi bạn tiếp theo" : mode === "marble" ? "Bắt đầu đua bi" : "Bắt đầu gọi tên"}</Button></div>
    </>}
  </div>;
}

const COLORS = ["#818cf8", "#38bdf8", "#fb7185", "#fbbf24", "#34d399", "#c084fc", "#fb923c"];
const TAU = Math.PI * 2;
function initials(name: string) { return name.trim().split(/\s+/).slice(-2).map(s => s[0]).join("").toUpperCase(); }

function FlightBackdrop({ flight }: { flight: Flight }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext("2d")!;
    const observer = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintFlightBackground(ctx, w, h, flightPattern(flight, 0), 0, Math.min(55, w * .08));
    }); observer.observe(canvas);
    return () => observer.disconnect();
  }, [flight]);
  return <canvas ref={ref} className="name-picker-flight-backdrop" aria-hidden="true" />;
}

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
      if (w < 1 || h < 1) { raf = requestAnimationFrame(frame); return; }
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
  return <><canvas ref={canvas} className="name-picker-canvas" data-flight={round.mode === "photo" ? round.flight : undefined} aria-label={round.mode === "marble" ? "Các viên bi học viên đang đua đến đích" : "Ảnh học viên đang bay trên màn hình"} /><div className="name-picker-progress"><div ref={progress} /></div></>;
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
  const n = round.students.length, r = Math.max(16, Math.min(55, Math.sqrt(w * h / (n * 22))));
  const settle = Math.max(0, (t - .78) / .22), ease = 1 - Math.pow(1 - settle, 3);
  const k = reduce ? 0 : sec;
  const pattern = flightPattern(round.flight, k);
  const previous = flightPattern(round.flight, Math.max(0, k - 3.5));
  const blend = round.flight === "mix" && k >= 3.5 ? Math.min(1, (k % 3.5) / .65) : 1;
  const smoothBlend = blend * blend * (3 - 2 * blend);
  if (blend < 1) paintFlightBackground(ctx, w, h, previous, k, r);
  ctx.save(); ctx.globalAlpha = smoothBlend;
  paintFlightBackground(ctx, w, h, pattern, k, r);
  ctx.restore();
  round.students.forEach((s, i) => {
    const next = portraitFlightPoint(pattern, k, round.seeds[i], i);
    const prev = blend < 1 ? portraitFlightPoint(previous, k, round.seeds[i], i) : next;
    const nx = prev.x + (next.x - prev.x) * smoothBlend, ny = prev.y + (next.y - prev.y) * smoothBlend;
    let x = r + nx * (w - r * 2), y = r + ny * (h - r * 2 - 28), radius = r;
    const win = s.id === round.winner.id;
    ctx.save();
    if (win) { x += (w / 2 - x) * ease; y += (h / 2 - y) * ease; radius += (Math.min(w, h) * .23 - r) * ease; }
    else ctx.globalAlpha = 1 - ease * .93;
    if (pattern === "pendulum") { ctx.beginPath(); ctx.moveTo(w / 2, r + .08 * (h - r * 2 - 28)); ctx.lineTo(x, y); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 1.5; ctx.stroke(); }
    face(ctx, s, imgs[i], x, y, radius, COLORS[i % COLORS.length], t < .8); ctx.restore();
  });
}

function paintFlightBackground(ctx: CanvasRenderingContext2D, w: number, h: number, pattern: FlightPattern, sec: number, inset: number) {
  ctx.save();
  const palette = FLIGHT_PALETTES[pattern];
  const gradient = ctx.createLinearGradient(0, 0, w, h * .35);
  palette.forEach((color, i) => gradient.addColorStop(i / 2, color));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  const px = (x: number) => inset + x * (w - inset * 2), py = (y: number) => inset + y * (h - inset * 2 - 28);
  ctx.strokeStyle = "#ffffff1f"; ctx.lineWidth = 1;
  if (pattern === "wave" || pattern === "bounce") {
    for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  const lanes = pattern === "wave" || pattern === "orbit" || pattern === "pendulum" || pattern === "fire" ? 3 : 1;
  for (let lane = 0; lane < lanes; lane++) {
    if (pattern === "bounce") break;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const p = flightPoint(pattern, i / 240, lane);
      if (!i) ctx.moveTo(px(p.x), py(p.y)); else ctx.lineTo(px(p.x), py(p.y));
    }
    ctx.strokeStyle = pattern === "fire" ? "#fff7ed24" : "#ffffff4d"; ctx.lineWidth = pattern === "spiral" ? 4 : 2; ctx.stroke();
    if (pattern === "wave") { ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.moveTo(0, py(.2 + lane * .3)); ctx.lineTo(w, py(.2 + lane * .3)); ctx.strokeStyle = "#ffffff33"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
  }
  if (pattern === "orbit") {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * .35); glow.addColorStop(0, "#fde68a66"); glow.addColorStop(1, "#fde68a00"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  if (pattern === "pendulum") { ctx.fillStyle = "#ffffffaa"; ctx.beginPath(); ctx.arc(px(.5), py(.08), 5, 0, TAU); ctx.fill(); }
  if (pattern === "bounce") { ctx.strokeStyle = "#ffffff40"; ctx.lineWidth = 2; for (const y of [.2, .5, .8]) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(w, py(y)); ctx.stroke(); } }
  for (let i = 0; i < 28; i++) {
    const x = ((i * .618 + .07) % 1) * w, y = (1 - ((i * .381 + sec * (pattern === "fire" ? .11 : .015)) % 1)) * h;
    ctx.fillStyle = pattern === "fire" ? "#fff5cbbb" : "#ffffff55"; ctx.beginPath(); ctx.arc(x, y, pattern === "fire" ? 1.5 + i % 3 : 1.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
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
