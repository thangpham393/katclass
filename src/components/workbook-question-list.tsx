"use client";

import type { ReactNode } from "react";
import type { QuestionRow } from "@/lib/db-content";
import { workbookSections } from "@/lib/question-order";

export function WorkbookQuestionList({ questions, renderQuestion, prefix = "exercise" }: {
  questions: QuestionRow[];
  renderQuestion: (q: QuestionRow, index: number) => ReactNode;
  prefix?: string;
}) {
  const sections = workbookSections(questions);
  return <div className="space-y-6">
    {sections.map((section, i) => <section key={`${section.key}-${i}`} id={`${prefix}-section-${i}`} className="scroll-mt-24 space-y-3">
      <header className="rounded-xl border-l-4 border-brand-500 bg-brand-50/60 px-4 py-3">
        {section.lesson && <p className="mb-1 text-xs font-medium text-muted-foreground">{section.lesson}</p>}
        <h2 className="font-bold text-brand-800">{section.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{section.questions.length} câu</p>
      </header>
      {section.questions.map((q, j) => renderQuestion(q, section.start + j))}
    </section>)}
  </div>;
}
