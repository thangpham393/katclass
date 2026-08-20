"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eraser, Grid3x3, Pen, Trash2, Type, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Background = "plain" | "tianzi" | "lines";

interface Stroke {
  kind: "stroke";
  points: { x: number; y: number }[];
  color: string;
  width: number;
  erase: boolean;
}

/** Chữ gõ bằng bàn phím, đặt tại vị trí bấm chuột trên bảng. */
interface TextItem {
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

type Item = Stroke | TextItem;

const FONT_SIZES = [
  { label: "Vừa", value: 48 },
  { label: "To", value: 80 },
  { label: "Rất to", value: 120 },
];

const TEXT_FONT = '"Noto Serif SC", "Songti SC", "PingFang SC", "Microsoft YaHei", serif';

const COLORS = ["#111827", "#dc2626", "#2549ec", "#0a7d59", "#d97706", "#7c3aed"];
const WIDTHS = [3, 6, 12];

const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "tianzi", label: "Ô 田字格" },
  { value: "lines", label: "Dòng kẻ" },
  { value: "plain", label: "Trắng trơn" },
];

/**
 * Bảng viết cho lớp tiếng Trung: nền ô 田字格 để viết mẫu chữ Hán đúng tỷ lệ,
 * bút nhiều màu, tẩy, hoàn tác. Vẽ bằng pointer events nên dùng được cả chuột,
 * bút cảm ứng và màn hình chạm của tivi/máy chiếu tương tác.
 */
