"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Presentation, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/loading";
import { dbErrorMessage } from "@/lib/db";
import { downloadHtmlSlide, fetchMySharedSlides, type SharedSlide } from "@/lib/db-html-slides";
import { HtmlSlideStage } from "@/components/classroom/html-slide-stage";

/** Mỗi slide hiện một lần (cùng slide gửi ở nhiều buổi → lấy lần gửi mới nhất). */
export function uniqueSlides(rows: SharedSlide[]): SharedSlide[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.slide_id) ? false : (seen.add(r.slide_id), true)));
}

function sessionLabel(s: SharedSlide) {
  const d = new Date(s.session_date + "T00:00:00").toLocaleDateString("vi-VN");
  return [s.class_name, s.session_no ? `Buổi ${s.session_no}` : null, d].filter(Boolean).join(" · ");
}

/** Xem slide toàn màn hình (slide HTML chạy trong iframe sandbox như trong lớp). */
export function SharedSlideViewer({ slide, onClose }: { slide: Pick<SharedSlide, "name" | "path">; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    downloadHtmlSlide(slide)
      .then((t) => !dead && setHtml(t))
      .catch((e) => !dead && setError(dbErrorMessage(e)));
    return () => {
      dead = true;
    };
  }, [slide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <Presentation className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{slide.name}</span>
        {html && (
          <button
            onClick={() => box.current?.requestFullscreen?.().catch(() => {})}
            className="hidden h-8 items-center gap-1 rounded-lg bg-white/10 px-2 text-xs font-semibold hover:bg-white/20 sm:inline-flex"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Toàn màn hình
          </button>
        )}
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
          title="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={box} className="relative min-h-0 flex-1">
        {error ? (
          <div className="grid h-full place-items-center p-4">
            <ErrorNote message={error} />
          </div>
        ) : html ? (
          <HtmlSlideStage name={slide.name} html={html} save="stored" showChrome={false} onClose={onClose} />
        ) : (
          <div className="grid h-full place-items-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Danh sách slide dạng thẻ — bấm để xem. */
export function SharedSlideList({ slides, showSession = true }: { slides: SharedSlide[]; showSession?: boolean }) {
  const [open, setOpen] = useState<SharedSlide | null>(null);
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {slides.map((s) => (
          <button
            key={s.slide_id + s.session_id}
            onClick={() => setOpen(s)}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-brand-300 hover:shadow-sm"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-100 to-gold-100 text-brand-600">
              <Presentation className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{s.name}</div>
              {showSession && <div className="truncate text-xs text-muted-foreground">{sessionLabel(s)}</div>}
            </div>
          </button>
        ))}
      </div>
      {open && <SharedSlideViewer slide={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * Mục “PPT bài giảng” ở trang ôn tập bài học / báo cáo buổi: slide giáo viên
 * đã tích gửi sau buổi học. Chưa có slide nào thì ẩn hẳn.
 */
export function SharedSlidesSection({ lessonId, sessionId }: { lessonId?: string; sessionId?: string }) {
  const [slides, setSlides] = useState<SharedSlide[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    fetchMySharedSlides({ lessonId, sessionId })
      .then((rows) => !dead && setSlides(uniqueSlides(rows)))
      .catch((e) => !dead && setError(dbErrorMessage(e)));
    return () => {
      dead = true;
    };
  }, [lessonId, sessionId]);

  if (error) return <ErrorNote message={error} />;
  if (!slides?.length) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Presentation className="h-5 w-5 text-brand-600" /> PPT bài giảng ({slides.length})
      </h2>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <SharedSlideList slides={slides} showSession={!sessionId} />
        </CardContent>
      </Card>
    </section>
  );
}
