"use client";

/**
 * SLIDE HTML dùng chung (schema 0068_html_slides.sql).
 *
 * Giáo viên chọn một file .html trong lớp → chiếu ngay từ bản trên máy, đồng
 * thời lưu vào bucket 'html-slides' để giáo viên khác mở lại. Cùng nội dung
 * (SHA-256) chỉ lưu một bản: tải lại file cũ thì dùng luôn bản trong kho.
 *
 * Storage không phục vụ text/html trực tiếp, nên khi chiếu luôn tải NỘI DUNG
 * về rồi dựng bằng <iframe srcdoc> (xem HtmlSlideStage).
 */

import { getSupabase } from "./supabase";

const BUCKET = "html-slides";
const COLUMNS = "id, lesson_id, name, path, size_bytes, created_by, created_at";

export interface HtmlSlide {
  id: string;
  lesson_id: string | null;
  name: string;
  path: string;
  size_bytes: number;
  created_by: string | null;
  created_at: string;
}

export function isHtmlFile(f: File): boolean {
  return f.type === "text/html" || /\.html?$/i.test(f.name);
}

/** Slide gắn với các bài của buổi — hiện lên đầu danh sách. */
export async function fetchLessonHtmlSlides(lessonIds: string[]): Promise<HtmlSlide[]> {
  if (!lessonIds.length) return [];
  const { data, error } = await getSupabase()
    .from("html_slides")
    .select(COLUMNS)
    .in("lesson_id", lessonIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HtmlSlide[];
}

export async function fetchHtmlSlide(id: string): Promise<HtmlSlide | null> {
  const { data, error } = await getSupabase().from("html_slides").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as HtmlSlide | null) ?? null;
}

/** Kho chung: mới nhất trước, lọc theo tên. */
export async function searchHtmlSlides(q: string, limit = 50): Promise<HtmlSlide[]> {
  let query = getSupabase()
    .from("html_slides")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  const term = q.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.ilike("name", `%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as HtmlSlide[];
}

export async function downloadHtmlSlide(slide: Pick<HtmlSlide, "path">): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).download(slide.path);
  if (error) throw error;
  return data.text();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lưu file vào kho (bỏ qua nếu đã có bản cùng nội dung). Trả về bản ghi trong
 * kho và cờ `existed` để báo cho giáo viên biết là dùng lại bản cũ.
 */
export async function saveHtmlSlide(opts: {
  file: File;
  html: string;
  lessonId: string | null;
  /** Bỏ trống thì lấy tên file. */
  name?: string;
}): Promise<{ slide: HtmlSlide; existed: boolean }> {
  const sb = getSupabase();
  const hash = await sha256(opts.html);

  const found = await sb.from("html_slides").select(COLUMNS).eq("sha256", hash).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return { slide: found.data as HtmlSlide, existed: true };

  const path = `${opts.lessonId ?? "chung"}/${crypto.randomUUID()}.html`;
  const blob = new Blob([opts.html], { type: "text/html" });
  const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "text/html" });
  if (up.error) throw up.error;

  const { data, error } = await sb
    .from("html_slides")
    .insert({
      lesson_id: opts.lessonId,
      name: opts.name?.trim() || opts.file.name.replace(/\.html?$/i, ""),
      path,
      size_bytes: blob.size,
      sha256: hash,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // Ghi danh mục hỏng thì dọn file vừa đẩy lên để kho không có file mồ côi
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return { slide: data as HtmlSlide, existed: false };
}

/** Gắn (hoặc gỡ, khi lessonId = null) slide vào một bài học. */
export async function attachHtmlSlide(id: string, lessonId: string | null): Promise<HtmlSlide> {
  const { data, error } = await getSupabase()
    .from("html_slides")
    .update({ lesson_id: lessonId })
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Chỉ người tải lên hoặc người quản lý thư viện mới sửa được slide này");
  return data as HtmlSlide;
}

export async function deleteHtmlSlide(slide: HtmlSlide): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb.from("html_slides").delete().eq("id", slide.id).select("id");
  if (error) throw error;
  // RLS chặn thì Supabase không báo lỗi, chỉ không xoá dòng nào
  if (!data?.length) throw new Error("Chỉ người tải lên hoặc người quản lý thư viện mới xoá được slide này");
  await sb.storage.from(BUCKET).remove([slide.path]);
}
