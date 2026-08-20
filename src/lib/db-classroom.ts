/**
 * Data layer cho CHẾ ĐỘ LỚP HỌC TRỰC TIẾP (migration 0020).
 *
 * Bối cảnh: trong giờ học viên KHÔNG dùng thiết bị — mọi thao tác do giáo
 * viên bấm trên một máy nối máy chiếu. Vì vậy ở đây không có realtime, chỉ
 * có nơi lưu KẾT QUẢ tương tác (điểm ★, hoạt động đã chạy) để học viên và
 * phụ huynh xem lại sau buổi.
 *
 * Lớp học hay mất wifi giữa giờ → điểm cộng được ghi tạm vào localStorage
 * (`queuePoints`) và đẩy lên server khi có mạng (`flushPoints`).
 */

import { getSupabase } from "./supabase";

/* ============ Điểm thưởng trong giờ ============ */

export type PointReason =
  | "speak"
  | "correct"
  | "homework"
  | "help"
  | "chinese"
  | "prepare"
  | "game"
  | "behavior"
  | "bonus";

export interface PointReasonDef {
  value: PointReason;
  label: string;
  /** Số điểm mặc định khi chọn lý do này (âm = trừ điểm). */
  points: number;
  emoji: string;
}

/** Các lý do cộng điểm bày sẵn cho giáo viên bấm nhanh trong giờ. */
export const POINT_REASONS: PointReasonDef[] = [
  { value: "speak", label: "Phát biểu", points: 1, emoji: "🙋" },
  { value: "correct", label: "Trả lời đúng", points: 1, emoji: "✅" },
  { value: "chinese", label: "Nói tiếng Trung", points: 1, emoji: "🗣️" },
  { value: "homework", label: "Làm bài tốt", points: 1, emoji: "📝" },
  { value: "prepare", label: "Chuẩn bị bài", points: 1, emoji: "📚" },
  { value: "help", label: "Giúp bạn", points: 1, emoji: "🤝" },
  { value: "game", label: "Thắng hoạt động", points: 2, emoji: "🏆" },
  { value: "bonus", label: "Xuất sắc", points: 2, emoji: "⭐" },
  { value: "behavior", label: "Mất trật tự", points: -1, emoji: "🤫" },
];

export const POINT_REASON_LABELS: Record<PointReason, string> = POINT_REASONS.reduce(
  (acc, r) => ({ ...acc, [r.value]: r.label }),
  {} as Record<PointReason, string>,
);

export interface ClassPointRow {
  id: string;
  session_id: string;
  student_id: string;
  points: number;
  reason: PointReason;
  team: string | null;
  created_at: string;
}

export interface PointInput {
  student_id: string;
  points: number;
  reason: PointReason;
  team?: string | null;
}

export async function fetchSessionPoints(sessionId: string): Promise<ClassPointRow[]> {
  const { data, error } = await getSupabase()
    .from("class_points")
    .select("id, session_id, student_id, points, reason, team, created_at")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) throw error;
  return data as ClassPointRow[];
}

