"use client";

/**
 * Data layer cho THƯ VIỆN GIÁO TRÌNH (schema 0011_library.sql).
 *
 * Trung tâm (admin/staff) nạp sẵn giáo trình — mỗi giáo trình nhiều bài
 * học kèm từ vựng / ngữ pháp / câu hỏi luyện tập — để giáo viên chỉ việc
 * chọn bài gán vào buổi học hoặc lọc câu hỏi theo bài khi giao bài tập.
 *
 * Import chạy ngay trên trình duyệt admin (RLS cho staff/admin full quyền
 * các bảng nội dung), nhận file JSON dạng TextbookImportPayload:
 * {
 *   "textbook": { "code", "name", "name_zh"?, "level"?, "description"? },
 *   "lessons": [{
 *     "unit", "title", "title_zh"?, "summary"?, "grammar"?,
 *     "vocab":     [{ "hanzi", "pinyin", "meaning", "example"? }],
 *     "questions": [{ "type", "content", "answer" }]   // quy ước jsonb ở db-content.ts
 *   }]
 * }
 * Import lặp lại được (idempotent): giáo trình khớp theo code, bài theo
 * unit, từ vựng tái dùng kho theo hanzi, câu hỏi trùng nội dung thì bỏ qua
 * (không xóa câu cũ để không vỡ bài tập đã giao).
 *
 * Cập nhật MỀM: với bài đã tồn tại, chỉ ghi đè field có mặt trong payload
 * (summary/grammar/... không khai báo thì giữ nguyên); "vocab" không khai
 * báo thì giữ nguyên từ đã gắn. Nhờ đó có thể import file CHỈ CHỨA CÂU HỎI
 * (unit + title + questions) để bổ sung bài tập cho giáo trình có sẵn.
 */

import { getSupabase } from "./supabase";
import type {
  QuestionAnswer,
  QuestionContent,
  QuestionType,
  VocabExample,
} from "./db-content";
import { QUESTION_TYPE_LABELS } from "./db-content";

/* ============ Giáo trình ============ */

export interface TextbookRow {
  id: string;
  code: string;
  name: string;
  name_zh: string | null;
  level: string | null;
  description: string | null;
  cover_url: string | null;
  sort: number;
  created_at: string;
  lessons: { count: number }[];
}

export interface TextbookLessonRow {
  id: string;
  unit: number | null;
  title: string;
  title_zh: string | null;
  summary: string | null;
  grammar: string | null;
  slide_embed_url: string | null;
  lesson_vocab: { count: number }[];
  questions: { count: number }[];
}

export async function fetchTextbooks(): Promise<TextbookRow[]> {
  const { data, error } = await getSupabase()
    .from("textbooks")
    .select("*, lessons ( count )")
    .order("sort")
    .order("created_at");
  if (error) throw error;
  return data as TextbookRow[];
}

export async function fetchTextbook(id: string): Promise<TextbookRow | null> {
  const { data, error } = await getSupabase()
    .from("textbooks")
    .select("*, lessons ( count )")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as TextbookRow | null;
}

export async function fetchTextbookLessons(textbookId: string): Promise<TextbookLessonRow[]> {
  const { data, error } = await getSupabase()
    .from("lessons")
    .select(`
      id, unit, title, title_zh, summary, grammar, slide_embed_url,
      lesson_vocab ( count ),
      questions ( count )
    `)
    .eq("textbook_id", textbookId)
    .order("unit")
    .order("sort");
  if (error) throw error;
  return data as unknown as TextbookLessonRow[];
}

