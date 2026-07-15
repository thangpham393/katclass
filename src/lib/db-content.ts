"use client";

/**
 * Data layer cho NỘI DUNG HỌC TẬP (schema 0003_content.sql):
 * từ vựng, bài học, nội dung ôn tập theo buổi, ngân hàng câu hỏi,
 * bài tập về nhà tự chấm.
 *
 * Quy ước jsonb (khớp RPC submit_homework — so sánh bằng jsonb equality):
 * - multiple_choice / pinyin_choice / listening:
 *     content = { prompt?, hanzi?, tts?, audio_url?, options: string[] }
 *     answer  = chữ cái đáp án đúng, vd "B"
 * - fill_blank:
 *     content = { prompt: "câu có ___ (mỗi ___ một ô trống)", hint? }
 *     answer  = mảng đáp án theo thứ tự chỗ trống, vd ["了","的"]
 * - reorder:
 *     content = { tokens: string[], translation? }
 *     answer  = mảng token theo thứ tự đúng
 * - matching:
 *     content = { left: string[], right: string[] }
 *     answer  = { "<chỉ số trái>": "<chữ cái phải>", vd {"0":"b","1":"a"} }
 */

import { getSupabase } from "./supabase";
import type { CourseRow } from "./db";

/* ============ Từ vựng ============ */

export interface VocabExample {
  zh: string;
  pinyin?: string;
  vi: string;
}

export interface VocabRow {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  example: VocabExample | null;
  audio_url: string | null;
  level: string | null;
  tags: string[];
  created_at: string;
}

export interface VocabInput {
  hanzi: string;
  pinyin: string;
  meaning: string;
  level?: string | null;
  example?: VocabExample | null;
  audio_url?: string | null;
}