export function WhiteboardStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const items = useRef<Item[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const [bg, setBg] = useState<Background>("tianzi");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [mode, setMode] = useState<"pen" | "eraser" | "text">("pen");
  const [fontSize, setFontSize] = useState(FONT_SIZES[1].value);
  const [count, setCount] = useState(0);
  /** Ô nhập đang mở trên bảng (vị trí đặt chữ) — null là không gõ chữ. */
  const [editing, setEditing] = useState<{ x: number; y: number } | null>(null);
  /** Bản sao vị trí đang gõ để chốt chữ không phụ thuộc vòng đời state. */
  const editingRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    drawBackground(ctx, w, h, bg);

    for (const it of items.current) {
      if (it.kind === "text") {
        ctx.save();
        ctx.fillStyle = it.color;
        ctx.font = `${it.size}px ${TEXT_FONT}`;
        ctx.textBaseline = "top";
        ctx.fillText(it.text, it.x, it.y);
        ctx.restore();
        continue;
      }
      if (it.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = it.width;
      ctx.strokeStyle = it.color;
      if (it.erase) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = it.width * 4;
      }
      ctx.beginPath();
      ctx.moveTo(it.points[0].x, it.points[0].y);
      for (const p of it.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  }, [bg]);

  // Khớp kích thước canvas với khung (giữ nét sắc trên màn hình retina)
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = box.clientWidth * dpr;
      canvas.height = box.clientHeight * dpr;
      canvas.style.width = `${box.clientWidth}px`;
      canvas.style.height = `${box.clientHeight}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => paint(), [bg, paint]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === "text") {
      // Bấm chỗ nào mở ô gõ chữ ngay chỗ đó (gõ được cả bộ gõ tiếng Trung)
      commitText();
      const p = pos(e);
      editingRef.current = { x: p.x, y: p.y };
      setEditing({ x: p.x, y: p.y });
      setDraft("");
      window.setTimeout(() => draftRef.current?.focus(), 0);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { kind: "stroke", points: [pos(e)], color, width, erase: mode === "eraser" };
    items.current.push(drawing.current);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current.points.push(pos(e));
    paint();
  }

  /** Chốt chữ đang gõ thành nét mực trên bảng. */
  function commitText() {
    const cur = editingRef.current;
    const text = draftRef.current?.value.trim() ?? "";
    editingRef.current = null;
    if (cur && text) {
      items.current.push({ kind: "text", x: cur.x, y: cur.y, text, color, size: fontSize });
      setCount(items.current.length);
      paint();
    }
    setEditing(null);
    setDraft("");
  }

  function onUp() {
    if (drawing.current && drawing.current.points.length < 2) {
      // Chạm một điểm cũng để lại chấm mực
      drawing.current.points.push({
        x: drawing.current.points[0].x + 0.1,
        y: drawing.current.points[0].y + 0.1,
      });
    }
    drawing.current = null;
    setCount(items.current.length);
    paint();
  }

  function undo() {
    items.current.pop();
    setCount(items.current.length);
    paint();
  }

  function clear() {
    items.current = [];
    setCount(0);
    editingRef.current = null;
    setEditing(null);
    paint();
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `bang-viet-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`;
    a.click();
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
          {([
            { key: "pen", icon: Pen, title: "Bút viết tay" },
            { key: "text", icon: Type, title: "Gõ chữ bằng bàn phím — bấm lên bảng rồi gõ" },
            { key: "eraser", icon: Eraser, title: "Tẩy" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                commitText();
                setMode(t.key);
              }}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md",
                mode === t.key ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-ink-700",
              )}
              title={t.title}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                if (mode === "eraser") setMode("pen");
              }}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                color === c && mode !== "eraser" ? "scale-110 border-white" : "border-ink-700",
              )}
              style={{ background: c }}
              title="Màu bút"
            />
          ))}
        </div>

        <div className={cn("flex gap-1 rounded-lg bg-ink-800 p-1", mode !== "text" && "hidden")}>
          {FONT_SIZES.map((f) => (
            <button
              key={f.value}
              onClick={() => setFontSize(f.value)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-semibold",
                fontSize === f.value ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-ink-700",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={cn("flex gap-1 rounded-lg bg-ink-800 p-1", mode === "text" && "hidden")}>
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md",
                width === w ? "bg-brand-600" : "hover:bg-ink-700",
              )}
              title={`Nét ${w}px`}
            >
              <span className="rounded-full bg-white" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              onClick={() => setBg(b.value)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-semibold",
                bg === b.value ? "bg-brand-600 text-white" : "text-ink-200 hover:bg-ink-700",
              )}
            >
              {b.value === "tianzi" && <Grid3x3 className="mr-1 inline h-3 w-3" />}
              {b.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1">
          <button
            onClick={undo}
            disabled={count === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 text-xs font-semibold text-ink-100 hover:bg-ink-700 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> Hoàn tác
          </button>
          <button
            onClick={download}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 text-xs font-semibold text-ink-100 hover:bg-ink-700"
            title="Lưu ảnh bảng về máy để gửi lại cho lớp"
          >
            <Download className="h-3.5 w-3.5" /> Lưu ảnh
          </button>
          <button
            onClick={clear}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 text-xs font-semibold text-gold-300 hover:bg-ink-700"
          >
            <Trash2 className="h-3.5 w-3.5" /> Xóa hết
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink-700 bg-white"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className={cn("block touch-none", mode === "text" && "cursor-text")}
        />

        {editing && (
          <input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) commitText();
              if (e.key === "Escape") {
                editingRef.current = null;
                setEditing(null);
                setDraft("");
              }
            }}
            onBlur={commitText}
            placeholder="Gõ rồi Enter…"
            style={{
              left: editing.x,
              top: editing.y,
              color,
              fontSize: fontSize,
              fontFamily: TEXT_FONT,
              lineHeight: 1.1,
            }}
            className="absolute min-w-[8rem] max-w-[80%] border-b-2 border-dashed border-brand-500 bg-transparent p-0 outline-none placeholder:text-base placeholder:text-gray-400"
          />
        )}

        {mode === "text" && !editing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-gray-400">
            Bấm vào chỗ muốn đặt chữ rồi gõ (dùng được bộ gõ tiếng Trung) · Enter để chốt
          </div>
        )}
      </div>
    </div>
  );
}

/** Nền bảng: ô 田字格 (kẻ chữ thập nét đứt) hoặc dòng kẻ ngang. */
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = w / dpr;
  const height = h / dpr;
  if (bg === "plain") return;

  ctx.save();
  if (bg === "lines") {
    ctx.strokeStyle = "#dbe6fe";
    ctx.lineWidth = 1;
    for (let y = 60; y < height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // 田字格: ô vuông viền đỏ nhạt + chữ thập nét đứt ở giữa
  const size = 140;
  const cols = Math.floor(width / size);
  const rows = Math.floor(height / size);
  const offsetX = (width - cols * size) / 2;
  const offsetY = (height - rows * size) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * size;
      const y = offsetY + r * size;
      ctx.setLineDash([]);
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, size, size);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "#fecaca";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y);
      ctx.lineTo(x + size / 2, y + size);
      ctx.moveTo(x, y + size / 2);
      ctx.lineTo(x + size, y + size / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
