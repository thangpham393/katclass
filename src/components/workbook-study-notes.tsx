"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import type { QuestionRow } from "@/lib/db-content";
import { sortWorkbookQuestions } from "@/lib/question-order";
import { pinyinAllowed } from "@/lib/question-pinyin";
import { workbookIntro, workbookIntroRows } from "@/lib/workbook-intro";
import { QuestionPinyinContext, QuestionText } from "./question-visuals";

export function WorkbookStudyNotes({ questions, showPinyin = false }: { questions: QuestionRow[]; showPinyin?: boolean }) {
  const seen = new Set<string>();
  const notes = sortWorkbookQuestions(questions).flatMap(q => {
    const intro = workbookIntro(q);
    if (!intro || seen.has(intro.key)) return [];
    seen.add(intro.key);
    return [{ ...intro, q }];
  });
  if (!notes.length) return null;
  return <aside aria-label="Nhắc lại kiến thức" className="space-y-3">
    {notes.map(note => <details key={note.key} className="group rounded-2xl border border-brand-200 bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl bg-brand-50/50 p-4 [&::-webkit-details-marker]:hidden">
        <BookOpen className="h-5 w-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-brand-900">{note.title}</h2><p className="mt-1 text-xs text-muted-foreground">Ôn tập trước khi làm bài</p></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-700 transition-transform group-open:rotate-180" />
      </summary>
      <QuestionPinyinContext.Provider value={{ show: showPinyin && pinyinAllowed(note.q), dictionary: note.q.content.pinyin }}>
        <div className="space-y-5 p-4 text-sm leading-relaxed sm:p-5">
          {workbookIntroRows(note.body).map((block, i) => <div key={i} className="space-y-2">
            {block.map((row, j) => <div key={j} className={row.length > 1 ? "grid min-w-0 gap-2 rounded-lg bg-muted/30 p-3 md:grid-cols-2 md:gap-5" : "px-3"}>
              {row.map((cell, k) => <p key={k} className="min-w-0 whitespace-pre-wrap break-words"><QuestionText text={cell} /></p>)}
            </div>)}
          </div>)}
        </div>
      </QuestionPinyinContext.Provider>
    </details>)}
  </aside>;
}