export async function fetchVocabItems(search?: string): Promise<VocabRow[]> {
  let query = getSupabase().from("vocab_items").select("*").order("created_at", { ascending: false }).limit(500);
  if (search?.trim()) {
    const s = search.trim().replace(/[,%]/g, "");
    query = query.or(`hanzi.ilike.%${s}%,pinyin.ilike.%${s}%,meaning.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as VocabRow[];
}

export async function createVocabItem(input: VocabInput, createdBy: string): Promise<VocabRow> {
  const { data, error } = await getSupabase()
    .from("vocab_items")
    .insert({ ...input, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as VocabRow;
}

export async function updateVocabItem(id: string, input: Partial<VocabInput>) {
  const { error } = await getSupabase().from("vocab_items").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteVocabItem(id: string) {
  const { error } = await getSupabase().from("vocab_items").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Bài học ============ */

export interface LessonRow {
  id: string;
  course_id: string | null;
  textbook_id: string | null;
  unit: number | null;
  title: string;
  title_zh: string | null;
  summary: string | null;
  grammar: string | null;
  slide_embed_url: string | null;
  sort: number;
  created_at: string;
  course: Pick<CourseRow, "id" | "name" | "level"> | null;
  textbook: { id: string; name: string; level: string | null } | null;
  lesson_vocab: { count: number }[];
}

/** Nhãn nguồn của bài học: giáo trình thư viện hoặc khóa học. */
export function lessonSourceLabel(
  l: Pick<LessonRow, "course" | "textbook">,
): string | null {
  return l.textbook?.name ?? l.course?.name ?? null;
}

export interface LessonDetail extends Omit<LessonRow, "lesson_vocab"> {
  vocab: VocabRow[];
}

export interface LessonInput {
  course_id: string | null;
  unit: number | null;
  title: string;
  title_zh?: string | null;
  summary?: string | null;
  grammar?: string | null;
  slide_embed_url?: string | null;
}

const LESSON_SELECT = `
  id, course_id, textbook_id, unit, title, title_zh, summary, grammar, slide_embed_url, sort, created_at,
  course:courses ( id, name, level ),
  textbook:textbooks ( id, name, level ),
  lesson_vocab ( count )
`;

export async function fetchLessons(courseId?: string): Promise<LessonRow[]> {
  let query = getSupabase().from("lessons").select(LESSON_SELECT)
    .order("course_id").order("unit").order("sort").order("created_at");
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as LessonRow[];
}

export async function fetchLesson(id: string): Promise<LessonDetail | null> {
  const { data, error } = await getSupabase()
    .from("lessons")
    .select(`
      id, course_id, textbook_id, unit, title, title_zh, summary, grammar, slide_embed_url, sort, created_at,
      course:courses ( id, name, level ),
      textbook:textbooks ( id, name, level ),
      lesson_vocab ( sort, vocab:vocab_items ( * ) )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { lesson_vocab, ...rest } = data as unknown as LessonDetail & {
    lesson_vocab: { sort: number; vocab: VocabRow }[];
  };
  const vocab = (lesson_vocab ?? [])
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((lv) => lv.vocab)
    .filter(Boolean);
  return { ...rest, vocab };
}

export async function createLesson(input: LessonInput, createdBy: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from("lessons")
    .insert({ ...input, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateLesson(id: string, input: Partial<LessonInput>) {
  const { error } = await getSupabase().from("lessons").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string) {
  const { error } = await getSupabase().from("lessons").delete().eq("id", id);
  if (error) throw error;
}

/** Thay toàn bộ danh sách từ vựng của bài học (giữ thứ tự đã chọn). */
export async function setLessonVocab(lessonId: string, vocabIds: string[]) {
  const supabase = getSupabase();
  const { error: delErr } = await supabase.from("lesson_vocab").delete().eq("lesson_id", lessonId);
  if (delErr) throw delErr;
  if (vocabIds.length) {
    const { error } = await supabase
      .from("lesson_vocab")
      .insert(vocabIds.map((vocab_id, i) => ({ lesson_id: lessonId, vocab_id, sort: i })));
    if (error) throw error;
  }
}

/* ============ Nội dung ôn tập gán cho buổi học ============ */

export interface SessionLessonRow {
  session_id: string;
  lesson: {
    id: string;
    unit: number | null;
    title: string;
    title_zh: string | null;
    course: { name: string; level: string | null } | null;
    textbook: { name: string; level: string | null } | null;
    lesson_vocab: { count: number }[];
  };
}

const SESSION_LESSON_SELECT = `
  session_id,
  lesson:lessons (
    id, unit, title, title_zh,
    course:courses ( name, level ),
    textbook:textbooks ( name, level ),
    lesson_vocab ( count )
  )
`;

export async function fetchSessionLessons(sessionId: string): Promise<SessionLessonRow[]> {
  const { data, error } = await getSupabase()
    .from("session_lessons").select(SESSION_LESSON_SELECT)
    .eq("session_id", sessionId);
  if (error) throw error;
  return data as unknown as SessionLessonRow[];
}

/** Nội dung ôn tập của nhiều buổi cùng lúc (trang chi tiết lớp). */
export async function fetchSessionLessonsBySessions(sessionIds: string[]): Promise<SessionLessonRow[]> {
  if (!sessionIds.length) return [];
  const { data, error } = await getSupabase()
    .from("session_lessons").select(SESSION_LESSON_SELECT)
    .in("session_id", sessionIds);
  if (error) throw error;
  return data as unknown as SessionLessonRow[];
}

/** Thay toàn bộ nội dung ôn tập của buổi. */
export async function setSessionLessons(sessionId: string, lessonIds: string[]) {
  const supabase = getSupabase();
  const { error: delErr } = await supabase.from("session_lessons").delete().eq("session_id", sessionId);
  if (delErr) throw delErr;
  if (lessonIds.length) {
    const { error } = await supabase
      .from("session_lessons")
      .insert(lessonIds.map((lesson_id) => ({ session_id: sessionId, lesson_id })));
    if (error) throw error;
  }
}

/* ============ Ngân hàng câu hỏi ============ */

export type QuestionType =
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "reorder"
  | "listening"
  | "pinyin_choice";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Trắc nghiệm",
  fill_blank: "Điền từ",
  matching: "Nối từ – nghĩa",
  reorder: "Sắp xếp câu",
  listening: "Nghe – chọn",
  pinyin_choice: "Chọn pinyin",
};

export const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

export interface QuestionContent {
  prompt?: string;
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

export interface QuestionRow {
  id: string;
  type: QuestionType;
  content: QuestionContent;
  level: string | null;
  tags: string[];
  lesson_id: string | null;
  created_at: string;
  lesson: { id: string; title: string; unit: number | null; textbook_id: string | null } | null;
}

/** Tóm tắt đề bài để hiển thị trong danh sách (không lộ đáp án). */
export function questionPreview(q: Pick<QuestionRow, "type" | "content">): string {
  const c = q.content;
  switch (q.type) {
    case "multiple_choice":
    case "listening":
      return c.prompt ?? c.hanzi ?? c.tts ?? "";
    case "pinyin_choice":
      return c.hanzi ?? "";
    case "fill_blank":
      return c.prompt ?? "";
    case "reorder":
      return (c.tokens ?? []).join(" / ");
    case "matching":
      return (c.left ?? []).join(", ");
  }
}

const QUESTION_SELECT = `
  id, type, content, level, tags, lesson_id, created_at,
  lesson:lessons ( id, title, unit, textbook_id )
`;

export async function fetchQuestions(filter?: {
  type?: QuestionType | "";
  lessonId?: string;
}): Promise<QuestionRow[]> {
  let query = getSupabase().from("questions").select(QUESTION_SELECT)
    .order("created_at", { ascending: false }).limit(500);
  if (filter?.type) query = query.eq("type", filter.type);
  if (filter?.lessonId) query = query.eq("lesson_id", filter.lessonId);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as QuestionRow[];
}

/** Đáp án của các câu hỏi — RLS chỉ cho GV/staff đọc. */
export async function fetchQuestionAnswers(questionIds: string[]): Promise<Record<string, QuestionAnswer>> {
  if (!questionIds.length) return {};
  const { data, error } = await getSupabase()
    .from("question_answers").select("question_id, answer")
    .in("question_id", questionIds);
  if (error) throw error;
  const map: Record<string, QuestionAnswer> = {};
  for (const r of data as { question_id: string; answer: QuestionAnswer }[]) {
    map[r.question_id] = r.answer;
  }
  return map;
}

export interface QuestionInput {
  type: QuestionType;
  content: QuestionContent;
  level?: string | null;
  lesson_id?: string | null;
}

export async function createQuestion(
  input: QuestionInput,
  answer: QuestionAnswer,
  createdBy: string,
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("questions")
    .insert({ ...input, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  const { error: ansErr } = await supabase
    .from("question_answers")
    .insert({ question_id: data.id, answer });
  if (ansErr) {
    // Đáp án không lưu được → xóa câu hỏi mồ côi rồi báo lỗi
    await supabase.from("questions").delete().eq("id", data.id);
    throw ansErr;
  }
  return data.id as string;
}

export async function updateQuestion(id: string, input: Partial<QuestionInput>, answer: QuestionAnswer) {
  const supabase = getSupabase();
  const { error } = await supabase.from("questions").update(input).eq("id", id);
  if (error) throw error;
  const { error: ansErr } = await supabase
    .from("question_answers")
    .upsert({ question_id: id, answer }, { onConflict: "question_id" });
  if (ansErr) throw ansErr;
}

export async function deleteQuestion(id: string) {
  const { error } = await getSupabase().from("questions").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Bài tập về nhà ============ */

export interface SubmissionLite {
  id: string;
  student_id: string;
  auto_score: number | null;
  score: number | null;
  status: string;
  submitted_at: string;
}

export interface HomeworkListRow {
  id: string;
  class_id: string;
  session_id: string | null;
  title: string;
  due_at: string | null;
  created_at: string;
  class: { id: string; name: string; class_students: { count: number }[] } | null;
  homework_questions: { count: number }[];
  submissions: SubmissionLite[];
}

const HOMEWORK_LIST_SELECT = `
  id, class_id, session_id, title, due_at, created_at,
  class:classes ( id, name, class_students ( count ) ),
  homework_questions ( count ),
  submissions ( id, student_id, auto_score, score, status, submitted_at )
`;

/** Bài tập trong phạm vi mình xem được (RLS lọc: GV thấy lớp mình, staff thấy hết). */
export async function fetchHomeworks(): Promise<HomeworkListRow[]> {
  const { data, error } = await getSupabase()
    .from("homeworks").select(HOMEWORK_LIST_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as HomeworkListRow[];
}

/**
 * Bài tập của các lớp một học viên đang học, kèm bài nộp CỦA HỌC VIÊN ĐÓ
 * (dùng cho khu học viên và cổng phụ huynh).
 */
export async function fetchHomeworksForStudent(
  classIds: string[],
  studentId: string,
): Promise<HomeworkListRow[]> {
  if (!classIds.length) return [];
  const { data, error } = await getSupabase()
    .from("homeworks").select(HOMEWORK_LIST_SELECT)
    .in("class_id", classIds)
    .eq("submissions.student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as HomeworkListRow[];
}

export interface HomeworkDetail {
  id: string;
  class_id: string;
  session_id: string | null;
  title: string;
  due_at: string | null;
  created_at: string;
  class: { id: string; name: string } | null;
  questions: QuestionRow[];
}

export async function fetchHomework(id: string): Promise<HomeworkDetail | null> {
  const { data, error } = await getSupabase()
    .from("homeworks")
    .select(`
      id, class_id, session_id, title, due_at, created_at,
      class:classes ( id, name ),
      homework_questions ( sort, question:questions ( ${QUESTION_SELECT} ) )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { homework_questions, ...rest } = data as unknown as HomeworkDetail & {
    homework_questions: { sort: number; question: QuestionRow }[];
  };
  const questions = (homework_questions ?? [])
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((hq) => hq.question)
    .filter(Boolean);
  return { ...rest, questions };
}

export async function createHomework(input: {
  class_id: string;
  session_id?: string | null;
  title: string;
  due_at: string | null;
  question_ids: string[];
  created_by: string;
}): Promise<string> {
  const supabase = getSupabase();
  const { question_ids, ...hw } = input;
  const { data, error } = await supabase.from("homeworks").insert(hw).select("id").single();
  if (error) throw error;
  if (question_ids.length) {
    const { error: qErr } = await supabase
      .from("homework_questions")
      .insert(question_ids.map((question_id, i) => ({ homework_id: data.id, question_id, sort: i })));
    if (qErr) {
      await supabase.from("homeworks").delete().eq("id", data.id);
      throw qErr;
    }
  }
  return data.id as string;
}

export async function deleteHomework(id: string) {
  const { error } = await getSupabase().from("homeworks").delete().eq("id", id);
  if (error) throw error;
}

export interface SubmissionRow extends SubmissionLite {
  answers: Record<string, QuestionAnswer>;
  student: { id: string; name: string; avatar: string | null; student_code: string | null } | null;
}

export async function fetchHomeworkSubmissions(homeworkId: string): Promise<SubmissionRow[]> {
  const { data, error } = await getSupabase()
    .from("submissions")
    .select(`
      id, student_id, answers, auto_score, score, status, submitted_at,
      student:profiles!submissions_student_id_fkey ( id, name, avatar, student_code )
    `)
    .eq("homework_id", homeworkId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data as unknown as SubmissionRow[];
}

/** Bài nộp của một học viên cho một bài tập (RLS: chỉ thấy của mình/của con). */
export async function fetchMySubmission(
  homeworkId: string,
  studentId: string,
): Promise<(SubmissionLite & { answers: Record<string, QuestionAnswer> }) | null> {
  const { data, error } = await getSupabase()
    .from("submissions")
    .select("id, student_id, answers, auto_score, score, status, submitted_at")
    .eq("homework_id", homeworkId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data as (SubmissionLite & { answers: Record<string, QuestionAnswer> }) | null;
}

/** Nộp bài — server tự chấm, trả về bài nộp kèm điểm (thang 10). */
export async function submitHomework(
  homeworkId: string,
  answers: Record<string, QuestionAnswer>,
): Promise<SubmissionLite> {
  const { data, error } = await getSupabase().rpc("submit_homework", {
    hw_id: homeworkId,
    my_answers: answers,
  });
  if (error) throw error;
  return data as SubmissionLite;
}
