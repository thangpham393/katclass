"use client";

import { createContext, useContext, useMemo, useState, type ReactNode, type DragEvent } from "react";
import { Hand } from "lucide-react";
import type { QuestionRow, QuestionAnswer } from "@/lib/db-content";
import { questionWordBank, wordBankKey } from "@/lib/question-word-bank";
import { pinyinAllowed } from "@/lib/question-pinyin";
import { QuestionPinyinContext, QuestionText } from "./question-visuals";

const dragType = "application/x-classhub-word";
interface BankContext {
  questions: QuestionRow[];
  answers: Record<string, QuestionAnswer>;
  interactive: boolean;
  selected: { key: string; word: string } | null;
  select: (value: { key: string; word: string } | null) => void;
}
export const WordBankContext = createContext<BankContext | null>(null);

export function WordBankProvider({ questions, answers = {}, interactive = false, children }: {
  questions: QuestionRow[]; answers?: Record<string, QuestionAnswer>; interactive?: boolean; children: ReactNode;
}) {
  const [selected, select] = useState<BankContext["selected"]>(null);
  const value = useMemo(() => ({ questions, answers, interactive, selected, select }), [questions, answers, interactive, selected]);
  return <WordBankContext.Provider value={value}>{children}</WordBankContext.Provider>;
}

export function useQuestionWordBank(q: QuestionRow) {
  const context = useContext(WordBankContext);
  const bank = questionWordBank(q);
  const key = wordBankKey(q);
  function available(word: string, current?: string) {
    if (!bank || !context?.interactive || !bank.words.includes(word)) return false;
    if (bank.reuse || current === word) return true;
    const uses = context.questions.filter(row => wordBankKey(row) === key).flatMap(row => {
      const value = context.answers[row.id];
      return Array.isArray(value) ? value : [];
    }).filter(value => value.trim().normalize("NFKC") === word.normalize("NFKC")).length;
    return uses < bank.words.filter(value => value === word).length;
  }
  function choose(current: string) {
    const selected = context?.selected;
    if (!selected || selected.key !== key || !available(selected.word, current)) return null;
    context.select(null);
    return selected.word;
  }
  function drop(event: DragEvent<HTMLInputElement>, current: string) {
    if (event.currentTarget.disabled || !context?.interactive) return null;
    try {
      const value: unknown = JSON.parse(event.dataTransfer.getData(dragType));
      if (!value || typeof value !== "object" || !("key" in value) || !("word" in value) ||
        value.key !== key || typeof value.word !== "string" || !available(value.word, current)) return null;
      event.preventDefault();
      context.select(null);
      return value.word;
    } catch { return null; }
  }
  return { bank, key, context, available, choose, drop, dragType };
}

export function QuestionWordBank({ question, showPinyin = false }: { question: QuestionRow; showPinyin?: boolean }) {
  const { bank, key, context, available } = useQuestionWordBank(question);
  if (!bank || !key) return null;
  return <div role="group" aria-label="Từ cho sẵn" className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
    <div className="flex items-center gap-2"><Hand className="h-4 w-4 text-brand-700" /><h3 className="text-sm font-bold text-brand-900">Từ cho sẵn</h3></div>
    {bank.instruction && <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{bank.instruction}</p>}
    {context?.interactive && <p className="text-xs text-muted-foreground">Kéo từ vào ô trống, hoặc chọn từ rồi chạm ô cần điền. Có thể xóa hoặc thay từ đã điền.</p>}
    <QuestionPinyinContext.Provider value={{ show: showPinyin && pinyinAllowed(question), dictionary: question.content.pinyin }}>
      <div className="flex flex-wrap gap-2">{bank.words.map((word, i) => {
        const selected = context?.selected?.key === key && context.selected.word === word;
        const used = !bank.reuse && !available(word) && context?.interactive;
        return <button key={`${word}-${i}`} type="button" aria-label={`Chọn từ ${word}`} aria-pressed={Boolean(selected)}
          disabled={!context?.interactive || Boolean(used)} draggable={context?.interactive && !used}
          onClick={() => context?.select(selected ? null : { key, word })}
          onDragStart={event => { event.dataTransfer.setData(dragType, JSON.stringify({ key, word })); event.dataTransfer.effectAllowed = "copy"; }}
          className={`zh rounded-xl border px-3 py-2 text-lg transition-colors ${selected ? "border-brand-600 bg-brand-600 text-white" : used ? "border-transparent bg-muted text-muted-foreground line-through" : "border-brand-200 bg-card text-foreground"} disabled:cursor-default enabled:cursor-grab enabled:hover:border-brand-500`}>
          <QuestionText text={word} />
        </button>;
      })}</div>
    </QuestionPinyinContext.Provider>
  </div>;
}
