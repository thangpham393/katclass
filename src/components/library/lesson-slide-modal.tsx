"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FileCode, Link2, Link2Off, Loader2, Search, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/loading";
import { dbErrorMessage } from "@/lib/db";
import {
  attachHtmlSlide,
  deleteHtmlSlide,
  downloadHtmlSlide,
  fetchLessonHtmlSlides,
  isHtmlFile,
  saveHtmlSlide,
  searchHtmlSlides,
  type HtmlSlide,
} from "@/lib/db-html-slides";
import { presentHtmlSlide } from "@/components/classroom/html-slide-stage";

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Nạp sẵn SLIDE HTML cho một bài học: vào lớp dạy bài này là slide tự mở,
 * giáo viên không phải tải lên. Cũng gắn được slide đã có trong kho chung
 * (ví dụ giáo viên tải lên trong lớp khi buổi chưa gán bài).
 */
export function LessonSlideModal({
  lesson,
  onClose,
}: {
  lesson: { id: string; title: string; unit?: number | null };
  onClose: () => void;
}) {
  const [slides, setSlides] = useState<HtmlSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [step, setStep] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState<HtmlSlide[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true);
    fetchLessonHtmlSlides([lesson.id])
      .then(setSlides)
      .catch((e) => setError(dbErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [lesson.id]);

  // Kho chung: chỉ liệt kê slide chưa gắn vào bài này
  useEffect(() => {
    let dead = false;
    const t = window.setTimeout(() => {
      searchHtmlSlides(query, 20)
        .then((rows) => !dead && setStore(rows.filter((r) => r.lesson_id !== lesson.id)))
        .catch(() => {});
    }, 250);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [query, lesson.id, slides.length]);

  async function handleUpload(files: FileList | null) {
    const list = Array.from(files ?? []).filter(isHtmlFile);
    if (!list.length) {
      if (files?.length) setError("Chỉ nhận file slide .html");
      return;
    }
    setError(null);
    const out: string[] = [];
    try {
      for (const [i, file] of list.entries()) {
        setStep(`Đang tải lên ${file.name} (${i + 1}/${list.length})…`);
        const { slide, existed } = await saveHtmlSlide({ file, html: await file.text(), lessonId: lesson.id });
        if (!existed || slide.lesson_id === lesson.id) continue;
        if (slide.lesson_id == null) {
          await attachHtmlSlide(slide.id, lesson.id);
        } else {
          out.push(`“${file.name}” đã có trong kho (tên “${slide.name}”) và đang gắn với bài khác — bỏ qua.`);
        }
      }
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setStep(null);
      setNotes(out);
      reload();
    }
  }

  async function preview(s: HtmlSlide) {
    try {
      presentHtmlSlide(s.name, await downloadHtmlSlide(s));
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  async function attach(s: HtmlSlide, lessonId: string | null) {
    try {
      await attachHtmlSlide(s.id, lessonId);
      reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  async function handleDelete(s: HtmlSlide) {
    if (!window.confirm(`Xoá slide “${s.name}” khỏi kho? Giáo viên khác cũng sẽ không dùng được nữa.`)) return;
    try {
      await deleteHtmlSlide(s);
      reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  const busy = Boolean(step);

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Slide — ${lesson.unit ? `Bài ${lesson.unit}: ` : ""}${lesson.title}`}
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        {notes.map((n) => (
          <p key={n} className="rounded-lg border border-gold-300 bg-gold-50 p-3 text-sm text-gold-800">
            {n}
          </p>
        ))}

        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : slides.length ? (
          <div className="space-y-2">
            {slides.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileCode className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {sizeLabel(s.size_bytes)} · {new Date(s.created_at).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <Button variant="outline" size="sm" title="Xem thử" onClick={() => preview(s)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title="Gỡ khỏi bài này (vẫn giữ trong kho)"
                  onClick={() => attach(s, null)}
                  disabled={busy}
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50"
                  title="Xoá khỏi kho"
                  onClick={() => handleDelete(s)}
                  disabled={busy}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bài này chưa có slide. Tải file .html lên — vào lớp dạy bài này là slide tự mở.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
          <input
            ref={fileInput}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Tải file slide
          </Button>
          <span className="text-sm text-muted-foreground">
            {step ?? "Chọn được nhiều file .html một lúc. Mỗi slide phải là một file duy nhất."}
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Gắn slide có sẵn trong kho</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên slide…"
              className="pl-9"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {store.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {query.trim() ? "Không tìm thấy slide nào" : "Kho chưa có slide nào khác"}
              </p>
            ) : (
              store.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.lesson_id ? "Đang gắn với bài khác" : "Chưa gắn bài"} ·{" "}
                      {new Date(s.created_at).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" title="Xem thử" onClick={() => preview(s)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => attach(s, lesson.id)}
                    disabled={busy}
                    title={s.lesson_id ? "Chuyển slide sang bài này" : "Gắn vào bài này"}
                  >
                    <Link2 className="h-3.5 w-3.5" /> Gắn
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