/** Xóa giáo trình — bài học của nó xóa theo (cascade), câu hỏi mất liên kết bài. */
export async function deleteTextbook(id: string) {
  const { error } = await getSupabase().from("textbooks").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Import giáo trình từ JSON ============ */

export interface TextbookImportVocab {
  hanzi: string;
  pinyin: string;
  meaning: string;
  example?: VocabExample | null;
  audio_url?: string | null;
}

export interface TextbookImportQuestion {
  type: QuestionType;
  content: QuestionContent;
  answer: QuestionAnswer;
}

export interface TextbookImportLesson {
  unit: number;
  title: string;
  title_zh?: string | null;
  summary?: string | null;
  grammar?: string | null;
  slide_embed_url?: string | null;
  vocab?: TextbookImportVocab[];
  questions?: TextbookImportQuestion[];
}

export interface TextbookImportPayload {
  textbook: {
    code: string;
    name: string;
    name_zh?: string | null;
    level?: string | null;
    description?: string | null;
    cover_url?: string | null;
    sort?: number;
  };
  lessons: TextbookImportLesson[];
}

export interface TextbookImportResult {
  textbookId: string;
  lessonsCreated: number;
  lessonsUpdated: number;
  vocabCreated: number;
  vocabReused: number;
  questionsCreated: number;
  questionsSkipped: number;
}

/** JSON.stringify với key sắp xếp — so trùng câu hỏi với jsonb (Postgres tự sắp key). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertPayload(payload: TextbookImportPayload) {
  const tb = payload?.textbook;
  if (!tb?.code?.trim() || !tb?.name?.trim()) {
    throw new Error("File JSON thiếu textbook.code hoặc textbook.name.");
  }
  if (!Array.isArray(payload.lessons) || payload.lessons.length === 0) {
    throw new Error("File JSON không có bài học nào (lessons rỗng).");
  }
  const types = Object.keys(QUESTION_TYPE_LABELS);
  const units = new Set<number>();
  for (const l of payload.lessons) {
    if (typeof l.unit !== "number" || !l.title?.trim()) {
      throw new Error(`Bài "${l.title ?? "?"}": thiếu unit (số bài) hoặc title.`);
    }
    if (units.has(l.unit)) throw new Error(`Trùng số bài: có 2 bài cùng unit ${l.unit}.`);
    units.add(l.unit);
    for (const [i, v] of (l.vocab ?? []).entries()) {
      if (!v.hanzi?.trim() || !v.pinyin?.trim() || !v.meaning?.trim()) {
        throw new Error(`Bài ${l.unit}, từ vựng thứ ${i + 1}: cần đủ hanzi / pinyin / meaning.`);
      }
    }
    for (const [i, q] of (l.questions ?? []).entries()) {
      if (!types.includes(q.type)) {
        throw new Error(`Bài ${l.unit}, câu hỏi thứ ${i + 1}: dạng "${q.type}" không hợp lệ.`);
      }
      if (!q.content || q.answer === undefined || q.answer === null) {
        throw new Error(`Bài ${l.unit}, câu hỏi thứ ${i + 1}: thiếu content hoặc answer.`);
      }
    }
  }
}

/**
 * Import / cập nhật một giáo trình từ payload JSON (chạy dưới quyền
 * staff/admin đang đăng nhập). Gọi lại nhiều lần an toàn.
 */
export async function importTextbook(
  payload: TextbookImportPayload,
  createdBy: string,
  onProgress?: (message: string) => void,
): Promise<TextbookImportResult> {
  assertPayload(payload);
  const supabase = getSupabase();
  const progress = onProgress ?? (() => {});
  const result: TextbookImportResult = {
    textbookId: "",
    lessonsCreated: 0,
    lessonsUpdated: 0,
    vocabCreated: 0,
    vocabReused: 0,
    questionsCreated: 0,
    questionsSkipped: 0,
  };

  // 1. Giáo trình: khớp theo code
  progress("Đang tạo / cập nhật giáo trình...");
  const tb = payload.textbook;
  const tbFields = {
    name: tb.name.trim(),
    name_zh: tb.name_zh?.trim() || null,
    level: tb.level?.trim() || null,
    description: tb.description?.trim() || null,
    cover_url: tb.cover_url?.trim() || null,
    sort: tb.sort ?? 0,
  };
  const { data: existingTb, error: tbErr } = await supabase
    .from("textbooks").select("id").eq("code", tb.code.trim()).maybeSingle();
  if (tbErr) throw tbErr;
  if (existingTb) {
    const { error } = await supabase.from("textbooks").update(tbFields).eq("id", existingTb.id);
    if (error) throw error;
    result.textbookId = existingTb.id;
  } else {
    const { data, error } = await supabase
      .from("textbooks")
      .insert({ ...tbFields, code: tb.code.trim(), created_by: createdBy })
      .select("id")
      .single();
    if (error) throw error;
    result.textbookId = data.id;
  }

  // 2. Bài học: khớp theo unit trong giáo trình
  progress("Đang tạo / cập nhật bài học...");
  const { data: existingLessons, error: lsErr } = await supabase
    .from("lessons").select("id, unit").eq("textbook_id", result.textbookId);
  if (lsErr) throw lsErr;
  const lessonIdByUnit = new Map<number, string>(
    (existingLessons ?? []).map((l) => [l.unit as number, l.id as string]),
  );
  for (const lesson of payload.lessons) {
    // Chỉ ghi đè field có khai báo trong payload (cập nhật mềm)
    const fields: Record<string, unknown> = {
      unit: lesson.unit,
      title: lesson.title.trim(),
      sort: lesson.unit,
    };
    if (lesson.title_zh !== undefined) fields.title_zh = lesson.title_zh?.trim() || null;
    if (lesson.summary !== undefined) fields.summary = lesson.summary?.trim() || null;
    if (lesson.grammar !== undefined) fields.grammar = lesson.grammar?.trim() || null;
    if (lesson.slide_embed_url !== undefined) fields.slide_embed_url = lesson.slide_embed_url?.trim() || null;
    const existingId = lessonIdByUnit.get(lesson.unit);
    if (existingId) {
      const { error } = await supabase.from("lessons").update(fields).eq("id", existingId);
      if (error) throw error;
      result.lessonsUpdated++;
    } else {
      const { data, error } = await supabase
        .from("lessons")
        .insert({ ...fields, textbook_id: result.textbookId, course_id: null, created_by: createdBy })
        .select("id")
        .single();
      if (error) throw error;
      lessonIdByUnit.set(lesson.unit, data.id);
      result.lessonsCreated++;
    }
  }

  // 3. Từ vựng: tái dùng kho chung theo hanzi, thiếu thì thêm mới
  progress("Đang nạp từ vựng...");
  const allVocab = payload.lessons.flatMap((l) => l.vocab ?? []);
  const vocabIdByHanzi = new Map<string, string>();
  if (allVocab.length) {
    const hanziList = [...new Set(allVocab.map((v) => v.hanzi.trim()))];
    const { data: existingVocab, error: vErr } = await supabase
      .from("vocab_items").select("id, hanzi").in("hanzi", hanziList);
    if (vErr) throw vErr;
    for (const v of existingVocab ?? []) {
      if (!vocabIdByHanzi.has(v.hanzi)) vocabIdByHanzi.set(v.hanzi, v.id);
    }
    result.vocabReused = vocabIdByHanzi.size;

    const missing: TextbookImportVocab[] = [];
    const seen = new Set<string>();
    for (const v of allVocab) {
      const hanzi = v.hanzi.trim();
      if (vocabIdByHanzi.has(hanzi) || seen.has(hanzi)) continue;
      seen.add(hanzi);
      missing.push(v);
    }
    if (missing.length) {
      const { data: inserted, error } = await supabase
        .from("vocab_items")
        .insert(missing.map((v) => ({
          hanzi: v.hanzi.trim(),
          pinyin: v.pinyin.trim(),
          meaning: v.meaning.trim(),
          example: v.example ?? null,
          audio_url: v.audio_url ?? null,
          level: tbFields.level,
          tags: [tb.code.trim()],
          created_by: createdBy,
        })))
        .select("id, hanzi");
      if (error) throw error;
      for (const v of inserted ?? []) vocabIdByHanzi.set(v.hanzi, v.id);
      result.vocabCreated = missing.length;
    }
  }

  // 4. Gắn từ vựng vào từng bài (thay toàn bộ, giữ thứ tự trong file).
  //    Bài không khai báo "vocab" thì giữ nguyên từ đang gắn.
  for (const lesson of payload.lessons) {
    if (lesson.vocab === undefined) continue;
    const lessonId = lessonIdByUnit.get(lesson.unit)!;
    const ids = lesson.vocab
      .map((v) => vocabIdByHanzi.get(v.hanzi.trim()))
      .filter((id): id is string => Boolean(id));
    const { error: delErr } = await supabase.from("lesson_vocab").delete().eq("lesson_id", lessonId);
    if (delErr) throw delErr;
    if (ids.length) {
      const { error } = await supabase
        .from("lesson_vocab")
        .insert(ids.map((vocab_id, i) => ({ lesson_id: lessonId, vocab_id, sort: i })));
      if (error) throw error;
    }
  }

  // 5. Câu hỏi luyện tập: bỏ qua câu trùng nội dung, không xóa câu cũ
  progress("Đang nạp câu hỏi luyện tập...");
  const lessonIds = [...lessonIdByUnit.values()];
  const { data: existingQs, error: qErr } = await supabase
    .from("questions").select("lesson_id, type, content").in("lesson_id", lessonIds);
  if (qErr) throw qErr;
  const existingKeys = new Set(
    (existingQs ?? []).map((q) => `${q.lesson_id}|${q.type}|${stableStringify(q.content)}`),
  );
  const newQuestions: { lesson_id: string; type: QuestionType; content: QuestionContent }[] = [];
  const newAnswers: QuestionAnswer[] = [];
  for (const lesson of payload.lessons) {
    const lessonId = lessonIdByUnit.get(lesson.unit)!;
    for (const q of lesson.questions ?? []) {
      const key = `${lessonId}|${q.type}|${stableStringify(q.content)}`;
      if (existingKeys.has(key)) {
        result.questionsSkipped++;
        continue;
      }
      existingKeys.add(key);
      newQuestions.push({ lesson_id: lessonId, type: q.type, content: q.content });
      newAnswers.push(q.answer);
    }
  }
  if (newQuestions.length) {
    const { data: inserted, error } = await supabase
      .from("questions")
      .insert(newQuestions.map((q) => ({
        ...q,
        level: tbFields.level,
        tags: [tb.code.trim()],
        created_by: createdBy,
      })))
      .select("id");
    if (error) throw error;
    const rows = inserted ?? [];
    if (rows.length !== newAnswers.length) {
      throw new Error("Số câu hỏi tạo được không khớp số đáp án — import dừng, hãy thử lại.");
    }
    const { error: ansErr } = await supabase
      .from("question_answers")
      .insert(rows.map((r, i) => ({ question_id: r.id, answer: newAnswers[i] })));
    if (ansErr) {
      // Đáp án không lưu được → dọn câu hỏi mồ côi vừa tạo rồi báo lỗi
      await supabase.from("questions").delete().in("id", rows.map((r) => r.id));
      throw ansErr;
    }
    result.questionsCreated = newQuestions.length;
  }

  return result;
}