/** Điểm của một học viên trong nhiều buổi (khu học viên / cổng phụ huynh). */
export async function fetchStudentPoints(
  studentId: string,
  sessionIds?: string[],
): Promise<ClassPointRow[]> {
  let query = getSupabase()
    .from("class_points")
    .select("id, session_id, student_id, points, reason, team, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (sessionIds) {
    if (!sessionIds.length) return [];
    query = query.in("session_id", sessionIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ClassPointRow[];
}

export async function addClassPoints(
  sessionId: string,
  rows: PointInput[],
  createdBy: string,
): Promise<ClassPointRow[]> {
  if (!rows.length) return [];
  const { data, error } = await getSupabase()
    .from("class_points")
    .insert(
      rows.map((r) => ({
        session_id: sessionId,
        student_id: r.student_id,
        points: r.points,
        reason: r.reason,
        team: r.team ?? null,
        created_by: createdBy,
      })),
    )
    .select("id, session_id, student_id, points, reason, team, created_at");
  if (error) throw error;
  return data as ClassPointRow[];
}

export async function deleteClassPoint(id: string) {
  const { error } = await getSupabase().from("class_points").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Hàng chờ khi mất mạng giữa giờ ============ */

export interface PendingPoint extends PointInput {
  /** Khóa tạm ở client, thay cho id của server. */
  tmp_id: string;
  created_at: string;
}

const queueKey = (sessionId: string) => `classroom:points:${sessionId}`;

export function readQueue(sessionId: string): PendingPoint[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(queueKey(sessionId)) ?? "[]") as PendingPoint[];
  } catch {
    return [];
  }
}

function writeQueue(sessionId: string, rows: PendingPoint[]) {
  if (typeof window === "undefined") return;
  if (rows.length) window.localStorage.setItem(queueKey(sessionId), JSON.stringify(rows));
  else window.localStorage.removeItem(queueKey(sessionId));
}

export function queuePoints(sessionId: string, rows: PendingPoint[]) {
  writeQueue(sessionId, [...readQueue(sessionId), ...rows]);
}

export function unqueuePoint(sessionId: string, tmpId: string) {
  writeQueue(sessionId, readQueue(sessionId).filter((r) => r.tmp_id !== tmpId));
}

/**
 * Đẩy toàn bộ điểm đang chờ lên server. Trả về các bản ghi đã lưu để UI thay
 * bản tạm bằng bản thật; lỗi mạng thì giữ nguyên hàng chờ và ném lỗi.
 */
export async function flushPoints(
  sessionId: string,
  createdBy: string,
): Promise<{ saved: ClassPointRow[]; tmpIds: string[] }> {
  const pending = readQueue(sessionId);
  if (!pending.length) return { saved: [], tmpIds: [] };
  const saved = await addClassPoints(sessionId, pending, createdBy);
  writeQueue(sessionId, []);
  return { saved, tmpIds: pending.map((p) => p.tmp_id) };
}

/* ============ Nhật ký hoạt động trong buổi ============ */

export type ActivityKind =
  | "slide"
  | "vocab"
  | "game"
  | "quiz"
  | "whiteboard"
  | "stroke"
  | "random"
  | "timer"
  | "note";

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  slide: "Trình chiếu",
  vocab: "Từ vựng",
  game: "Trò chơi",
  quiz: "Hỏi nhanh",
  whiteboard: "Bảng viết",
  stroke: "Luyện nét chữ",
  random: "Gọi tên",
  timer: "Bấm giờ",
  note: "Ghi chú",
};

export interface SessionActivityRow {
  id: string;
  session_id: string;
  kind: ActivityKind;
  title: string | null;
  ref_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function fetchSessionActivities(sessionId: string): Promise<SessionActivityRow[]> {
  const { data, error } = await getSupabase()
    .from("session_activities")
    .select("id, session_id, kind, title, ref_id, payload, created_at")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) throw error;
  return data as SessionActivityRow[];
}

/** Ghi nhật ký hoạt động — lỗi không được làm gián đoạn giờ dạy nên nuốt lỗi. */
export async function logActivity(input: {
  session_id: string;
  kind: ActivityKind;
  title?: string | null;
  ref_id?: string | null;
  payload?: Record<string, unknown>;
  created_by: string;
}) {
  try {
    const { error } = await getSupabase().from("session_activities").insert({
      session_id: input.session_id,
      kind: input.kind,
      title: input.title ?? null,
      ref_id: input.ref_id ?? null,
      payload: input.payload ?? {},
      created_by: input.created_by,
    });
    if (error) throw error;
  } catch (e) {
    console.error("logActivity", e);
  }
}

/* ============ Tiện ích ============ */

/** Tổng điểm theo học viên từ danh sách điểm rời. */
export function pointsByStudent(rows: { student_id: string; points: number }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.student_id] = (map[r.student_id] ?? 0) + r.points;
  return map;
}

