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
/** Trùng file_size_limit của bucket (0068) và giới hạn tải lên của dự án Supabase. */
export const HTML_SLIDE_MAX_BYTES = 50 * 1024 * 1024;
/** Supabase bắt buộc mỗi phần của upload TUS đúng 6MB. */
const CHUNK = 6 * 1024 * 1024;
const COLUMNS = "id, lesson_id, folder_id, name, path, size_bytes, created_by, created_at";

export interface HtmlSlide {
  id: string;
  lesson_id: string | null;
  /** Thư mục trong Kho PPT bài giảng (0070); null = chưa xếp. */
  folder_id: string | null;
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

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Tải file lên theo từng phần 6MB (giao thức TUS của Supabase). Slide HTML
 * nhúng ảnh/tiếng thường 5–20MB: gửi một request duy nhất thì mạng chập chờn
 * là treo rồi "Failed to fetch"; đi từng phần thì đứt mạng chỉ gửi lại phần
 * hỏng, và có % tiến độ để hiện cho giáo viên.
 */
async function uploadResumable(path: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
  const { Upload } = await import("tus-js-client");
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Phiên đăng nhập đã hết — tải lại trang rồi thử lại.");

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(blob, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK,
      metadata: { bucketName: BUCKET, objectName: path, contentType: "text/html", cacheControl: "3600" },
      onProgress: (sent, total) => onProgress?.(total ? Math.floor((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
      onError: (err) => {
        const status = (err as { originalResponse?: { getStatus(): number } }).originalResponse?.getStatus();
        reject(
          new Error(
            status === 413
              ? `File quá lớn (${mb(blob.size)}) — tối đa ${mb(HTML_SLIDE_MAX_BYTES)}.`
              : status === 403 || status === 401
                ? "Không có quyền tải slide lên (hoặc phiên đăng nhập đã hết — tải lại trang)."
                : `Tải lên bị gián đoạn (${status ?? "mất kết nối"}). Kiểm tra mạng rồi thử lại.`,
          ),
        );
      },
    });
    upload.start();
  });
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
  /** % đã tải lên (0–100). */
  onProgress?: (pct: number) => void;
  /** Bỏ trống thì DB tự xếp theo giáo trình của bài (trigger 0070). */
  folderId?: string | null;
}): Promise<{ slide: HtmlSlide; existed: boolean }> {
  const sb = getSupabase();
  if (opts.file.size > HTML_SLIDE_MAX_BYTES) {
    throw new Error(`“${opts.file.name}” nặng ${mb(opts.file.size)} — tối đa ${mb(HTML_SLIDE_MAX_BYTES)}. Nén bớt ảnh/tiếng trong slide rồi thử lại.`);
  }
  const hash = await sha256(opts.html);

  const found = await sb.from("html_slides").select(COLUMNS).eq("sha256", hash).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return { slide: found.data as HtmlSlide, existed: true };

  const path = `${opts.lessonId ?? "chung"}/${crypto.randomUUID()}.html`;
  const blob = new Blob([opts.html], { type: "text/html" });
  await uploadResumable(path, blob, opts.onProgress);

  const { data, error } = await sb
    .from("html_slides")
    .insert({
      lesson_id: opts.lessonId,
      ...(opts.folderId ? { folder_id: opts.folderId } : {}),
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
export function attachHtmlSlide(id: string, lessonId: string | null): Promise<HtmlSlide> {
  return updateHtmlSlide(id, { lesson_id: lessonId });
}

export async function updateHtmlSlide(
  id: string,
  patch: Partial<Pick<HtmlSlide, "name" | "lesson_id" | "folder_id">>,
): Promise<HtmlSlide> {
  const { data, error } = await getSupabase()
    .from("html_slides")
    .update(patch)
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

/* ===================== Kho PPT bài giảng: thư mục ===================== */

export interface SlideFolder {
  id: string;
  name: string;
  textbook_id: string | null;
  sort: number;
  created_at: string;
  textbook: { id: string; name: string } | null;
  html_slides: { count: number }[];
}

export async function fetchSlideFolders(): Promise<SlideFolder[]> {
  const { data, error } = await getSupabase()
    .from("slide_folders")
    .select("id, name, textbook_id, sort, created_at, textbook:textbooks ( id, name ), html_slides ( count )")
    .order("sort")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as SlideFolder[];
}

export async function saveSlideFolder(
  input: { name: string; textbook_id: string | null },
  id?: string,
): Promise<void> {
  const sb = getSupabase();
  const row = { name: input.name.trim(), textbook_id: input.textbook_id };
  const { error } = id
    ? await sb.from("slide_folders").update(row).eq("id", id)
    : await sb.from("slide_folders").insert(row);
  if (error) throw error;
}

/** Xoá thư mục — slide bên trong về mục "Chưa xếp thư mục", không mất. */
export async function deleteSlideFolder(id: string): Promise<void> {
  const { error } = await getSupabase().from("slide_folders").delete().eq("id", id);
  if (error) throw error;
}

export interface LibrarySlide extends HtmlSlide {
  lesson: { id: string; unit: number | null; title: string } | null;
  creator: { name: string } | null;
}

/** Slide trong một thư mục ("none" = chưa xếp, null = tất cả), lọc theo tên. */
export async function fetchFolderSlides(folder: string | "none" | null, q = ""): Promise<LibrarySlide[]> {
  let query = getSupabase()
    .from("html_slides")
    .select(`${COLUMNS}, lesson:lessons ( id, unit, title ), creator:profiles!html_slides_created_by_fkey ( name )`)
    .order("name");
  if (folder === "none") query = query.is("folder_id", null);
  else if (folder) query = query.eq("folder_id", folder);
  const term = q.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.ilike("name", `%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LibrarySlide[];
}

/* ===================== Gửi slide cho học viên (0074) ===================== */

export interface SessionSlideContext {
  /** Slide sẽ tích sẵn: slide chọn riêng cho buổi, không có thì slide đầu của bài. */
  defaultSlide: HtmlSlide | null;
  /** Slide gắn với các bài của buổi — hiện sẵn để tích thêm. */
  lessonSlides: HtmlSlide[];
  /** Slide đã gửi cho buổi này trước đó. */
  shared: HtmlSlide[];
}

export async function fetchSessionSlideContext(sessionId: string): Promise<SessionSlideContext> {
  const sb = getSupabase();
  const [sess, lessons, shares] = await Promise.all([
    sb.from("sessions").select("html_slide_id").eq("id", sessionId).maybeSingle(),
    sb.from("session_lessons").select("lesson_id").eq("session_id", sessionId),
    sb.from("session_slide_shares").select(`slide:html_slides ( ${COLUMNS} )`).eq("session_id", sessionId),
  ]);
  if (sess.error) throw sess.error;
  if (lessons.error) throw lessons.error;
  if (shares.error) throw shares.error;
  const lessonSlides = await fetchLessonHtmlSlides((lessons.data ?? []).map((r) => r.lesson_id as string));
  const sessionSlideId = (sess.data?.html_slide_id as string | null) ?? null;
  const defaultSlide = sessionSlideId
    ? (lessonSlides.find((s) => s.id === sessionSlideId) ?? (await fetchHtmlSlide(sessionSlideId)))
    : (lessonSlides[0] ?? null);
  const shared = ((shares.data ?? []) as unknown as { slide: HtmlSlide | null }[])
    .map((r) => r.slide)
    .filter((s): s is HtmlSlide => !!s);
  return { defaultSlide, lessonSlides, shared };
}

/** Đồng bộ danh sách slide đã gửi của buổi: thêm slide mới tích, thu hồi slide bỏ tích. */
export async function saveSessionSlideShares(
  sessionId: string,
  slideIds: string[],
  previousIds: string[],
): Promise<void> {
  const sb = getSupabase();
  const add = slideIds.filter((id) => !previousIds.includes(id));
  const remove = previousIds.filter((id) => !slideIds.includes(id));
  if (remove.length) {
    const { error } = await sb
      .from("session_slide_shares")
      .delete()
      .eq("session_id", sessionId)
      .in("slide_id", remove);
    if (error) throw error;
  }
  if (add.length) {
    const { error } = await sb
      .from("session_slide_shares")
      .upsert(add.map((slide_id) => ({ session_id: sessionId, slide_id })), {
        onConflict: "session_id,slide_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
}

export interface SharedSlide {
  slide_id: string;
  name: string;
  path: string;
  size_bytes: number;
  slide_lesson: string | null;
  session_id: string;
  session_date: string;
  session_no: number | null;
  class_id: string | null;
  class_name: string | null;
  lesson_ids: string[];
  shared_at: string;
}

/** Slide giáo viên đã gửi cho học viên / phụ huynh đang đăng nhập. */
export async function fetchMySharedSlides(filter: {
  classId?: string;
  sessionId?: string;
  lessonId?: string;
}): Promise<SharedSlide[]> {
  const { data, error } = await getSupabase().rpc("my_shared_slides", {
    p_class_id: filter.classId ?? null,
    p_session_id: filter.sessionId ?? null,
    p_lesson_id: filter.lessonId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as SharedSlide[];
}
