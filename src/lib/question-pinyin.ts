import vocabulary from "./yct-pinyin.json";
import hskVocabulary from "./hsk-pinyin.json";
import type { QuestionContent, QuestionType } from "./question-schema";

const baseDictionary: Record<string, string> = { ...hskVocabulary, ...vocabulary };
const baseWords = Object.keys(baseDictionary).sort((a, b) => b.length - a.length);

const initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w", ""];
const finals = ["iang", "iong", "uang", "ueng", "ang", "eng", "ing", "ong", "iao", "ian", "uan", "uai", "uei", "uen", "ai", "ei", "ao", "ou", "an", "en", "ia", "ie", "iu", "in", "ua", "uo", "ui", "un", "üe", "üan", "ün", "er", "a", "o", "e", "i", "u", "ü"];
const syllables = new Set(initials.flatMap(initial => finals.map(final => initial + final)));
syllables.add("ng"); syllables.add("m"); syllables.add("n");

/** Split joined textbook Pinyin only when the Hanzi count gives a complete alignment. */
export function alignPinyin(pinyin: string, count: number): string[] | null {
  const text = pinyin.normalize("NFC").trim().replace(/u:/gi, "ü").replace(/v/gi, "ü");
  const tokens = text.match(/[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜêńňǹ]+[1-5]?/giu) ?? [];
  const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/\u0308/g, "#").replace(/[\u0300-\u036f1-5]/g, "").replace(/u#/g, "ü");
  const failed = new Set<string>();
  function split(tokenIndex: number, position: number, remaining: number): string[] | null {
    if (tokenIndex === tokens.length) return remaining === 0 ? [] : null;
    const token = tokens[tokenIndex];
    if (position === token.length) return split(tokenIndex + 1, 0, remaining);
    if (remaining <= 0) return null;
    const key = `${tokenIndex}:${position}:${remaining}`;
    if (failed.has(key)) return null;
    for (let end = Math.min(token.length, position + 7); end > position; end--) {
      const candidate = token.slice(position, end);
      if (!syllables.has(clean(candidate))) continue;
      const rest = split(tokenIndex, end, remaining - 1);
      if (rest) return [candidate, ...rest];
    }
    failed.add(key);
    return null;
  }
  return split(0, 0, count);
}

/** Convert old "汉字 hànzì" inline strings into a source-provided pronunciation. */
function embeddedPinyin(text: string): { text: string; parts: { text: string; pinyin?: string }[] } | null {
  const match = text.match(/^([\s\S]*[\u3400-\u9fff][^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*?)\s+([a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s_'’1-5.,!?，。！？]+)$/iu);
  if (!match) return null;
  const hanzi = [...match[1]].filter(c => /[\u3400-\u9fff]/u.test(c));
  const aligned = alignPinyin(match[2], hanzi.length);
  if (!aligned) return null;
  let index = 0;
  return { text: match[1], parts: [...match[1]].map(c => /[\u3400-\u9fff]/u.test(c) ? { text: c, pinyin: aligned[index++] } : { text: c }) };
}

export function textWithoutEmbeddedPinyin(text: string): string { return embeddedPinyin(text)?.text ?? text; }

export function pinyinAllowed(q: { type: QuestionType; content: QuestionContent; level?: string | null; tags?: readonly string[] }): boolean {
  // Level is authoritative; tags cover old test snapshots that lost their lesson link.
  const level = q.level?.match(/^HSK[\s_-]*([0-9]+)/i) ?? q.tags?.map(tag => tag.match(/^HSK[\s_-]*([0-9]+)/i)).find(Boolean);
  if (level && Number(level[1]) >= 3) return false;
  const c = q.content;
  if (c.pinyin_mode === "hidden" || q.type === "pinyin_choice" || q.type === "hanzi_pinyin" || c.require_pinyin) return false;
  if (q.type === "multi_matching" && c.columns?.some(column => /pinyin|phiên âm/i.test(column.label))) return false;
  if (q.type === "matching" && c.right?.every(text => !/[\u3400-\u9fff]/u.test(text)) && /pinyin|phiên âm/i.test(c.prompt ?? "")) return false;
  return true;
}

/** Longest reviewed word first; unknown characters remain unannotated. */
export function pinyinSegments(text: string, extra?: Record<string, string>): { text: string; pinyin?: string }[] {
  const embedded = embeddedPinyin(text);
  if (embedded) return embedded.parts;
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
