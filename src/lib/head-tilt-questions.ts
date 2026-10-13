import type { VocabRow } from "./db-content";

export type TiltQuestionKind = "vi_zh" | "zh_vi" | "true_false";
export interface TiltOption {
  text: string;
  pinyin?: string;
  reveal: string;
}
export interface TiltQuestion {
  kind: TiltQuestionKind;
  word: VocabRow;
  statementMeaning?: string;
  options: [TiltOption, TiltOption];
  correctIndex: 0 | 1;
  explanation: string;
}

export const TILT_QUESTION_LABELS: Record<TiltQuestionKind, string> = {
  vi_zh: "VIỆT → TRUNG",
  zh_vi: "TRUNG → VIỆT",
  true_false: "ĐÚNG HAY SAI?",
};

function normalizeMeaning(meaning: string) {
  return meaning.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

/** Three formats per vocabulary word; never use an identical meaning as a wrong answer. */
export function makeTiltQuestions(vocab: VocabRow[], random = Math.random): TiltQuestion[] {
  const words = Array.from(new Map(vocab
    .filter((word) => word.hanzi.trim() && word.meaning.trim())
    .map((word) => [word.hanzi.trim(), { ...word, hanzi: word.hanzi.trim(), meaning: word.meaning.trim() }])).values());
  const rounds: TiltQuestion[] = [];
  const firstStatementTrue = random() < .5;
  words.forEach((word, index) => {
    const others = words.filter((other) => normalizeMeaning(other.meaning) !== normalizeMeaning(word.meaning));
    if (!others.length) return;
    const other = others[Math.floor(random() * others.length)];
    const explanation = `${word.hanzi} · ${word.pinyin} · ${word.meaning}`;
    for (const kind of ["vi_zh", "zh_vi"] as const) {
      const option = (entry: VocabRow): TiltOption => kind === "vi_zh"
        ? { text: entry.hanzi, pinyin: entry.pinyin, reveal: entry.meaning }
        : { text: entry.meaning, reveal: `${entry.hanzi} · ${entry.pinyin}` };
      const correctIndex = random() < .5 ? 0 : 1;
      const correct = option(word), wrong = option(other);
      rounds.push({ kind, word, explanation, correctIndex, options: correctIndex === 0 ? [correct, wrong] : [wrong, correct] });
    }
    const statementTrue = index % 2 === 0 ? firstStatementTrue : !firstStatementTrue;
    rounds.push({
      kind: "true_false", word, explanation,
      statementMeaning: statementTrue ? word.meaning : other.meaning,
      correctIndex: statementTrue ? 0 : 1,
      options: [{ text: "Đúng", reveal: "Ghép nghĩa chính xác" }, { text: "Sai", reveal: "Ghép nghĩa chưa đúng" }],
    });
  });
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rounds[i], rounds[j]] = [rounds[j], rounds[i]];
  }
  return rounds;
}
