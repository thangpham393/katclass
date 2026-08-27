"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Loader2, Pause, Play, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { signDeckFile, signDeckFiles, type DeckSpot, type LessonDeck } from "@/lib/db-decks";

/**
 * Chiếu bộ slide đã nạp sẵn trong thư viện: hình là bản PDF xuất từ chính file
 * PowerPoint (giống 100% bản gốc), còn các nút loa được vẽ đè lên đúng chỗ cái
 * loa trong slide — bấm từ nào nghe từ đó, thứ mà nhúng Google Slides không
 * cho bấm và bộ vẽ .pptx bằng JavaScript không dựng nổi.
 *
 * Chuyển slide bấm thẳng trên hình như đang trình chiếu PowerPoint.
 */
export function DeckStage({ deck, onClose }: { deck: LessonDeck; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoStopRef = useRef<number | null>(null);
  /** Mốc giây phải dừng của đoạn đang phát; null = phát tới hết file. */
  const stopAtRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(deck.slide_count);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  /** Khung hình thật của trang PDF trên màn hình, để đặt nút loa cho khớp. */
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [playing, setPlaying] = useState<string | null>(null);
  const [video, setVideo] = useState<{ name: string; url: string; clip: DeckSpot["clip"] } | null>(null);

  /* --------- Mở PDF + xin link tạm cho toàn bộ file tiếng --------- */
  useEffect(() => {
    let dead = false;
    setStatus("loading");
    setPage(0);
    pageRef.current = 0;

    (async () => {
      try {
        const media = Array.from(new Set(deck.spots.flat().map((s) => s.path)));
        const [pdfUrl, signed] = await Promise.all([signDeckFile(deck.pdf_path), signDeckFiles(media)]);
        if (dead) return;
        setUrls(signed);

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (dead) return;
        docRef.current = doc;
        setCount(doc.numPages);
        setStatus("ready");
      } catch (e) {
        if (dead) return;
        console.error(e);
        setError("Không tải được bộ slide. Kiểm tra mạng rồi thử lại.");
        setStatus("error");
      }
    })();

    return () => {
      dead = true;
      taskRef.current?.cancel();
      docRef.current = null;
    };
  }, [deck]);

  /* --------- Vẽ trang PDF vừa khít khung, nét theo mật độ màn hình --------- */
  const draw = useCallback(async () => {
    const doc = docRef.current;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!doc || !box || !canvas) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pdfPage = await doc.getPage(pageRef.current + 1);
    const base = pdfPage.getViewport({ scale: 1 });
    const fit = Math.min(rect.width / base.width, rect.height / base.height);
    // Vẽ ở mật độ điểm ảnh thật của màn hình rồi thu về kích thước CSS —
    // chữ Hán nét mảnh mới không bị nhoè trên máy chiếu Retina.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: fit * dpr });
    const cssW = Math.floor(base.width * fit);
    const cssH = Math.floor(base.height * fit);

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    setFrame({ w: cssW, h: cssH });

    taskRef.current?.cancel();
    const task = pdfPage.render({ canvas, viewport });
    taskRef.current = task;
    try {
      await task.promise;
    } catch {
      /* huỷ giữa chừng vì đổi slide / đổi kích thước — bỏ qua */
    }
  }, []);

  useEffect(() => {
    if (status === "ready") void draw();
  }, [status, page, draw]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => void draw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [draw]);

  /* --------- Chuyển slide --------- */
  const go = useCallback((next: number) => {
    const max = (docRef.current?.numPages ?? 1) - 1;
    const target = Math.max(0, Math.min(next, max));
    if (target === pageRef.current) return;
    pageRef.current = target;
    setPage(target);
    audioRef.current?.pause();
    stopAtRef.current = null;
    setPlaying(null);
    setVideo(null);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(pageRef.current + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(pageRef.current - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, go]);

  /* --------- Phát tiếng --------- */

  /**
   * Phát đúng đoạn của nút vừa bấm.
   *
   * Nhiều giáo trình gán CẢ file nghe của bài vào mọi nút rồi cắt đoạn cho
   * từng từ, nên phải nhảy tới `clip.start` và tự dừng ở `độ dài − clip.trimEnd`
   * (thẻ <p14:trim> của PowerPoint) — nếu không, bấm từ nào cũng chạy cả bài.
   */
  function playClip(el: HTMLMediaElement, url: string, clip: DeckSpot["clip"]) {
    const begin = () => {
      const stop =
        clip && clip.trimEnd > 0 && Number.isFinite(el.duration) ? el.duration - clip.trimEnd : null;
      stopAtRef.current = stop != null && stop > (clip?.start ?? 0) ? stop : null;
      el.currentTime = clip?.start ?? 0;
      void el.play().catch(() => setPlaying(null));
    };
    el.pause();
    // Chờ biết độ dài file mới tính được mốc dừng (mốc đo ngược từ cuối file)
    if (el.src !== url) {
      el.src = url;
      el.addEventListener("loadedmetadata", begin, { once: true });
      el.load();
    } else {
      begin();
    }
  }

  function onTimeUpdate(e: React.SyntheticEvent<HTMLMediaElement>) {
    const el = e.currentTarget;
    const stop = stopAtRef.current;
    if (stop != null && el.currentTime >= stop) {
      el.pause();
      stopAtRef.current = null;
      setPlaying(null);
    }
  }

  function toggle(spot: DeckSpot, id: string) {
    const url = urls.get(spot.path);
    const a = audioRef.current;
    if (!url) return;
    if (spot.kind === "video") {
      a?.pause();
      setPlaying(null);
      setVideo({ name: spot.name, url, clip: spot.clip });
      return;
    }
    if (!a) return;
    if (playing === id) {
      a.pause();
      stopAtRef.current = null;
      setPlaying(null);
      return;
    }
    playClip(a, url, spot.clip);
    setPlaying(id);
  }

  const spots = deck.spots[page] ?? [];
  const pinned = spots.filter((s) => s.rect);
  const loose = spots.filter((s) => !s.rect);

  return (
    <div className="group relative h-full w-full overflow-hidden bg-black">
      <div
        ref={boxRef}
        onClick={(e) => {
          if (status !== "ready") return;
          const r = e.currentTarget.getBoundingClientRect();
          go(pageRef.current + (e.clientX - r.left < r.width * 0.2 ? -1 : 1));
        }}
        onContextMenu={(e) => {
          if (status !== "ready") return;
          e.preventDefault();
          go(pageRef.current - 1);
        }}
        className={cn(
          "absolute inset-0 grid place-items-center overflow-hidden pt-9",
          status === "ready" && "cursor-pointer",
        )}
      >
        <div className="relative" style={{ width: frame.w || undefined, height: frame.h || undefined }}>
          <canvas ref={canvasRef} className={cn(status !== "ready" && "invisible")} />

          {/*
            Nút loa vẽ đè đúng chỗ icon trong slide gốc (toạ độ theo tỉ lệ nên
            phóng to thu nhỏ vẫn khớp). Để trong suốt, chỉ sáng lên khi rê chuột
            — slide vẫn là slide, không bị nút che chữ.
          */}
          {status === "ready" &&
            pinned.map((s, i) => (
              <button
                key={`${s.path}-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s, `pin-${i}`);
                }}
                title={`Phát ${s.name}`}
                style={{
                  left: `${s.rect!.x * 100}%`,
                  top: `${s.rect!.y * 100}%`,
                  width: `${s.rect!.w * 100}%`,
                  height: `${s.rect!.h * 100}%`,
                }}
                className={cn(
                  "absolute grid place-items-center rounded-full transition",
                  playing === `pin-${i}`
                    ? "bg-gold-500/40 ring-2 ring-gold-400"
                    : "hover:bg-brand-500/25 hover:ring-2 hover:ring-brand-400/70",
                )}
              >
                {playing === `pin-${i}` && <Pause className="h-1/2 w-1/2 text-white drop-shadow" />}
              </button>
            ))}
        </div>
      </div>

      {status === "ready" && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-3 group-hover:flex">
          <span className={cn("grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white/70 backdrop-blur", page === 0 && "opacity-0")}>
            <ChevronLeft className="h-5 w-5" />
          </span>
          <span className={cn("grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white/70 backdrop-blur", page >= count - 1 && "opacity-0")}>
            <ChevronRight className="h-5 w-5" />
          </span>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ink-300">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang mở {deck.name}…
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-8 text-center">
          <div className="max-w-md">
            <div className="mb-2 text-lg font-bold text-white">Không mở được bộ slide</div>
            <p className="text-sm leading-relaxed text-ink-300">{error}</p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-ink-950/70 px-3 py-1.5 text-xs text-ink-200 backdrop-blur">
        <span className="max-w-[16rem] truncate font-semibold text-white">{deck.name}</span>
        {status === "ready" && (
          <span className="flex items-center gap-1">
            <button
              onClick={() => go(page - 1)}
              disabled={page === 0}
              className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 hover:bg-ink-700 disabled:opacity-40"
              title="Slide trước (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {page + 1}/{count}
            </span>
            <button
              onClick={() => go(page + 1)}
              disabled={page >= count - 1}
              className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 hover:bg-ink-700 disabled:opacity-40"
              title="Slide sau (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="hidden text-ink-400 sm:inline">· bấm lên slide để chuyển</span>
          </span>
        )}

        {/* Tiếng không gắn icon nào trong slide (lời dẫn tự chạy) */}
        {loose.map((s, i) => (
          <button
            key={`${s.path}-${i}`}
            onClick={() => toggle(s, `loose-${i}`)}
            title={`Phát ${s.name}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
              playing === `loose-${i}` ? "bg-gold-600 text-white" : "bg-brand-600/80 text-white hover:bg-brand-600",
            )}
          >
            {playing === `loose-${i}` ? (
              <Pause className="h-3.5 w-3.5" />
            ) : s.kind === "video" ? (
              <Film className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
            {loose.length > 1 ? `Tiếng ${i + 1}` : "Tiếng"}
          </button>
        ))}

        <button
          onClick={onClose}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 font-semibold hover:bg-ink-700"
        >
          <X className="h-3.5 w-3.5" /> Đóng bộ slide
        </button>
      </div>

      {video && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/90 p-6">
          <video
            key={video.url}
            src={video.url}
            controls
            autoPlay
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              const clip = video.clip;
              if (!clip) return;
              el.currentTime = clip.start;
              videoStopRef.current =
                clip.trimEnd > 0 && Number.isFinite(el.duration) ? el.duration - clip.trimEnd : null;
            }}
            onTimeUpdate={(e) => {
              const stop = videoStopRef.current;
              if (stop != null && e.currentTarget.currentTime >= stop) {
                e.currentTarget.pause();
                videoStopRef.current = null;
              }
            }}
            className="max-h-full max-w-full"
          />
          <button
            onClick={() => setVideo(null)}
            className="absolute right-3 top-11 inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 text-xs font-semibold text-white hover:bg-ink-700"
          >
            <X className="h-3.5 w-3.5" /> Đóng video
          </button>
        </div>
      )}

      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => {
          stopAtRef.current = null;
          setPlaying(null);
        }}
        className="hidden"
      />
    </div>
  );
}
