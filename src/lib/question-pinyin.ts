import vocabulary from "./yct-pinyin.json";
import type { QuestionContent, QuestionType } from "./question-schema";

const baseDictionary: Record<string, string> = vocabulary;
const baseWords = Object.keys(baseDictionary).sort((a, b) => b.length - a.length);

export function pinyinAllowed(q: { type: QuestionType; content: QuestionContent }): boolean {
  const c = q.content;
  if (c.pinyin_mode === "hidden" || q.type === "pinyin_choice" || q.type === "hanzi_pinyin" || c.require_pinyin) return false;
  if (q.type === "multi_matching" && c.columns?.some(column => /pinyin|phiên âm/i.test(column.label))) return false;
  if (q.type === "matching" && c.right?.every(text => !/[\u3400-\u9fff]/u.test(text)) && /pinyin|phiên âm/i.test(c.prompt ?? "")) return false;
  return true;
}

/** Longest reviewed word first; unknown characters remain unannotated. */
export function pinyinSegments(text: string, extra?: Record<string, string>): { text: string; pinyin?: string }[] {
  const dictionary = extra ? { ...baseDictionary, ...extra } : baseDictionary;
  const words = extra ? Object.keys(dictionary).sort((a, b) => b.length - a.length) : baseWords;
  const result: { text: string; pinyin?: string }[] = [];
  let position = 0;
  while (position < text.length) {
    const word = words.find(word => text.startsWith(word, position));
    if (word) {
      result.push({ text: word, pinyin: dictionary[word] });
      position += word.length;
    } else {
      const character = String.fromCodePoint(text.codePointAt(position)!);
      const last = result[result.length - 1];
      if (last && !last.pinyin) last.text += character;
      else result.push({ text: character });
      position += character.length;
    }
  }
  return result;
}
