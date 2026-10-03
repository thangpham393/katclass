export type QuestionType =
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "reorder"
  | "listening"
  | "pinyin_choice"
  | "reading"
  | "translation"
  | "hanzi_pinyin"
  | "multi_matching";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  translation: "Dịch câu",
  hanzi_pinyin: "Viết chữ Hán và Pinyin",
  multi_matching: "Nối chữ Hán – Pinyin – nghĩa",
  reading: "Đọc hiểu",
  multiple_choice: "Trắc nghiệm",
  fill_blank: "Điền từ",
  matching: "Nối từ – nghĩa",
  reorder: "Sắp xếp câu",
  listening: "Nghe – chọn",
  pinyin_choice: "Chọn pinyin",
};

export const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];
export const MATCHING_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface ReadingItem {
  prompt: string;
  type: "multiple_choice" | "short_answer";
  options?: string[];
}

export interface QuestionContent {
  /** Các cột cần nối; khóa đáp án là row:column, giá trị là a, b, c… */
  columns?: { label: string; options: string[] }[];
  /** Sắp xếp câu có thêm ô viết Pinyin. Đáp án chứa hanzi, pinyin, order (JSON). */
  require_pinyin?: boolean;
  items?: ReadingItem[];
  prompt?: string;
  /** Đoạn văn / câu dẫn (đọc hiểu, chọn vị trí từ...) — hiển thị trong khung riêng, giữ xuống dòng. */
  passage?: string;
  hanzi?: string;
  tts?: string;
  audio_url?: string;
  options?: string[];
  hint?: string;
  tokens?: string[];
  translation?: string;
  left?: string[];
  right?: string[];
}

export type QuestionAnswer = string | string[] | Record<string, string>;

/** Translation answers are a list of accepted model sentences, never sent to students. */
export function questionAnswerPreview(q: { type: QuestionType; content: QuestionContent }, answer: QuestionAnswer | undefined): string {
  if (answer === undefined) return "—";
  if (typeof answer === "string") return answer;
  if (Array.isArray(answer)) return answer.join(q.type === "reorder" ? "" : q.type === "translation" ? " / " : ", ");
  if (q.type === "hanzi_pinyin" || (q.type === "reorder" && q.content.require_pinyin)) {
    return `${answer.hanzi ?? ""} · ${answer.pinyin ?? ""}`;
  }
  return Object.entries(answer).map(([key, value]) => {
    if (q.type === "multi_matching") {
      const [row, col] = key.split(":").map(Number);
      return `${row + 1} (${q.content.columns?.[col]?.label ?? col + 1})→${value.toUpperCase()}`;
    }
    return `${Number(key) + 1}→${value.toUpperCase()}`;
  }).join(", ");
}

export function questionIsAnswered(q: { type: QuestionType; content: QuestionContent }, answer: QuestionAnswer | undefined): boolean {
  if (answer === undefined) return false;
  const map = typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  if (q.type === "hanzi_pinyin" || (q.type === "reorder" && q.content.require_pinyin)) {
    return Boolean(map.hanzi?.trim() && map.pinyin?.trim()) &&
      (q.type !== "reorder" || readTokenOrder(map.order).length === q.content.tokens?.length);
  }
  if (q.type === "multi_matching") {
    return (q.content.left ?? []).every((_, row) => (q.content.columns ?? []).every((col, i) =>
      col.options.some((_, j) => map[`${row}:${i}`] === MATCHING_LETTERS[j]?.toLowerCase())));
  }
  if (q.type === "reading") return (q.content.items ?? []).every((_, i) => Boolean(map[String(i)]?.trim()));
  if (q.type === "fill_blank") return Array.isArray(answer) && answer.length > 0 && answer.every(s => Boolean(s.trim()));
  if (q.type === "reorder") return Array.isArray(answer) && answer.length === q.content.tokens?.length;
  if (q.type === "matching") return (q.content.left ?? []).every((_, i) =>
    (q.content.right ?? []).some((_, j) => map[String(i)] === MATCHING_LETTERS[j]?.toLowerCase()));
  return typeof answer === "string" && Boolean(answer.trim());
}

