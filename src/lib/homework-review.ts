import type { QuestionAnswer, QuestionContent, QuestionType } from "./question-schema";

export interface ReviewPart {
  key: string;
  label: string;
  expected: QuestionAnswer | null;
  actual: QuestionAnswer | null;
  correct: boolean | null;
  reason: string;
}
export interface QuestionReview {
  question_id: string;
  type: QuestionType;
  content: QuestionContent;
  actual?: QuestionAnswer;
  total: number;
  correct: number;
  parts: ReviewPart[];
  explanation?: string | null;
}
export interface HomeworkReview { legacy: boolean; questions: QuestionReview[] }

export function reviewStatus(review: QuestionReview) {
  if (!review.total) return "manual";
  if (review.correct === review.total) return "correct";
  const empty = review.parts.every(p => p.actual == null || (typeof p.actual === "string" && !p.actual.trim()) ||
    (Array.isArray(p.actual) && p.actual.length === 0) ||
    (typeof p.actual === "object" && Object.keys(p.actual).length === 0));
  if (empty) return "skipped";
  return review.correct > 0 || review.parts.some(p => p.correct === true) ? "partial" : "incorrect";
}

/** Resolve letters and map keys into readable answers, including each reading/matching part. */
export function reviewAnswerText(review: QuestionReview, part: ReviewPart, value: QuestionAnswer | null): string {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return "Chưa trả lời";
  const c = review.content;
  if (typeof value === "string") {
    let options: string[] | undefined;
    if (["multiple_choice", "pinyin_choice", "listening"].includes(review.type)) options = c.options;
    if (review.type === "matching") options = c.right;
    if (review.type === "multi_matching") options = c.columns?.[Number(part.key.split(":")[1])]?.options;
    if (review.type === "reading" && c.items?.[Number(part.key)]?.type === "multiple_choice") options = c.items[Number(part.key)].options;
    if (options) {
      const index = value.toUpperCase().charCodeAt(0) - 65;
      return `${value.toUpperCase()}. ${options[index] ?? "Lựa chọn không hợp lệ"}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.join(review.type === "reorder" ? "" : " / ");
  return Object.values(value).join(" · ");
}
