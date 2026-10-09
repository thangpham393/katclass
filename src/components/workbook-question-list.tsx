"use client";

import type { ReactNode } from "react";
import type { QuestionRow } from "@/lib/db-content";
import { workbookSections } from "@/lib/question-order";

export function WorkbookQuestionList({ questions, renderQuestion, prefix = "exercise", navigation = true }: {
  questions: QuestionRow[];
  renderQuestion: (q: QuestionRow, index: number) => ReactNode;
  prefix?: string;
  navigation?: boolean;
}) {
  const sections = workbookSections(questions);
  return <div className="space-y-6">
    {navigation && sections.length > 1 && <nav aria-label="Các phần trong bài tập" className="rounded-2xl border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">Các phần trong bài</p>
      <div className="flex flex-wrap gap-2">{sections.map((section, i) => <a key={`${section.key}-${i}`} href={`#${prefix}-section-${i}`}
        className="rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:border-brand-400 hover:bg-brand-50">{section.title} <span className="text-muted-foreground">({section.questions.length})</span></a>)}</div>
    </nav>}
    {sections.map((section, i) => <section key={`${section.key}-${i}`} id={`${prefix}-section-${i}`} className="scroll-mt-24 space-y-3">
      <header className="rounded-xl border-l-4 border-brand-500 bg-brand-50/60 px-4 py-3">
        {section.lesson && <p className="mb-1 text-xs font-medium text-muted-foreground">{section.lesson}</p>}
        <h2 className="font-bold text-brand-800">{section.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{section.questions.length} câu / nhóm câu</p>
      </header>
      {section.questions.map((q, j) => renderQuestion(q, section.start + j))}
    </section>)}
  </div>;
}
