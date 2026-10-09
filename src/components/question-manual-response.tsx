"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { QuestionContent } from "@/lib/question-schema";

const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const AUDIO = /^data:audio\/(webm|mp4|mpeg|ogg|wav)(?:;codecs=[\w-]+)?;base64,[A-Za-z0-9+/=]+$/;
export function isManualMedia(value: unknown): value is string {
  return typeof value === "string" && value.length <= 2_800_000 && (IMAGE.test(value) || AUDIO.test(value));
}

export function ManualResponsePreview({ value }: { value: unknown }) {
  if (isManualMedia(value)) {
    if (value.startsWith("data:image/")) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={value} alt="Bài làm học viên" className="max-h-96 max-w-full rounded-lg border object-contain" />;
    }
    return <audio src={value} controls className="max-w-full" />;
  }
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const order: unknown = JSON.parse(value);
      if (Array.isArray(order) && order.every(item => typeof item === "string")) return <ol className="list-decimal space-y-1 pl-5">{order.map((sentence, i) => <li className="zh" key={i}>{sentence}</li>)}</ol>;
    } catch { /* Plain written response. */ }
  }
  return <p className="zh whitespace-pre-wrap rounded bg-muted/40 p-2">{typeof value === "string" && value.trim() ? value : "Chưa có bài làm."}</p>;
}

export function ManualResponseInput({ content, value, onChange }: {
  content: QuestionContent; value: string; onChange: (value: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [color, setColor] = useState("#111827");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const mode = content.response_mode;

  useEffect(() => {
    if (mode !== "drawing") return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    let active = true;
    context.fillStyle = "white";
    context.fillRect(0, 0, 720, 720);
    setReady(false);
    // Reload the saved work first; otherwise use the illustration as the paper.
    const src = IMAGE.test(value) ? value : content.image?.url;
    if (!src) { setReady(true); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      const scale = Math.min(720/img.width,720/img.height);
      context.drawImage(img,(720-img.width*scale)/2,(720-img.height*scale)/2,img.width*scale,img.height*scale);
      setReady(true);
    };
    img.onerror = () => { if (active) { setError("Không tải được hình để vẽ. Bạn có thể tải ảnh bài làm lên."); setReady(false); } };
    img.src = src;
    return () => { active = false; };
    // Do not repaint the canvas during a stroke or when saving its current work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, content.image?.url]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > 2_000_000 || !(mode === "oral" ? /^audio\// : /^image\/(png|jpeg|webp)$/).test(file.type)) {
      setError(mode === "oral" ? "Chọn bản ghi âm dưới 2 MB." : "Chọn ảnh PNG, JPG hoặc WebP dưới 2 MB."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (!isManualMedia(reader.result)) { setError("Định dạng bài làm chưa được hỗ trợ."); return; }
      onChange(reader.result);
      if (mode === "drawing" && canvas.current) {
        const img = new Image();
        img.onload = () => {
          const context = canvas.current?.getContext("2d");
          if (!context) return;
          context.fillStyle = "white"; context.fillRect(0,0,720,720);
          const scale = Math.min(720/img.width,720/img.height);
          context.drawImage(img,(720-img.width*scale)/2,(720-img.height*scale)/2,img.width*scale,img.height*scale);
          setReady(true);
        };
        img.src = reader.result;
      }
    };
    reader.onerror = () => setError("Không đọc được tệp bài làm.");
    reader.readAsDataURL(file);
  }

  function finish() {
    drawing.current = false;
    if (!dirty.current || !canvas.current) return;
    try { onChange(canvas.current.toDataURL("image/jpeg", 0.8)); dirty.current = false; }
    catch { setError("Không lưu được hình vẽ. Hãy tải ảnh bài làm lên."); }
  }

  return <div className="space-y-3">
    {mode === "drawing" && <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">Màu <input aria-label="Màu bút" type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
        <Button type="button" variant="outline" onClick={() => setColor("#ffffff")}>Tẩy</Button>
      </div>
      <canvas ref={canvas} width={720} height={720} aria-label="Khung luyện viết và tô màu"
        className="h-auto w-full max-w-xl touch-none rounded-xl border bg-white"
        onPointerDown={e => {
          if (!ready) return;
          const context = canvas.current!.getContext("2d")!;
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          dirty.current = true;
          context.strokeStyle = color; context.lineWidth = color === "#ffffff" ? 18 : 5;
          context.lineCap = "round"; context.lineJoin = "round";
          const x = (e.clientX-rect.left)*720/rect.width;
          const y = (e.clientY-rect.top)*720/rect.height;
          context.fillStyle = color;
          context.beginPath(); context.arc(x,y,context.lineWidth/2,0,Math.PI*2); context.fill();
          context.beginPath(); context.moveTo(x,y);
        }}
        onPointerMove={e => {
          if (!drawing.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const context = canvas.current!.getContext("2d")!;
          context.lineTo((e.clientX-rect.left)*720/rect.width,(e.clientY-rect.top)*720/rect.height); context.stroke();
        }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
    </>}
    <label className="block space-y-1 text-sm font-medium">
      {mode === "oral" ? "Tải bản ghi âm bài nói" : "Hoặc tải ảnh bài làm"}
      <input type="file" accept={mode === "oral" ? "audio/*" : "image/png,image/jpeg,image/webp"} onChange={e => void upload(e.target.files?.[0])} className="block max-w-full text-sm" />
    </label>
    {mode === "oral" && !isManualMedia(value) && <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Hoặc viết nội dung bài nói để giáo viên nhận xét…" />}
    {value && (mode === "oral" || !ready) && <ManualResponsePreview value={value} />}
    <p className="text-xs text-muted-foreground">Giáo viên xem bài làm và chấm điểm sau khi bạn nộp.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
