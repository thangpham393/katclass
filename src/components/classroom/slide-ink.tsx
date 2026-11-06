"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Trash2, Type, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type InkTool = "pen" | "text" | "eraser";

/**
 * Toạ độ lưu theo tỉ lệ 0–1 của khung, cỡ nét theo phần nghìn chiều ngang —
 * đổi cỡ màn hình nét vẫn đúng chỗ. Chữ (công cụ T) lưu điểm góc trên-trái.
 */
export type InkStroke =
  | { kind?: "line"; color: string; size: number; pts: number[] }
  | { kind: "text"; color: string; size: number; x: number; y: number; text: string };

export const INK_COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#111827", "#ffffff"];
export const INK_SIZES = [2, 4, 8];

/** Bán kính cục gôm (px màn hình). */
const ERASER_RADIUS = 14;

/** Cỡ chữ (px) theo cỡ nét đang chọn và chiều ngang khung. */
function fontPx(size: number, w: number) {
  return ((size * 4.5 + 10) * w) / 1000;
}

function textFont(px: number) {
  return `600 ${px}px system-ui, "PingFang SC", "Noto Sans SC", sans-serif`;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: InkStroke, w: number, h: number) {
  if (s.kind === "text") {
    ctx.fillStyle = s.color;
    ctx.font = textFont(fontPx(s.size, w));
    ctx.textBaseline = "top";
    ctx.fillText(s.text, s.x * w, s.y * h);
    return;
  }
  const p = s.pts;
  if (p.length < 2) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = (s.size * w) / 1000;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0] * w, p[1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Nối qua trung điểm cho nét mượt
  ctx.beginPath();
  ctx.moveTo(p[0] * w, p[1] * h);
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * w;
    const my = ((p[i + 1] + p[i + 3]) / 2) * h;
    ctx.quadraticCurveTo(p[i] * w, p[i + 1] * h, mx, my);
  }
  ctx.lineTo(p[p.length - 2] * w, p[p.length - 1] * h);
  ctx.stroke();
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Lớp vẽ đè lên slide. Chỉ nhận chuột/bút khi đang cầm bút hoặc gôm, còn lại
 * trong suốt với thao tác (bấm vẫn xuyên xuống slide) nhưng nét vẫn hiện.
 */
export function SlideInk({
  tool,
  color,
  size,
  strokes,
  onChange,
  onRelease,
}: {
  tool: InkTool | null;
  color: string;
  size: number;
  /** Nét của trang slide đang hiện. */
  strokes: InkStroke[];
  onChange: (next: InkStroke[]) => void;
  /** Chuột phải: cất bút, về lại con trỏ bình thường. */
  onRelease: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Ô đang gõ chữ (công cụ T); id để blur của ô cũ không ghi đè ô mới. */
  const [typing, setTyping] = useState<{ id: number; x: number; y: number; value: string } | null>(null);
  const typingRef = useRef(typing);
  typingRef.current = typing;
  const [boxW, setBoxW] = useState(1000);
  const drawing = useRef<{ color: string; size: number; pts: number[] } | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  function redraw() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of strokesRef.current) drawStroke(ctx, s, w, h);
    if (drawing.current) drawStroke(ctx, drawing.current, w, h);
  }

  // Khớp kích thước canvas với khung (vào/ra toàn màn hình, xoay máy…)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      setBoxW(c.clientWidth || 1000);
      redraw();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(redraw, [strokes]);

  // Cất bút / đổi công cụ giữa lúc đang gõ → ghi chữ lại trước khi đóng ô
  useEffect(() => {
    if (tool !== "text") commitText(typingRef.current?.id);
  }, [tool]);

  function commitText(id?: number) {
    const t = typingRef.current;
    if (!t || t.id !== id) return;
    typingRef.current = null;
    setTyping(null);
    const text = t.value.trim();
    if (text) onChange([...strokesRef.current, { kind: "text", color, size, x: t.x, y: t.y, text }]);
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
  }

  function erase(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y, r } = point(e);
    const px = x * r.width;
    const py = y * r.height;
    const ctx = canvasRef.current?.getContext("2d");
    const keep = strokesRef.current.filter((s) => {
      if (s.kind === "text") {
        if (!ctx) return true;
        const fs = fontPx(s.size, r.width);
        ctx.font = textFont(fs);
        const tw = ctx.measureText(s.text).width;
        const tx = s.x * r.width;
        const ty = s.y * r.height;
        return !(px >= tx - ERASER_RADIUS && px <= tx + tw + ERASER_RADIUS && py >= ty - ERASER_RADIUS && py <= ty + fs * 1.2 + ERASER_RADIUS);
      }
      const p = s.pts;
      const pad = ERASER_RADIUS + (s.size * r.width) / 2000;
      if (p.length === 2) return Math.hypot(px - p[0] * r.width, py - p[1] * r.height) > pad;
      for (let i = 0; i < p.length - 2; i += 2) {
        if (distToSeg(px, py, p[i] * r.width, p[i + 1] * r.height, p[i + 2] * r.width, p[i + 3] * r.height) <= pad)
          return false;
      }
      return true;
    });
    if (keep.length !== strokesRef.current.length) onChange(keep);
  }

  const fs = fontPx(size, boxW);
  return (
    <>
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 z-10 h-full w-full touch-none",
        !tool && "pointer-events-none",
        tool === "pen" && "cursor-crosshair",
        tool === "eraser" && "cursor-cell",
        tool === "text" && "cursor-text",
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        commitText(typingRef.current?.id);
        onRelease();
      }}
      onPointerDown={(e) => {
        if (!tool || (e.pointerType === "mouse" && e.button !== 0)) return;
        if (tool === "text") {
          e.preventDefault();
          commitText(typingRef.current?.id);
          const { x, y } = point(e);
          setTyping({ id: Date.now(), x, y, value: "" });
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        if (tool === "eraser") return erase(e);
        const { x, y } = point(e);
        drawing.current = { color, size, pts: [x, y] };
        redraw();
      }}
      onPointerMove={(e) => {
        if (!tool || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (tool === "eraser") return erase(e);
        const s = drawing.current;
        if (!s) return;
        const { x, y } = point(e);
        s.pts.push(x, y);
        redraw();
      }}
      onPointerUp={(e) => {
        const s = drawing.current;
        drawing.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (s) onChange([...strokesRef.current, s]);
      }}
      onPointerCancel={() => {
        drawing.current = null;
        redraw();
      }}
    />
    {typing && (
      <input
        key={typing.id}
        autoFocus
        value={typing.value}
        onChange={(e) => setTyping({ ...typing, value: e.target.value })}
        onBlur={() => commitText(typing.id)}
        onKeyDown={(e) => {
          // Không để Esc/phím tắt của lớp học bắt mất phím khi đang gõ
          e.stopPropagation();
          if (e.key === "Enter") commitText(typing.id);
          if (e.key === "Escape") {
            typingRef.current = null;
            setTyping(null);
          }
        }}
        placeholder="Gõ chữ…"
        className="absolute z-10 min-w-[8rem] rounded border border-dashed border-brand-500 bg-transparent px-0.5 font-semibold outline-none placeholder:text-classroom-muted-foreground/60"
        style={{
          left: `${typing.x * 100}%`,
          top: `${typing.y * 100}%`,
          color,
          fontSize: fs,
          lineHeight: 1.2,
          width: `${Math.max(8, typing.value.length + 2)}ch`,
          margin: "-1px 0 0 -3px",
        }}
      />
    )}
    </>
  );
}

