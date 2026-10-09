"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/select";
import { ErrorNote, LoadingRows } from "@/components/ui/loading";
import { dbErrorMessage } from "@/lib/db";
import { fetchQuestions, questionPreview, QUESTION_TYPE_LABELS, type QuestionRow, type QuestionType } from "@/lib/db-content";
import { fetchTextbooks, fetchTextbookLessons, type TextbookLessonRow } from "@/lib/db-library";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { WorkbookQuestionList } from "./workbook-question-list";
import { sourceQuestionLabel } from "@/lib/question-order";
import { QuestionDialogue } from "./question-dialogue";

interface PickerProps {
  textbookId: string;
  lessonId: string;
  selected: string[];
  onBrowse: (textbookId: string, lessonId: string) => void;
  onAdd: (questions: QuestionRow[], lesson: TextbookLessonRow) => void;
  onRemove: (ids: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}

export function HomeworkQuestionPicker(props: PickerProps) {
  const textbooks = useLoad(fetchTextbooks);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Chọn giáo trình để xem bộ đề theo từng bài. Có thể giao cả bộ hoặc mở bộ đề để chọn từng câu.
      </p>
      <Field label="Giáo trình">
        <Select value={props.textbookId} disabled={textbooks.loading} onChange={e => props.onBrowse(e.target.value, "")}>
          <option value="">— Chọn giáo trình —</option>
          {(textbooks.data ?? []).map(tb => <option key={tb.id} value={tb.id}>{tb.name}</option>)}
        </Select>
      </Field>
      {textbooks.error && <ErrorNote message={textbooks.error} />}
      {props.selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 p-3 text-sm">
          <span className="font-semibold text-brand-700" aria-live="polite">Đã chọn {props.selected.length} câu để giao</span>
          <Button type="button" variant="outline" size="sm" onClick={() => props.onRemove(props.selected)}>Bỏ chọn tất cả</Button>
        </div>
      )}
      {props.textbookId ? (
        <TextbookPacks key={props.textbookId} {...props} />
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-6 w-6" />
          Chọn giáo trình ở trên hoặc chọn lớp để dùng giáo trình của lớp.
        </div>
      )}
    </div>
  );
}

function TextbookPacks(props: PickerProps) {
  const lessons = useLoad(() => fetchTextbookLessons(props.textbookId), [props.textbookId]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const onBusyChange = props.onBusyChange;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    onBusyChange(adding !== null);
    return () => onBusyChange(false);
  }, [adding, onBusyChange]);
  const activeLesson = lessons.data?.find(l => l.id === props.lessonId);
  const needle = search.trim().toLowerCase();
  const filtered = (lessons.data ?? []).filter(l =>
    !needle || `${l.unit == null ? "" : `Bài ${l.unit}`} ${l.title} ${l.title_zh ?? ""}`.toLowerCase().includes(needle),
  );

  async function addPack(lesson: TextbookLessonRow) {
    setAdding(lesson.id);
    setError(null);
    try {
      const rows = await fetchQuestions({ lessonId: lesson.id });
      if (!mounted.current) return;
      if (!rows.length) {
        setError("Bài này chưa có câu hỏi để giao.");
        lessons.reload();
        return;
      }
      props.onAdd(rows, lesson);
    } catch (e) {
      if (mounted.current) setError(dbErrorMessage(e));
    } finally {
      if (mounted.current) setAdding(null);
    }
  }

  return (
    <div className="space-y-4">
      <Input aria-label="Tìm bài học" placeholder="Tìm theo tên hoặc số bài…" value={search} onChange={e => setSearch(e.target.value)} />
      {error && <ErrorNote message={error} />}
      {lessons.loading ? <LoadingRows rows={3} className="p-0" /> : lessons.error ? <ErrorNote message={lessons.error} /> : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {needle ? "Không tìm thấy bài học phù hợp." : "Giáo trình này chưa có bài học."}
        </div>
      ) : (
        <div className="grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {filtered.map(l => {
            const count = l.questions[0]?.count ?? 0;
            const active = l.id === props.lessonId;
            return (
              <div key={l.id} className={cn("flex flex-col rounded-xl border p-3", active && "border-brand-500 bg-brand-50/50")}>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{l.unit != null ? `Bài ${l.unit}` : "Bài học"}</Badge>
                  <span className="text-xs text-muted-foreground">{count} câu</span>
                </div>
                <div className="my-2 text-sm font-semibold">{l.title}</div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={!count || adding !== null} onClick={() => addPack(l)}>
                    <Plus className="h-3.5 w-3.5" /> {adding === l.id ? "Đang chọn…" : "Chọn cả bộ"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!count} aria-pressed={active} onClick={() => props.onBrowse(props.textbookId, active ? "" : l.id)}>
                    {active ? "Đóng bộ đề" : "Xem / chọn câu"}
                  </Button>
                </div>
                {!count && <p className="mt-2 text-xs text-muted-foreground">Chưa có bài tập.</p>}
              </div>
            );
          })}
        </div>
      )}
      {!lessons.loading && !lessons.error && activeLesson && (
        <LessonQuestions key={activeLesson.id} {...props} lesson={activeLesson} />
      )}
    </div>
  );
}