/** Số lần được ghi nhận theo lý do (dùng cho gợi ý nhận xét cuối buổi). */
export function countByReason(
  rows: { student_id: string; reason: PointReason }[],
  studentId: string,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.student_id !== studentId) continue;
    map[r.reason] = (map[r.reason] ?? 0) + 1;
  }
  return map;
}

/** Giọng đọc tiếng Trung dùng chung cho các công cụ trong lớp. */
export function speakZh(text: string, rate = 0.85) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Học viên trong một buổi dạy (gồm cả học viên tới học bù buổi này). */
export interface ClassroomStudent {
  id: string;
  name: string;
  avatar: string | null;
  /** true = học viên học bù, không thuộc sĩ số lớp. */
  makeup: boolean;
}

/* ============ Nhật ký buổi học cho học viên / phụ huynh ============ */

export interface SessionReport {
  session: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    class: { id: string; name: string } | null;
    teacher: { id: string; name: string; avatar: string | null } | null;
  };
  attendance: { status: string; note: string | null } | null;
  comment: { content: string; rating: number | null } | null;
  points: ClassPointRow[];
  activities: SessionActivityRow[];
  lessons: { id: string; unit: number | null; title: string; title_zh: string | null }[];
  homeworks: { id: string; title: string; kind: string; due_at: string | null }[];
  lessonContent: string | null;
}

/**
 * Toàn bộ những gì đã diễn ra với MỘT học viên trong MỘT buổi — dùng chung cho
 * khu học viên và cổng phụ huynh (RLS tự lọc: học viên xem của mình, phụ huynh
 * xem của con).
 */
export async function fetchSessionReport(
  sessionId: string,
  studentId: string,
): Promise<SessionReport | null> {
  const supabase = getSupabase();

  const { data: session, error } = await supabase
    .from("sessions")
    .select(`
      id, date, start_time, end_time,
      class:classes ( id, name ),
      teacher:profiles!sessions_teacher_id_fkey ( id, name, avatar ),
      teaching_log:teaching_logs ( lesson_content )
    `)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const [attendance, comment, points, activities, lessons, homeworks] = await Promise.all([
    supabase.from("attendance").select("status, note")
      .eq("session_id", sessionId).eq("student_id", studentId).maybeSingle(),
    supabase.from("session_comments").select("content, rating")
      .eq("session_id", sessionId).eq("student_id", studentId).maybeSingle(),
    supabase.from("class_points").select("id, session_id, student_id, points, reason, team, created_at")
      .eq("session_id", sessionId).eq("student_id", studentId).order("created_at"),
    supabase.from("session_activities").select("id, session_id, kind, title, ref_id, payload, created_at")
      .eq("session_id", sessionId).order("created_at"),
    supabase.from("session_lessons").select("lesson:lessons ( id, unit, title, title_zh )")
      .eq("session_id", sessionId),
    supabase.from("homeworks").select("id, title, kind, due_at").eq("session_id", sessionId),
  ]);

  const s = session as unknown as SessionReport["session"] & {
    teaching_log: { lesson_content: string | null }[] | { lesson_content: string | null } | null;
  };
  const log = Array.isArray(s.teaching_log) ? s.teaching_log[0] : s.teaching_log;

  return {
    session: {
      id: s.id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      class: s.class,
      teacher: s.teacher,
    },
    attendance: (attendance.data as { status: string; note: string | null } | null) ?? null,
    comment: (comment.data as { content: string; rating: number | null } | null) ?? null,
    points: (points.data as ClassPointRow[]) ?? [],
    activities: (activities.data as SessionActivityRow[]) ?? [],
    lessons: ((lessons.data ?? []) as unknown as { lesson: SessionReport["lessons"][number] }[])
      .map((r) => r.lesson)
      .filter(Boolean),
    homeworks: (homeworks.data as SessionReport["homeworks"]) ?? [],
    lessonContent: log?.lesson_content ?? null,
  };
}