/** Bảng chọn bút: màu, cỡ nét, gôm, hoàn tác nét, xoá trang. */
export function InkPalette({
  tool,
  color,
  size,
  canUndo,
  vertical,
  onTool,
  onColor,
  onSize,
  onUndo,
  onClear,
}: {
  tool: InkTool | null;
  color: string;
  size: number;
  canUndo: boolean;
  /** Xếp dọc (thanh bên phải khi trình chiếu) hay ngang (trên thanh công cụ dưới). */
  vertical?: boolean;
  onTool: (t: InkTool | null) => void;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  const icon = "grid h-8 w-8 place-items-center rounded-lg transition-colors";
  const sep = vertical ? "my-0.5 h-px w-6 bg-classroom-hover" : "mx-0.5 h-6 w-px bg-classroom-hover";
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-classroom-border bg-classroom-surface/95 p-1.5 shadow-soft backdrop-blur",
        vertical ? "flex-col" : "flex-row flex-wrap justify-center",
      )}
    >
      <button
        onClick={() => onTool("pen")}
        className={cn(icon, tool === "pen" ? "bg-brand-600 text-white" : "text-classroom-secondary hover:bg-classroom-muted")}
        title="Bút (Ctrl+P bật/tắt) · chuột phải để cất bút"
      >
        <PenLine className="h-4 w-4" />
      </button>
      <button
        onClick={() => onTool("text")}
        className={cn(icon, tool === "text" ? "bg-brand-600 text-white" : "text-classroom-secondary hover:bg-classroom-muted")}
        title="Viết chữ — bấm vào chỗ muốn viết, Enter để xong"
      >
        <Type className="h-4 w-4" />
      </button>
      <button
        onClick={() => onTool("eraser")}
        className={cn(icon, tool === "eraser" ? "bg-brand-600 text-white" : "text-classroom-secondary hover:bg-classroom-muted")}
        title="Gôm — quẹt qua nét để xoá"
      >
        <Eraser className="h-4 w-4" />
      </button>
      <span className={sep} />
      {INK_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => {
            onColor(c);
            if (tool !== "text") onTool("pen");
          }}
          className={cn(icon, "hover:bg-classroom-muted")}
          title="Màu bút"
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full border border-black/20",
              color === c && "ring-2 ring-brand-500 ring-offset-2 ring-offset-classroom-surface",
            )}
            style={{ background: c }}
          />
        </button>
      ))}
      <span className={sep} />
      {INK_SIZES.map((s) => (
        <button
          key={s}
          onClick={() => {
            onSize(s);
            if (tool !== "text") onTool("pen");
          }}
          className={cn(icon, size === s ? "bg-classroom-muted" : "hover:bg-classroom-muted")}
          title="Cỡ nét / cỡ chữ"
        >
          <span className="rounded-full" style={{ width: 3 + s * 1.6, height: 3 + s * 1.6, background: color }} />
        </button>
      ))}
      <span className={sep} />
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={cn(icon, "text-classroom-secondary hover:bg-classroom-muted disabled:opacity-40")}
        title="Bỏ nét / chữ vừa thêm"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={onClear}
        disabled={!canUndo}
        className={cn(icon, "text-classroom-secondary hover:bg-classroom-muted disabled:opacity-40")}
        title="Xoá hết nét trên trang này"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onTool(null)}
        className={cn(icon, "text-classroom-secondary hover:bg-classroom-muted")}
        title="Cất bút — bấm lại được vào slide (Esc / chuột phải)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
