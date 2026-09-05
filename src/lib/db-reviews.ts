"use client";

/**
 * NHẬN XÉT TỔNG KẾT THEO KỲ (migration 0043) + đọc lại nhận xét từng buổi
 * cho khu quản trị.
 *
 * Nhận xét từng buổi (`session_comments`) trả lời "hôm nay con thế nào";
 * bảng này trả lời "một tháng / một khóa vừa rồi con thế nào" — thứ phụ
 * huynh thực sự hỏi khi đóng tiền kỳ tiếp theo.
 *
 * Số liệu chuyên cần / ★ / điểm trung bình được TÍNH SẴN ở client
 * (`summarizePeriod`) để giáo viên chỉ việc đọc rồi viết lời, và được
 * CHỐT LẠI vào cột `stats` khi phát hành — bản đã gửi cho nhà thì không
 * được đổi số theo dữ liệu buổi sửa về sau.
 */

import { getSupabase } from "./supabase";

export interface ReviewStats {
  sessions: number;
  present: number;
  absent: number;
  stars: number;
  avg_rating: number | null;
  comments: number;
}

export const EMPTY_STATS: ReviewStats = {
  sessions: 0,
  present: 0,
  absent: 0,
  stars: 0,
  avg_rating: null,
  comments: 0,
};

export interface StudentReviewRow {
  id: string;
  student_id: string;
  class_id: string | null;
  period_start: string;
  period_end: string;
  title: string;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  content: string | null;
  stats: Partial<ReviewStats> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  teacher: { id: string; name: string; avatar: string | null } | null;
  student?: { id: string; name: string; avatar: string | null; student_code: string | null } | null;
  class?: { id: string; name: string } | null;
}

const SELECT = `
  id, student_id, class_id, period_start, period_end, title, rating,
  strengths, improvements, content, stats, published_at, created_at, updated_at,
  teacher:profiles!student_reviews_teacher_id_fkey ( id, name, avatar ),
  student:profiles!student_reviews_student_id_fkey ( id, name, avatar, student_code ),
  class:classes ( id, name )
`;

/* ================= Đọc ================= */

