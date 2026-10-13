"use client";

import { useEffect, useState } from "react";
import { BookOpen, Library, Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { fetchCumulativeLessonVocab, type VocabRow } from "@/lib/db-content";
import { currentVocabLabel, cumulativeVocabLabel, uniqueClassroomVocab, type ScopeLesson } from "@/lib/classroom-vocab-scope";

export function VocabScopePicker({ title, vocab, lessons, onPick, onBack }: {
  title: string;
  vocab: VocabRow[];
  lessons: ScopeLesson[];
  onPick: (words: VocabRow[], label: string) => void;
  onBack: () => void;
}) {
  const [cumulative, setCumulative] = useState<VocabRow[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const current = uniqueClassroomVocab(vocab);
  let cumulativeLabel = "Từ bài đầu tiên đến bài hiện tại";
  let unavailable = "";
  try { cumulativeLabel = cumulativeVocabLabel(lessons); } catch (reason) {
    unavailable = reason instanceof Error ? reason.message : "Chưa xác định được phạm vi bài học.";
  }
  const lessonKey = JSON.stringify(lessons.map((lesson) => [lesson.id, lesson.unit, lesson.textbook_id, lesson.course_id]));
  useEffect(() => {
    if (unavailable) return;
    let cancelled = false;
    setCumulative(null); setError("");
    fetchCumulativeLessonVocab(lessons).then((words) => {
      if (!cancelled) setCumulative(words);
    }).catch(() => {
      if (!cancelled) setError("Chưa tải được từ vựng tổng hợp. Kiểm tra kết nối rồi thử lại.");
    });
    return () => { cancelled = true; };
    // Preserve the request across parent re-renders, but reload if lesson/source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, unavailable, retry]);

  return <div className="flex min-h-full flex-col justify-center gap-6 rounded-2xl border border-classroom-border-muted bg-classroom-surface p-5 sm:p-8">
    <button onClick={onBack} className="inline-flex w-fit items-center gap-2 text-sm text-classroom-secondary"><ArrowLeft size={16} /> Trò khác</button>
    <div className="text-center"><div className="text-sm font-semibold text-classroom-accent">{title}</div><h2 className="mt-2 text-2xl font-bold text-classroom-foreground">Chọn phạm vi từ vựng</h2><p className="mt-2 text-sm text-classroom-muted-foreground">Luyện bài đang học hoặc ôn lại các bài đã học.</p></div>
    <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-2">
      <button disabled={!current.length} onClick={() => onPick(current, currentVocabLabel(lessons))} className="rounded-2xl border border-classroom-border bg-classroom-muted p-6 text-left transition-colors hover:border-brand-500 hover:bg-classroom-hover disabled:opacity-40">
        <BookOpen className="mb-4 h-8 w-8 text-classroom-accent" /><h3 className="text-lg font-bold text-classroom-foreground">Từ vựng của bài</h3><p className="mt-1 text-sm text-classroom-secondary">{currentVocabLabel(lessons)}</p><p className="mt-4 text-xs text-classroom-muted-foreground">{current.length ? `${current.length} từ · Bắt đầu chơi →` : "Bài này chưa có từ vựng"}</p>
      </button>
      <button disabled={!!unavailable || !!error || !cumulative?.length} onClick={() => cumulative && onPick(cumulative, cumulativeLabel)} className="rounded-2xl border border-classroom-border bg-classroom-muted p-6 text-left transition-colors hover:border-brand-500 hover:bg-classroom-hover disabled:opacity-50">
        <Library className="mb-4 h-8 w-8 text-classroom-accent" /><h3 className="text-lg font-bold text-classroom-foreground">Từ vựng tổng hợp</h3><p className="mt-1 text-sm text-classroom-secondary">{cumulativeLabel}</p><div className="mt-4 text-xs text-classroom-muted-foreground" role="status">{unavailable || error || (cumulative === null ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Đang tải từ vựng…</span> : cumulative.length ? `${cumulative.length} từ · Bắt đầu chơi →` : "Chưa có từ vựng trong phạm vi này")}</div>
      </button>
    </div>
    {error && <div className="text-center"><button onClick={() => setRetry((value) => value + 1)} className="inline-flex items-center gap-2 text-sm text-classroom-accent"><RefreshCw size={14} /> Tải lại từ vựng tổng hợp</button></div>}
  </div>;
}
