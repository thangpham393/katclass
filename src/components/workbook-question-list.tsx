"use client";

import { Fragment, type ReactNode } from "react";
import type { QuestionAnswer, QuestionRow } from "@/lib/db-content";
import { workbookSections } from "@/lib/question-order";
import { questionWithoutWorkbookIntro } from "@/lib/workbook-intro";
import { WorkbookStudyNotes } from "./workbook-study-notes";
import { wordBankKey } from "@/lib/question-word-bank";
import { QuestionWordBank, WordBankProvider } from "./question-word-bank";

export function WorkbookQuestionList({ questions, renderQuestion, prefix = "exercise", introQuestions = questions, showPinyin = false, answers, interactive = false }: {
  questions: QuestionRow[];
  renderQuestion: (q: QuestionRow, index: number) => ReactNode;
  prefix?: string;
  introQuestions?: QuestionRow[];
  showPinyin?: boolean;
  answers?: Record<string, QuestionAnswer>;
  interactive?: boolean;
}) {
  const sections = workbookSections(questions.map(questionWithoutWorkbookIntro));
  const seenBanks = new Set<string>();
  return <WordBankProvider questions={questions} answers={answers} interactive={interactive}><div className="space-y-6">
    <WorkbookStudyNotes questions={introQuestions} showPinyin={showPinyin} />
    {sections.map((section, i) => <section key={`${section.key}-${i}`} id={`${prefix}-section-${i}`} className="scroll-mt-24 space-y-3">
      <header className="rounded-xl border-l-4 border-brand-500 bg-brand-50/60 px-4 py-3">
        {section.lesson && <p className="mb-1 text-xs font-medium text-muted-foreground">{section.lesson}</p>}
        <h2 className="font-bold text-brand-800">{section.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{section.questions.length} câu</p>
      </header>
      {section.questions.map((q, j) => {
        const bank = wordBankKey(q);
        const showBank = bank && !seenBanks.has(bank);
        if (bank) seenBanks.add(bank);
        return <Fragment key={q.id}>
          {showBank && <QuestionWordBank question={q} showPinyin={showPinyin} />}
          {renderQuestion(q, section.start + j)}
        </Fragment>;
      })}
    </section>)}
  </div></WordBankProvider>;
}
