"use client";

import type { ReactNode } from "react";
import { QuestionText } from "./question-visuals";
import { parseDialogue, type DialogueTurn } from "@/lib/question-dialogue";

export function QuestionDialogue({ text, renderTurn }: { text: string; renderTurn?: (turn: DialogueTurn, index: number) => ReactNode }) {
  const dialogue = parseDialogue(text);
  if (!dialogue) return <div className="whitespace-pre-wrap leading-loose"><QuestionText text={text} /></div>;
  const firstSpeaker = dialogue.turns[0].speaker;
  return <div className="space-y-4">
    {dialogue.instruction && <p className="whitespace-pre-wrap text-sm leading-relaxed"><QuestionText text={dialogue.instruction} /></p>}
    <div role="group" aria-label="Hội thoại" className="space-y-3 rounded-2xl bg-muted/30 p-3 sm:p-4">
      {dialogue.turns.map((turn, i) => {
        const alternate = turn.speaker !== firstSpeaker;
        return <div key={i} className={`flex items-start gap-2.5 ${alternate ? "flex-row-reverse" : ""}`}>
          <span className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-2 text-xs font-bold ${alternate ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800"}`} aria-label={`Người nói ${turn.speaker}`}>{turn.speaker}</span>
          <div className={`min-w-0 max-w-[calc(100%-3rem)] flex-1 rounded-2xl border px-3 py-2.5 leading-loose sm:px-4 ${alternate ? "rounded-tr-sm border-amber-200 bg-amber-50/50" : "rounded-tl-sm bg-card"}`}>
            {renderTurn ? renderTurn(turn, i) : <QuestionText text={turn.text || "…"} />}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