/** Buổi học gần nhất đã chốt (có chấm công) mà học viên có mặt. */
export async function fetchLatestReportedSession(studentId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("attendance")
    .select("session_id, session:sessions!inner ( date, teaching_log:teaching_logs!inner ( id ) )")
    .eq("student_id", studentId)
    .in("status", ["present", "makeup"])
    .order("date", { referencedTable: "sessions", ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { session_id: string; session: { date: string } }[];
  if (!rows.length) return null;
  return rows.sort((a, b) => (b.session?.date ?? "").localeCompare(a.session?.date ?? ""))[0].session_id;
}

/* ============ Link trình chiếu ============ */

/** Id file trên Google Drive lấy từ mọi kiểu link (Slides, Docs, Drive). */
export function googleFileId(raw: string): string | null {
  return /\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/.exec(raw ?? "")?.[1] ?? null;
}

/**
 * Cách nhúng slide Google:
 *  - `auto`   : tự chọn (file PowerPoint gốc `rtpof=true` → dùng trình xem Drive)
 *  - `slides` : trình xem Google Slides (`/preview`) — mượt nhất với file đã
 *               chuyển sang định dạng Google Trang trình bày
 *  - `drive`  : trình xem Drive (`/file/d/<id>/preview`) — chịu được file
 *               PowerPoint gốc và file nặng mà Slides báo không xem trước được
 */
export type EmbedMode = "auto" | "slides" | "drive" | "office";

export const EMBED_MODE_LABELS: Record<EmbedMode, string> = {
  auto: "Tự động",
  slides: "Google Slides",
  drive: "Trình xem Drive",
  office: "Office (.pptx)",
};

/**
 * Đổi link chia sẻ thông thường thành link NHÚNG được vào iframe — giáo viên
 * chỉ cần copy thẳng link trên thanh địa chỉ (Google Slides/Docs/Sheets/Drive,
 * Canva, YouTube) là chiếu được, không phải đi tìm nút "Nhúng".
 *
 * Lưu ý: link Google vẫn phải được chia sẻ ở chế độ "Bất kỳ ai có đường liên
 * kết" thì máy chiếu (trình duyệt chưa đăng nhập tài khoản đó) mới xem được.
 */
export function toEmbedUrl(raw: string, mode: EmbedMode = "auto"): string {
  let input = (raw ?? "").trim();
  if (!input) return "";
  // Dán nguyên mã nhúng <iframe src="..."> cũng nhận (OneDrive/Canva hay cho kiểu này)
  const inIframe = /<iframe[^>]+src=["']([^"']+)["']/i.exec(input)?.[1];
  if (inIframe) input = inIframe.replace(/&amp;/g, "&");
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return input;
  }
  const host = u.hostname.replace(/^www\./, "");
  const hashSlide = /slide=([^&]+)/.exec(u.hash)?.[1];
  const slide = u.searchParams.get("slide") ?? hashSlide;
  const id = googleFileId(input);
  const isGoogleDoc = host === "docs.google.com" || host === "drive.google.com";

  // Người dùng ép kiểu nhúng (slide nặng / file PowerPoint không xem trước được)
  if (isGoogleDoc && id && mode !== "auto" && !/^\/presentation\/d\/e\//.test(u.pathname)) {
    if (mode === "office") {
      // Trình xem Office Online đọc trực tiếp file .pptx qua link tải của Drive —
      // cứu được file mà Google báo "quá lớn không xem trước được" (chỉ chạy khi
      // file dưới ~100MB, trên mức đó Drive chèn trang cảnh báo quét virus).
      const direct = `https://drive.google.com/uc?export=download&id=${id}`;
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(direct)}`;
    }
    if (mode === "drive") return `https://drive.google.com/file/d/${id}/preview`;
    const base = `https://docs.google.com/presentation/d/${id}/preview`;
    return slide ? `${base}?slide=${slide}` : base;
  }

  if (host === "docs.google.com") {
    // Link "Xuất bản lên web": /presentation/d/e/<id>/pub → /embed
    const published = /^\/presentation\/d\/e\/([^/]+)/.exec(u.pathname);
    if (published) {
      return `https://docs.google.com/presentation/d/e/${published[1]}/embed?start=false&loop=false`;
    }
    const slides = /^\/presentation\/d\/([^/]+)/.exec(u.pathname);
    if (slides) {
      // rtpof=true = file PowerPoint gốc chưa chuyển sang Google Trang trình bày,
      // Slides hay báo "không xem trước được" → nhúng bằng trình xem Drive.
      if (u.searchParams.get("rtpof") === "true") {
        return `https://drive.google.com/file/d/${slides[1]}/preview`;
      }
      const base = `https://docs.google.com/presentation/d/${slides[1]}/preview`;
      return slide ? `${base}?slide=${slide}` : base;
    }
    const doc = /^\/(document|spreadsheets|forms)\/d\/([^/]+)/.exec(u.pathname);
    if (doc) {
      return doc[1] === "forms"
        ? `https://docs.google.com/forms/d/${doc[2]}/viewform?embedded=true`
        : `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
    }
  }

  if (host === "drive.google.com") {
    const file = /^\/file\/d\/([^/]+)/.exec(u.pathname);
    if (file) return `https://drive.google.com/file/d/${file[1]}/preview`;
  }

  if (host === "canva.com") {
    const design = /^\/design\/[^/]+\/[^/]+/.exec(u.pathname);
    if (design) {
      const base = `https://www.canva.com${u.pathname.replace(/\/(edit|view|watch).*$/, "/view")}`;
      return `${base}?embed`;
    }
  }

  if (host === "youtube.com" || host === "youtu.be") {
    const id2 = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
    if (id2) return `https://www.youtube.com/embed/${id2}`;
  }

  return input;
}

/**
 * Link biết chắc là KHÔNG nhúng được vào trang ngoài → trả về lời nhắc cách xử
 * lý, để màn hình trình chiếu chỉ dẫn thay vì hiện iframe trắng/“từ chối kết nối”.
 *
 * OneDrive/SharePoint cá nhân trả `X-Frame-Options: SAMEORIGIN` và CSP
 * `frame-ancestors 'self' *.office.com …` cho link chia sẻ thường — bật “bất kỳ
 * ai có liên kết” cũng không nhúng được; chỉ mã nhúng chính thức (đường dẫn
 * /embed, có authkey) mới cho phép.
 */
export function embedBlockReason(raw: string): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(toEmbedUrl(input));
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const oneDrive = host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith("sharepoint.com");
  if (oneDrive && !/\/embed/.test(u.pathname)) {
    return "Link OneDrive mở trong tab thì được nhưng Microsoft chặn nhúng vào trang ngoài (X-Frame-Options: SAMEORIGIN) — không phải do quyền chia sẻ. Cách giữ nguyên hiệu ứng slide: bấm “Mở cửa sổ trình chiếu”, kéo cửa sổ đó sang máy chiếu rồi bấm Trình chiếu trong PowerPoint Online, còn cửa sổ lớp học để trên laptop (bật nút “Chiếu ngoài” trên thanh trên cùng). Nếu OneDrive có menu Chia sẻ → Nhúng thì copy cả đoạn <iframe…> dán vào ô trên cũng chiếu được trong app.";
  }
  return null;
}

/**
 * Link mở cửa sổ trình chiếu riêng (dự phòng khi nhúng thất bại): Google Slides
 * mở thẳng chế độ trình chiếu, các nguồn khác mở link gốc.
 */
export function presentUrl(raw: string): string {
  const input = (raw ?? "").trim();
  if (!input) return "";
  const id = googleFileId(input);
  if (id && /docs\.google\.com\/presentation/.test(input) && !/\/d\/e\//.test(input)) {
    return `https://docs.google.com/presentation/d/${id}/present`;
  }
  return input;
}