function LessonQuestions({ lesson, ...props }: PickerProps & { lesson: TextbookLessonRow }) {
  const questions = useLoad(() => fetchQuestions({ lessonId: lesson.id }), [lesson.id]);
  const [type, setType] = useState<QuestionType | "">("");
  const rows = questions.data ?? [];
  const visible = rows.filter(q => !type || q.type === type);
  const picked = new Set(props.selected);
  const selectedInLesson = rows.filter(q => picked.has(q.id)).length;

  return (
    <div className="space-y-3 rounded-xl border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{lesson.unit != null ? `Bài ${lesson.unit}: ` : ""}{lesson.title}</h3>
        <span className="text-xs text-muted-foreground">Đã chọn {selectedInLesson}/{rows.length} câu</span>
      </div>
      <Select aria-label="Lọc dạng câu trong bộ đề" value={type} onChange={e => setType(e.target.value as QuestionType | "")}>
        <option value="">Mọi dạng câu</option>
        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
      </Select>
      {questions.loading ? <LoadingRows rows={4} className="p-0" /> : questions.error ? <ErrorNote message={questions.error} /> : visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Không có câu hỏi phù hợp trong bài này.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => props.onAdd(visible, lesson)}>
              <Plus className="h-3.5 w-3.5" /> {type ? `Chọn ${visible.length} câu đang lọc` : `Chọn cả bộ (${rows.length} câu)`}
            </Button>
            {selectedInLesson > 0 && <Button type="button" size="sm" variant="outline" onClick={() => props.onRemove(rows.map(q => q.id))}>Bỏ chọn bài này</Button>}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            <WorkbookQuestionList questions={visible} navigation={false} prefix="picker" renderQuestion={(q, i) => (
              <button key={q.id} type="button" aria-pressed={picked.has(q.id)} onClick={() => picked.has(q.id) ? props.onRemove([q.id]) : props.onAdd([q], lesson)}
                className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors", picked.has(q.id) ? "border-brand-500 bg-brand-50/50" : "hover:border-brand-300")}>
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", picked.has(q.id) && "border-brand-600 bg-brand-600 text-white")}>
                  {picked.has(q.id) && <Check className="h-3 w-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className="mb-1 text-[10px]">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  <span className="ml-2 text-xs text-muted-foreground">{sourceQuestionLabel(q, i)}</span>
                  <div className="zh break-words text-sm"><QuestionDialogue text={questionPreview(q) || "(chưa có đề bài)"} /></div>
                </div>
              </button>
            )} />
          </div>
        </>
      )}
      <Link href="/library/exercises" className="inline-block text-xs font-semibold text-brand-600 hover:underline">Mở thư viện bài tập →</Link>
    </div>
  );
}
