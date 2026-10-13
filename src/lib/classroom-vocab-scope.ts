import type { LessonDetail, VocabRow } from "./db-content";

export type ScopeLesson = Pick<LessonDetail, "id" | "unit" | "textbook_id" | "course_id" | "textbook" | "course" | "vocab">;
export interface VocabScopePlan { field: "textbook_id" | "course_id"; id: string; throughUnit: number; name: string }

export function cumulativeVocabPlan(lessons: ScopeLesson[]): VocabScopePlan[] {
  if (!lessons.length) throw new Error("Gán bài học cho buổi để dùng từ vựng tổng hợp.");
  const groups = new Map<string, VocabScopePlan>();
  for (const lesson of lessons) {
    if (lesson.unit === null || lesson.unit < 1 || (!lesson.textbook_id && !lesson.course_id)) {
      throw new Error("Bài học cần có số bài và giáo trình hoặc khóa học để tổng hợp từ bài đầu tiên.");
    }
    const field = lesson.textbook_id ? "textbook_id" : "course_id";
    const id = lesson.textbook_id ?? lesson.course_id!;
    const key = `${field}:${id}`;
    const group = groups.get(key);
    groups.set(key, { field, id, throughUnit: Math.max(group?.throughUnit ?? 1, lesson.unit), name: lesson.textbook?.name ?? lesson.course?.name ?? "" });
  }
  return [...groups.values()];
}

export function cumulativeVocabLabel(lessons: ScopeLesson[]): string {
  const plans = cumulativeVocabPlan(lessons);
  return plans.map((plan) => `Bài 1–${plan.throughUnit}${plans.length > 1 && plan.name ? ` · ${plan.name}` : ""}`).join("; ");
}

export function currentVocabLabel(lessons: ScopeLesson[]): string {
  const units = [...new Set(lessons.map((lesson) => lesson.unit).filter((unit) => unit !== null))].sort((a, b) => a! - b!);
  return units.length ? `Bài ${units.join(", ")}` : "Bài hiện tại";
}

/** Imported lessons may link repeated words under different IDs. */
export function uniqueClassroomVocab(vocab: VocabRow[]): VocabRow[] {
  const seen = new Set<string>();
  return vocab.filter((word) => {
    const key = word.hanzi.normalize("NFC").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
