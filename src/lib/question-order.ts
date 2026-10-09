import { QUESTION_TYPE_LABELS, type QuestionContent, type QuestionType } from "./question-schema";

interface OrderedQuestion {
  id: string;
  type: QuestionType;
  content: QuestionContent;
  lesson_id?: string | null;
  lesson?: { unit: number | null; title: string; textbook_id: string | null } | null;
}

const typeOrder: QuestionType[] = [
  "multiple_choice", "pinyin_choice", "listening", "fill_blank", "matching", "multi_matching",
  "reorder", "hanzi_pinyin", "translation", "sentence_correction", "reading", "essay",
];
const collator = new Intl.Collator("vi", { numeric: true });
function lessonKey(q: OrderedQuestion) { return q.lesson_id ?? `unit:${q.content.source?.unit ?? ""}`; }
function fileKey(q: OrderedQuestion) { return q.content.source?.file ?? q.content.source?.sha256 ?? ""; }
function firstNumber(q: OrderedQuestion) {
  const numbers = q.content.source?.numbers?.filter(n => typeof n === "number" && Number.isFinite(n)) ?? [];
  return numbers.length ? Math.min(...numbers) : 0;
}

/** Keep every exercise type together; source metadata only orders questions inside that type. */
export function sortWorkbookQuestions<T extends OrderedQuestion>(questions: readonly T[]): T[] {
  return questions.slice().sort((a, b) => {
    const type = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    if (type) return type;
    const textbook = collator.compare(a.lesson?.textbook_id ?? "", b.lesson?.textbook_id ?? "");
    if (textbook) return textbook;
    const unit = (a.lesson?.unit ?? a.content.source?.unit ?? 0) - (b.lesson?.unit ?? b.content.source?.unit ?? 0);
    if (unit) return unit;
    const lesson = collator.compare(lessonKey(a), lessonKey(b));
    if (lesson) return lesson;
    const file = collator.compare(fileKey(a), fileKey(b));
    if (file) return file;
    const section = collator.compare(String(a.content.source?.section ?? ""), String(b.content.source?.section ?? ""));
    return section || firstNumber(a) - firstNumber(b);
  });
}

/** A single visible section per type, even when metadata describes many source PDFs/sections. */
export function workbookSections<T extends OrderedQuestion>(questions: readonly T[]) {
  const sections: { key: string; title: string; lesson: string; questions: T[]; start: number }[] = [];
  for (const q of sortWorkbookQuestions(questions)) {
    const previous = sections[sections.length - 1];
    if (previous?.key === q.type) { previous.questions.push(q); continue; }
    sections.push({ key: q.type, title: QUESTION_TYPE_LABELS[q.type], lesson: "", questions: [q], start: 0 });
  }
  let start = 0;
  for (const section of sections) {
    section.start = start;
    start += section.questions.length;
    const lessonIds = new Set(section.questions.map(lessonKey));
    if (lessonIds.size === 1) {
      const q = section.questions[0];
      section.lesson = q.lesson ? `${q.lesson.unit != null ? `Bài ${q.lesson.unit} · ` : ""}${q.lesson.title}`
        : q.content.source?.unit != null ? `Bài ${q.content.source.unit}` : "";
    }
  }
  return sections;
}

export function sourceQuestionLabel(q: OrderedQuestion, index: number): string {
  return q.content.source?.numbers?.length ? `Câu ${q.content.source.numbers.join(", ")} trong đề` : `Câu ${index + 1}`;
}