/** Nhận xét tổng kết của một học viên. RLS đã lọc bản nháp cho HV/PH. */
export async function fetchStudentReviews(studentId: string, limit = 12) {
  const { data, error } = await getSupabase()
    .from("student_reviews")
    .select(SELECT)
    .eq("student_id", studentId)
    .order("period_end", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as StudentReviewRow[];
}

/** Danh sách cho khu quản trị / giáo viên, lọc mềm theo lớp - GV - kỳ. */
export async function fetchReviews(filter: {
  classId?: string | null;
  teacherId?: string | null;
  studentId?: string | null;
  from?: string | null;
  to?: string | null;
  onlyDrafts?: boolean;
  limit?: number;
}) {
  let q = getSupabase()
    .from("student_reviews")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.classId) q = q.eq("class_id", filter.classId);
  if (filter.teacherId) q = q.eq("teacher_id", filter.teacherId);
  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  if (filter.from) q = q.gte("period_end", filter.from);
  if (filter.to) q = q.lte("period_start", filter.to);
  if (filter.onlyDrafts) q = q.is("published_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as StudentReviewRow[];
}

/* ================= Ghi ================= */

export interface ReviewInput {
  id?: string;
  student_id: string;
  class_id: string | null;
  teacher_id: string;
  period_start: string;
  period_end: string;
  title: string;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  content: string | null;
  stats?: ReviewStats | null;
  /** true = phát hành ngay (bắn thông báo cho học viên + phụ huynh). */
  publish?: boolean;
}

export async function saveReview(input: ReviewInput): Promise<string> {
  const { id, publish, ...rest } = input;
  const row = {
    ...rest,
    stats: rest.stats ?? EMPTY_STATS,
    ...(publish ? { published_at: new Date().toISOString() } : {}),
  };
  const q = getSupabase().from("student_reviews");
  const { data, error } = id
    ? await q.update(row).eq("id", id).select("id").single()
    : await q.insert(row).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Phát hành một bản nháp có sẵn. Đã phát hành rồi thì trigger không báo lại. */
export async function publishReview(id: string, stats?: ReviewStats) {
  const { error } = await getSupabase()
    .from("student_reviews")
    .update({
      published_at: new Date().toISOString(),
      ...(stats ? { stats } : {}),
    })
    .eq("id", id)
    .is("published_at", null);
  if (error) throw error;
}

export async function deleteReview(id: string) {
  const { error } = await getSupabase().from("student_reviews").delete().eq("id", id);
  if (error) throw error;
}

/* ================= Số liệu gợi ý ================= */

/**
 * Tổng hợp một kỳ của một học viên: đi học mấy buổi, vắng mấy, được bao
 * nhiêu ★, điểm sao trung bình giáo viên chấm từng buổi.
 *
 * Ba query song song thay vì một view SQL — cùng lý do đã ghi ở
 * `db-alumni.ts`: dữ liệu có sẵn, view là thêm thứ phải bảo trì.
 */
export async function summarizePeriod(
  studentId: string,
  from: string,
  to: string,
): Promise<ReviewStats> {
  const supabase = getSupabase();
  const [att, pts, cmt] = await Promise.all([
    supabase
      .from("attendance")
      .select("status, session:sessions!inner ( date )")
      .eq("student_id", studentId)
      .gte("session.date", from)
      .lte("session.date", to),
    supabase
      .from("class_points")
      .select("points, session:sessions!inner ( date )")
      .eq("student_id", studentId)
      .gte("session.date", from)
      .lte("session.date", to),
    supabase
      .from("session_comments")
      .select("rating, session:sessions!inner ( date )")
      .eq("student_id", studentId)
      .gte("session.date", from)
      .lte("session.date", to),
  ]);
  for (const r of [att, pts, cmt]) if (r.error) throw r.error;

  const rows = (att.data ?? []) as { status: string }[];
  const ratings = ((cmt.data ?? []) as { rating: number | null }[])
    .map((c) => c.rating)
    .filter((r): r is number => r != null);

  return {
    sessions: rows.length,
    present: rows.filter((r) => r.status === "present" || r.status === "makeup").length,
    absent: rows.filter((r) => r.status.startsWith("absent")).length,
    stars: ((pts.data ?? []) as { points: number }[]).reduce((s, p) => s + p.points, 0),
    avg_rating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    comments: (cmt.data ?? []).length,
  };
}

/**
 * Dàn ý gợi ý từ chính số liệu — giáo viên sửa lời cho hợp học viên, đỡ
 * phải ngồi trước trang trắng. Cố ý viết mộc, không tâng bốc.
 */
export function suggestReview(name: string, s: ReviewStats): {
  strengths: string;
  improvements: string;
  content: string;
} {
  const rate = s.sessions ? Math.round((s.present / s.sessions) * 100) : 0;
  const strengths: string[] = [];
  if (rate >= 90) strengths.push("đi học đều");
  if (s.stars >= 20) strengths.push(`tích cực phát biểu (${s.stars}★ trong kỳ)`);
  else if (s.stars > 0) strengths.push(`có tham gia xây dựng bài (${s.stars}★)`);
  if (s.avg_rating != null && s.avg_rating >= 4) strengths.push("giữ được phong độ đều các buổi");

  const improvements: string[] = [];
  if (s.absent >= 3) improvements.push(`vắng ${s.absent} buổi, cần đi học đều hơn`);
  if (s.stars === 0) improvements.push("còn ít phát biểu, nên mạnh dạn hơn trong giờ");
  if (s.avg_rating != null && s.avg_rating < 3) improvements.push("cần ôn lại bài trước khi đến lớp");

  return {
    strengths: strengths.length ? capitalize(strengths.join(", ")) + "." : "",
    improvements: improvements.length ? capitalize(improvements.join("; ")) + "." : "",
    content: s.sessions
      ? `Trong kỳ, ${name} học ${s.sessions} buổi, có mặt ${s.present} buổi (${rate}%)` +
        (s.avg_rating != null ? `, điểm buổi trung bình ${s.avg_rating}/5` : "") +
        "."
      : "",
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ================= Nhận xét từng buổi — cho khu quản trị ================= */

export interface SessionCommentAdminRow {
  id: string;
  content: string;
  rating: number | null;
  created_at: string;
  student: { id: string; name: string; avatar: string | null } | null;
  teacher: { id: string; name: string; avatar: string | null } | null;
  session: { id: string; date: string; class: { id: string; name: string } | null } | null;
}

/** Nhật ký nhận xét từng buổi để quản lý soi chất lượng: ai viết, viết gì. */
export async function fetchSessionComments(filter: {
  teacherId?: string | null;
  studentId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}) {
  let q = getSupabase()
    .from("session_comments")
    .select(`
      id, content, rating, created_at,
      student:profiles!session_comments_student_id_fkey ( id, name, avatar ),
      teacher:profiles!session_comments_teacher_id_fkey ( id, name, avatar ),
      session:sessions!inner ( id, date, class:classes ( id, name ) )
    `)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.teacherId) q = q.eq("teacher_id", filter.teacherId);
  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  if (filter.from) q = q.gte("session.date", filter.from);
  if (filter.to) q = q.lte("session.date", filter.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SessionCommentAdminRow[];
}
