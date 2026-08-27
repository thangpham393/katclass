"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Music, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { dbErrorMessage } from "@/lib/db";
import {
  deleteLessonDeck,
  fetchLessonDecks,
  uploadLessonDeck,
  type LessonDeck,
} from "@/lib/db-decks";

/** Đếm số trang của bản PDF để đối chiếu với số slide trong .pptx. */
async function pdfPageCount(file: File): Promise<number> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return doc.numPages;
}

/**
 * Nạp BỘ SLIDE CÓ TIẾNG cho một bài học: chọn file .pptx gốc + bản PDF xuất ra
 * từ chính nó. Hình chiếu trong lớp lấy từ PDF (giống hệt bản gốc), còn nút loa
 * bóc từ .pptx kèm toạ độ nên bấm đúng chỗ cái loa trên slide.
 *
 * Nạp một lần, mọi giáo viên dạy bài đó đều chiếu được — không phụ thuộc file
 * nằm trên máy của ai.
 */
export function LessonDeckModal({
  lesson,
  onClose,
  onChanged,
}: {
  lesson: { id: string; title: string; unit?: number | null };
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [decks, setDecks] = useState<LessonDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [pptx, setPptx] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const pptxInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true);
    fetchLessonDecks([lesson.id])
      .then(setDecks)
      .catch((e) => setError(dbErrorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [lesson.id]);

  async function handleUpload() {
    if (!pptx || !pdf) return;
    setError(null);
    setWarn(null);
    try {
      const pages = await pdfPageCount(pdf);
      setStep("Đang đọc file PowerPoint…");
      const res = await uploadLessonDeck({
        lessonId: lesson.id,
        pptx,
        pdf,
        name,
        onProgress: (p) => setStep(p.step),
      });
      if (pages !== res.slideCount) {
        setWarn(
          `Bản PDF có ${pages} trang nhưng file PowerPoint có ${res.slideCount} slide. ` +
            "Nút tiếng có thể lệch trang — nên xuất lại PDF từ đúng file .pptx này.",
        );
      }
      setPptx(null);
      setPdf(null);
      setName("");
      if (pptxInput.current) pptxInput.current.value = "";
      if (pdfInput.current) pdfInput.current.value = "";
      reload();
      onChanged?.();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setStep(null);
    }
  }

  async function handleDelete(d: LessonDeck) {
    if (!window.confirm(`Xoá bộ slide “${d.name}”? Các file hình và tiếng cũng bị xoá.`)) return;
    try {
      await deleteLessonDeck(d);
      reload();
      onChanged?.();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  const busy = Boolean(step);

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Bộ slide có tiếng — ${lesson.unit ? `Bài ${lesson.unit}: ` : ""}${lesson.title}`}
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        {warn && (
          <p className="rounded-lg border border-gold-300 bg-gold-50 p-3 text-sm text-gold-800">{warn}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : decks.length ? (
          <div className="space-y-2">
            {decks.map((d) => {
              const spots = d.spots.flat();
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.slide_count} slide · {spots.length} nút tiếng
                      {spots.some((s) => !s.rect) && " (có nút không gắn được vào hình)"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(d)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa có bộ slide nào. Chọn file .pptx gốc và bản PDF xuất từ chính nó
            (PowerPoint: <b>File › Export › Create PDF</b>).
          </p>
        )}

        <div className="space-y-3 rounded-xl border border-dashed p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="File PowerPoint (.pptx)" hint="Nguồn lấy tiếng và vị trí nút loa.">
              <input
                ref={pptxInput}
                type="file"
                accept=".pptx"
                onChange={(e) => setPptx(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
                disabled={busy}
              />
            </Field>
            <Field label="Bản PDF của chính file đó" hint="Nguồn hình chiếu — giữ nguyên bố cục gốc.">
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
                disabled={busy}
              />
            </Field>
          </div>
          <Field label="Tên hiển thị" hint="Bỏ trống thì lấy tên file .pptx.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bài 5 — 你叫什么名字"
              disabled={busy}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={handleUpload} disabled={!pptx || !pdf || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Đang nạp…" : "Nạp bộ slide"}
            </Button>
            {step && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Music className="h-3.5 w-3.5" /> {step}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