export function readTokenOrder(value: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) && parsed.every(v => typeof v === "string") ? parsed : [];
  } catch { return []; }
}

/** Shared by the editor/data layer and JSON imports, before any database writes. */
export function validateQuestionDefinition(q: { type: QuestionType; content: QuestionContent; answer: QuestionAnswer }): void {
  const { type, content: c, answer: a } = q;
  const fail = (message: string): never => { throw new Error(message); };
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(x => typeof x === "string" && Boolean(x.trim()));
  const map = typeof a === "object" && a !== null && !Array.isArray(a) ? a : {};
  const pair = () => { if (!map.hanzi?.trim() || !map.pinyin?.trim()) fail("Cần đủ đáp án chữ Hán và Pinyin."); };
  if (!c || !QUESTION_TYPE_LABELS[type]) fail("Dạng câu hỏi không hợp lệ.");
  if (type === "translation") {
    if (!c.prompt?.trim() || !strings(a)) fail("Cần câu cần dịch và danh sách bản dịch được chấp nhận.");
  } else if (type === "hanzi_pinyin") {
    if (!c.prompt?.trim()) fail("Cần đề bài chữ Hán và Pinyin.");
    pair();
  } else if (type === "reorder") {
    const expected = c.require_pinyin ? readTokenOrder(map.order) : a;
    if (!strings(c.tokens) || c.tokens.length < 2 || !strings(expected) ||
        [...c.tokens].sort().join("\u0000") !== [...expected].sort().join("\u0000")) fail("Các khối chữ không khớp đáp án sắp xếp.");
    if (c.require_pinyin) {
      pair();
      if ((expected as string[]).join("") !== map.hanzi) fail("Chữ Hán không khớp thứ tự các khối.");
    }
  } else if (type === "matching" || type === "multi_matching") {
    const columns = type === "matching" ? [{ options: c.right }] : c.columns;
    if (!strings(c.left) || c.left.length < 2 || c.left.length > 26 || !columns?.length ||
        (type === "multi_matching" && columns.length !== 2)) fail("Cần 2–26 mục nối và đủ các cột.");
    for (const [col, column] of columns!.entries()) {
      if (!strings(column.options) || column.options.length > 26) fail("Mỗi cột nối cần 1–26 lựa chọn.");
      for (let row = 0; row < c.left!.length; row++) {
        const value = map[type === "matching" ? String(row) : `${row}:${col}`];
        if (!column.options!.some((_, i) => value === MATCHING_LETTERS[i].toLowerCase())) fail("Đáp án nối không nằm trong các lựa chọn.");
      }
    }
    if (Object.keys(map).length !== c.left!.length * columns!.length) fail("Số đáp án nối không khớp đề bài.");
  } else if (type === "fill_blank") {
    if (!strings(a) || c.prompt?.split("___").length !== a.length + 1) fail("Số đáp án không khớp số ô trống.");
  } else if (type === "reading") {
    if (!c.passage?.trim() || !c.items?.length) fail("Cần bài đọc và câu hỏi con.");
    for (const [i, item] of c.items!.entries()) {
      if (!item.prompt.trim() || !map[String(i)]?.trim()) fail("Thiếu câu hỏi hoặc đáp án đọc hiểu.");
      if (item.type === "multiple_choice" && (!strings(item.options) || item.options.length < 2 || item.options.length > 6 || !item.options.some((_, j) => CHOICE_LETTERS[j] === map[String(i)]))) fail("Lựa chọn đọc hiểu không hợp lệ.");
    }
  } else {
    if (!strings(c.options) || c.options.length < 2 || c.options.length > 6 || typeof a !== "string" || !c.options.some((_, i) => a === CHOICE_LETTERS[i])) fail("Lựa chọn hoặc đáp án không hợp lệ.");
  }
}
