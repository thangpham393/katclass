import type { QuestionContent, QuestionType } from "./question-schema";

interface BankQuestion {
  id: string;
  type: QuestionType;
  content: QuestionContent;
  lesson_id?: string | null;
}

/** Read source-provided banks only. Never derive choices from private answers. */
export function questionWordBank(q: Pick<BankQuestion, "type" | "content">) {
  if (q.type !== "fill_blank") return null;
  if (q.content.word_bank?.words.length) {
    return { ...q.content.word_bank, reuse: q.content.word_bank.reuse ?? true, remainingHint: q.content.hint ?? "" };
  }
  const hint = q.content.hint ?? "";
  const lines = hint.split(/\r?\n/);
  let bankIndex = lines.findIndex(line => /^\s*(?:Từ cho sẵn|Chọn từ phù hợp)\s*[:：]/iu.test(line));
  let list = bankIndex < 0 ? "" : lines[bankIndex].replace(/^\s*(?:Từ cho sẵn|Chọn từ phù hợp)\s*[:：]\s*/iu, "");
  if (bankIndex < 0 && /(?:chọn từ.*khung|选词填空)/iu.test(hint)) {
    bankIndex = lines.findIndex(line => /^[\p{Script=Han}\s·、,，|\[\]【】]+$/u.test(line) && /[·、,，|]/u.test(line));
    if (bankIndex >= 0) list = lines[bankIndex];
  }
  // HSK 1 imports preserve the bank as a bare, delimited Hanzi list.
  if (bankIndex < 0 && /^[\p{Script=Han}\s·、,，|]+$/u.test(hint.trim()) && /[·、,，|]/u.test(hint)) {
    bankIndex = 0;
    list = hint;
  }
  // Grammar exercises explicitly offer alternatives in their instruction.
  // Match the choice list after "chọn/điền", not grammar examples in the title.
  if (bankIndex < 0) {
    const choices = hint.match(/(?:chọn|điền)\s+((?:[A-Z]\.\s*)?[\p{Script=Han}]+(?:\s*(?:\/|hoặc|hay)\s*(?:[A-Z]\.\s*)?[\p{Script=Han}]+)+)/iu);
    if (choices) return {
      words: choices[1].replace(/[A-Z]\.\s*/g, "").split(/\s*(?:\/|hoặc|hay)\s*/iu),
      instruction: hint, reuse: !/mỗi từ[^\n]*một lần|每[个個]?词[^\n]*一次/iu.test(hint), remainingHint: "",
    };
  }
  if (bankIndex < 0) return null;
  const words = list.replace(/[\[\]【】]/g, "").trim().split(/[\s·、,，|]+/u).filter(Boolean);
  if (words.length < 2 || !words.every(word => /^[\p{Script=Han}]+$/u.test(word))) return null;
  const instruction = lines.filter((_, i) => i !== bankIndex).join("\n").trim();
  return { words, instruction, reuse: !/mỗi từ[^\n]*một lần|每[个個]?词[^\n]*一次/iu.test(hint), remainingHint: "" };
}

export function wordBankKey(q: BankQuestion): string | null {
  const bank = questionWordBank(q);
  if (!bank) return null;
  const source = q.content.source;
  // Shared banks stay within their original lesson and source exercise, even in mixed assignments.
  const scope = `${q.lesson_id ?? ""}|${source?.sha256 ?? source?.file ?? q.id}|${source?.unit ?? ""}|${bank.group ?? source?.section ?? ""}`;
  return `${scope}|${JSON.stringify([bank.words, bank.instruction ?? "", bank.reuse])}`;
}
