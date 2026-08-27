"use client";

/**
 * BỘ SLIDE CÓ TIẾNG (schema 0028_lesson_decks.sql).
 *
 * Vì sao phải nạp trước chứ không mở thẳng .pptx trong lớp: vẽ lại PowerPoint
 * bằng JavaScript cho ra bố cục vỡ (chữ bị bẻ dọc, khối lệch). Nên chia đôi:
 * HÌNH lấy từ bản PDF xuất ra từ chính file đó, TIẾNG bóc từ ruột .pptx kèm
 * toạ độ icon loa. Cả hai việc nặng đều làm một lần lúc nạp thư viện; vào lớp
 * chỉ còn tải PDF + bấm nút.
 *
 * File nằm trong bucket 'decks' (không public) — mỗi lần chiếu xin link tạm.
 */

import { getSupabase } from "./supabase";
import { readPptxDeck, type MediaClip, type PptxSpot, type SpotRect } from "./pptx";

const BUCKET = "decks";
/** Link tạm sống 4 tiếng: dài hơn một buổi dạy, ngắn hơn một ngày. */
const SIGNED_TTL = 4 * 60 * 60;

export interface DeckSpot {
  path: string;
  name: string;
  kind: "audio" | "video";
  rect: SpotRect | null;
  /** Đoạn cần phát (giáo trình hay cắt một file dài thành từng từ). */
  clip: MediaClip | null;
}

export interface LessonDeck {
  id: string;
  lesson_id: string;
  name: string;
  pdf_path: string;
  slide_count: number;
  /** spots[i] = nút tiếng của slide thứ i+1. */
  spots: DeckSpot[][];
  created_at: string;
}

export async function fetchLessonDecks(lessonIds: string[]): Promise<LessonDeck[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await getSupabase()
    .from("lesson_decks")
    .select("id, lesson_id, name, pdf_path, slide_count, spots, created_at")
    .in("lesson_id", lessonIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LessonDeck[];
}

/** Link tạm để tải file trong bucket (PDF hoặc một file tiếng). */
export async function signDeckFile(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) throw error;
  return data.signedUrl;
}

/** Ký một lượt cho nhiều file tiếng của bộ slide (vào lớp là có sẵn hết). */
export async function signDeckFiles(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  if (error) throw error;
  (data ?? []).forEach((row) => {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  });
  return out;
}

export interface UploadProgress {
  /** Việc đang làm, hiện thẳng cho người nạp thấy. */
  step: string;
  done: number;
  total: number;
}

/**
 * Nạp một bộ slide: đọc tiếng + toạ độ từ .pptx, đẩy PDF và các file tiếng lên
 * kho, rồi ghi bản đồ nút vào database.
 *
 * Kiểm tra số slide của hai file có khớp không là việc của người gọi — ở đây
 * chỉ trả về số slide đọc được trong .pptx để đối chiếu.
 */
export async function uploadLessonDeck(opts: {
  lessonId: string;
  pptx: File;
  pdf: File;
  name?: string;
  onProgress?: (p: UploadProgress) => void;
}): Promise<{ deckId: string; slideCount: number; mediaCount: number }> {
  const { lessonId, pptx, pdf, onProgress } = opts;
  const sb = getSupabase();
  const say = (step: string, done = 0, total = 0) => onProgress?.({ step, done, total });

  say("Đang đọc file PowerPoint…");
  const deck = await readPptxDeck(pptx);

  // Thư mục riêng cho mỗi bộ slide để xoá là sạch, không đụng bộ khác
  const folder = `${lessonId}/${crypto.randomUUID()}`;

  say("Đang tải bản PDF lên…");
  const pdfPath = `${folder}/slides.pdf`;
  const up = await sb.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf" });
  if (up.error) throw up.error;

  // Mỗi file tiếng chỉ tải lên một lần dù nhiều slide dùng chung
  const unique = new Map<string, PptxSpot>();
  deck.bySlide.flat().forEach((s) => unique.set(s.path, s));
  const paths = new Map<string, string>();
  let done = 0;

  for (const [key, spot] of Array.from(unique)) {
    say(`Đang tải tiếng lên (${done + 1}/${unique.size})…`, done, unique.size);
    const blob = await deck.blob(spot);
    const dest = `${folder}/media/${spot.name}`;
    const res = await sb.storage.from(BUCKET).upload(dest, blob, { contentType: blob.type, upsert: true });
    if (res.error) throw res.error;
    paths.set(key, dest);
    done++;
  }

  const spots: DeckSpot[][] = deck.bySlide.map((list) =>
    list.map((s) => ({ path: paths.get(s.path)!, name: s.name, kind: s.kind, rect: s.rect, clip: s.clip })),
  );

  say("Đang lưu bản đồ nút bấm…");
  const { data, error } = await sb
    .from("lesson_decks")
    .insert({
      lesson_id: lessonId,
      name: opts.name?.trim() || pptx.name.replace(/\.pptx$/i, ""),
      pdf_path: pdfPath,
      slide_count: deck.slideCount,
      spots,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { deckId: data.id as string, slideCount: deck.slideCount, mediaCount: unique.size };
}

/** Xoá bộ slide kèm toàn bộ file của nó trong kho. */
export async function deleteLessonDeck(deck: LessonDeck): Promise<void> {
  const sb = getSupabase();
  const files = [deck.pdf_path, ...deck.spots.flat().map((s) => s.path)];
  const { error: rmError } = await sb.storage.from(BUCKET).remove(Array.from(new Set(files)));
  if (rmError) throw rmError;
  const { error } = await sb.from("lesson_decks").delete().eq("id", deck.id);
  if (error) throw error;
}
