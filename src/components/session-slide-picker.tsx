"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileCode, Loader2, Maximize2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import { saveSessionPrep } from "@/lib/db-classroom";
import {
  downloadHtmlSlide,
  fetchHtmlSlide,
  fetchLessonHtmlSlides,
  isHtmlFile,
  saveHtmlSlide,
  searchHtmlSlides,
  type HtmlSlide,
} from "@/lib/db-html-slides";
import { HtmlSlideStage, presentHtmlSlide } from "@/components/classroom/html-slide-stage";

export interface SlideStatus {
  done: boolean;
  label: string;
}

/**
 * Chọn sẵn slide HTML cho buổi ở trang Chuẩn bị: slide của bài đã chọn hiện
 * sẵn, lấy thêm từ kho chung hoặc tải file mới (tự lưu vào kho, gắn với bài).
 * Chọn là lưu ngay vào sessions.html_slide_id — vào lớp slide đó mở đầu tiên;
 * không chọn thì lớp mở slide đầu tiên của bài.
 */
export function SessionSlidePicker({
  sessionId,
  lessonIds,
  selectedId,
  onSelected,
  onStatus,
}: {
  sessionId: string;
  lessonIds: string[];
  selectedId: string | null;
  onSelected: () => void;
  onStatus: (s: SlideStatus) => void;
}) {
  const [lessonSlides, setLessonSlides] = useState<HtmlSlide[]>([]);
  const [chosen, setChosen] = useState<HtmlSlide | null>(null);
  const [preview, setPreview] = useState<{ id: string; html: string } | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState<HtmlSlide[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const idKey = lessonIds.join(",");

  useEffect(() => {
    let dead = false;
    fetchLessonHtmlSlides(lessonIds)
      .then((rows) => !dead && setLessonSlides(rows))
      .catch((e) => !dead && setError(dbErrorMessage(e)));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Slide của buổi có thể nằm ngoài các bài đã chọn (lấy từ kho) → tra riêng
  useEffect(() => {
    if (!selectedId) return setChosen(null);
    const hit = lessonSlides.find((s) => s.id === selectedId);
    if (hit) return setChosen(hit);
    let dead = false;
    fetchHtmlSlide(selectedId)
      .then((s) => !dead && setChosen(s))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [selectedId, lessonSlides]);

  const effective = chosen ?? lessonSlides[0] ?? null;

  useEffect(() => {
    onStatus(
      chosen
        ? { done: true, label: "Đã chọn slide riêng cho buổi" }
        : effective
          ? { done: true, label: "Dùng slide của bài học" }
          : { done: false, label: "Chưa có slide" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id, effective?.id]);

  // Xem trước slide sẽ mở khi vào lớp
  useEffect(() => {
    if (!effective || preview?.id === effective.id) return;
    let dead = false;
    downloadHtmlSlide(effective)
      .then((html) => !dead && setPreview({ id: effective.id, html }))
      .catch(() => {});
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective?.id]);

  useEffect(() => {
    if (!browsing) return;
    let dead = false;
    const t = window.setTimeout(() => {
      searchHtmlSlides(query, 20)
        .then((rows) => !dead && setStore(rows))
        .catch(() => {});
    }, 250);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [browsing, query]);

  async function choose(id: string | null) {
    setError(null);
    try {
      await saveSessionPrep(sessionId, { html_slide_id: id });
      setBrowsing(false);
      onSelected();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  async function upload(files: FileList | null) {
    const file = Array.from(files ?? []).find(isHtmlFile);
    if (!file) {
      if (files?.length) setError("Chỉ nhận file slide .html");
      return;
    }
    setError(null);
    setBusy(`Đang tải lên ${file.name}…`);
    try {
      const { slide, existed } = await saveHtmlSlide({ file, html: await file.text(), lessonId: lessonIds[0] ?? null });
      if (!existed && slide.lesson_id && lessonIds.includes(slide.lesson_id)) {
        setLessonSlides((rows) => [...rows, slide]);
      }
      await choose(slide.id);
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const rows = chosen && !lessonSlides.some((s) => s.id === chosen.id) ? [chosen, ...lessonSlides] : lessonSlides;

  return (
    <div className="space-y-3">
      {error && <ErrorNote message={error} />}

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((s) => {
            const active = effective?.id === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  active && "border-brand-300 bg-brand-50",
                )}
              >
                <FileCode className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {lessonIds.includes(s.lesson_id ?? "") ? "Slide của bài" : "Từ kho chung"}
                    {active && " · vào lớp mở slide này"}
                  </div>
                </div>
                {chosen?.id === s.id ? (
                  <Button variant="ghost" size="sm" onClick={() => choose(null)} title="Bỏ chọn — vào lớp mở slide đầu tiên của bài">
                    Bỏ chọn
                  </Button>
                ) : (
                  !active && (
                    <Button variant="outline" size="sm" onClick={() => choose(s.id)}>
                      Dùng cho buổi
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
        <Button size="sm" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Tải file slide
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBrowsing((v) => !v)}>
          <Search className="h-4 w-4" /> Chọn trong kho
        </Button>
        {busy && <span className="text-xs text-muted-foreground">{busy}</span>}
      </div>

      {browsing && (
        <div className="space-y-2 rounded-xl border p-3">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên slide…" />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {store.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {query.trim() ? "Không tìm thấy slide nào" : "Kho chưa có slide nào"}
              </p>
            ) : (
              store.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose(s.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("vi-VN")}
                  </span>
                  {effective?.id === s.id && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {effective ? (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          <div className="aspect-video w-full">
            {preview?.id === effective.id ? (
              <HtmlSlideStage name={effective.name} html={preview.html} save="stored" showChrome={false} autoFocus={false} onClose={() => {}} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          {preview?.id === effective.id && (
            <button
              onClick={() => presentHtmlSlide(effective.name, preview.html)}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/75"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Xem cửa sổ lớn
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có slide. Tải file slide .html lên hoặc chọn trong kho — vào lớp là chiếu được luôn,
          file cũng tự lưu vào kho cho giáo viên khác dùng.
        </div>
      )}
    </div>
  );
}
