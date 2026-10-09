import { QUESTION_TYPE_LABELS, type QuestionContent, type QuestionType } from "./question-schema";

interface OrderedQuestion {
  id: string;
  type: QuestionType;
  content: QuestionContent;
  lesson_id?: string | null;
  lesson?: { unit: number | null; title: string; textbook_id: string | null } | null;
}

const typeOrder = Object.keys(QUESTION_TYPE_LABELS);
function lessonKey(q: OrderedQuestion) { return q.lesson_id ?? `unit:${q.content.source?.unit ?? ""}`; }
function fileKey(q: OrderedQuestion) { return q.content.source?.sha256 ?? q.content.source?.file ?? ""; }
function sectionKey(q: OrderedQuestion) {
  return `${lessonKey(q)}:${fileKey(q)}:${q.content.source?.section ?? q.type}`;
}

/** Source order, independent of insertion time or random UUID. Stable within legacy types. */
export function sortWorkbookQuestions<T extends OrderedQuestion>(questions: readonly T[]): T[] {
  const lessons = new Map<string, T[]>();
  for (const q of questions) {
    const key = lessonKey(q);
    if (!lessons.has(key)) lessons.set(key, []);
    lessons.get(key)!.push(q);
  }
  const textbooks = new Map<string, T[][]>();
  for (const pack of lessons.values()) {
    const key = pack[0].lesson?.textbook_id ?? "";
    if (!textbooks.has(key)) textbooks.set(key, []);
    textbooks.get(key)!.push(pack);
  }
  const packs = [...textbooks.values()].flatMap(packs => packs.sort((a, b) =>
    (a[0].lesson?.unit ?? a[0].content.source?.unit ?? 0) - (b[0].lesson?.unit ?? b[0].content.source?.unit ?? 0)));
  return packs.flatMap(pack => {
    const files = new Map<string, T[]>();
    for (const q of pack) {
      const key = fileKey(q);
      if (!files.has(key)) files.set(key, []);
      files.get(key)!.push(q);
    }
    return [...files.values()].flatMap(file => file.slice().sort((a, b) => {
      const sa = a.content.source, sb = b.content.source;
      const section = (sa?.section ?? typeOrder.indexOf(a.type)) - (sb?.section ?? typeOrder.indexOf(b.type));
      if (section) return section;
      return Math.min(...(sa?.numbers?.length ? sa.numbers : [0])) - Math.min(...(sb?.numbers?.length ? sb.numbers : [0]));
    }));
  });
}

/** Contiguous groups also preserve the explicit order of timed test templates. */
export function workbookSections<T extends OrderedQuestion>(questions: readonly T[]) {
  const sections: { key: string; title: string; lesson: string; questions: T[]; start: number }[] = [];
  questions.forEach((q, i) => {
    const key = sectionKey(q);
    const previous = sections[sections.length - 1];
    if (previous?.key === key) { previous.questions.push(q); return; }
    const source = q.content.source;
    const types = [...new Set(questions.filter(x => sectionKey(x) === key).map(x => QUESTION_TYPE_LABELS[x.type]))];
    sections.push({ key, start: i, questions: [q],
      title: source?.section_title || (source?.section != null ? `Phần ${source.section} · ${types.join(" / ")}` : QUESTION_TYPE_LABELS[q.type]),
      lesson: q.lesson ? `${q.lesson.unit != null ? `Bài ${q.lesson.unit} · ` : ""}${q.lesson.title}` : source?.unit != null ? `Bài ${source.unit}` : "",
    });
  });
  return sections;
}

export function sourceQuestionLabel(q: OrderedQuestion, index: number): string {
  return q.content.source?.numbers?.length ? `Câu ${q.content.source.numbers.join(", ")} trong đề` : `Câu ${index + 1}`;
}
