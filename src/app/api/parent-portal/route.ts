import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * CỔNG PHỤ HUYNH KHÔNG CẦN TÀI KHOẢN (migration 0041).
 *
 * Trang /parent/s/<token> là trang công khai, nên không thể để nó tự
 * truy vấn Supabase bằng khóa anon (RLS sẽ chặn, mà nới RLS cho anon thì
 * hở toàn bộ dữ liệu). Thay vào đó mọi thứ đi qua route này:
 *   1. token phải tồn tại và đang bật;
 *   2. 4 số cuối phải khớp SĐT phụ huynh đã liên kết (hoặc SĐT học viên);
 *   3. chỉ khi đó mới đọc bằng service role, và chỉ đúng phần được xem.
 *
 * Nhập sai bị chặn dần theo token để không dò được 4 số bằng cách thử
 * 10.000 lần (bộ đếm nằm trong RAM tiến trình — đủ cho một server Next,
 * và mất khi restart thì cũng chỉ là mất lịch sử chặn).
 */

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function tooManyAttempts(token: string): boolean {
  const rec = attempts.get(token);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(token);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function noteFailure(token: string) {
  const rec = attempts.get(token);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(token, { count: 1, first: Date.now() });
  } else {
    rec.count++;
  }
}

/** "0912 345 678" → "5678"; rỗng nếu không đủ 4 chữ số. */
function last4(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  let token = "";
  let code = "";
  try {
    const body = await req.json();
    token = String(body?.token ?? "").trim();
    code = String(body?.last4 ?? "").replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Đường dẫn không hợp lệ." }, { status: 400 });
  }
  if (code.length !== 4) {
    return NextResponse.json({ error: "Nhập đủ 4 số cuối điện thoại." }, { status: 400 });
  }
  if (tooManyAttempts(token)) {
    return NextResponse.json(
      { error: "Nhập sai quá nhiều lần. Thử lại sau 10 phút hoặc liên hệ trung tâm." },
      { status: 429 },
    );
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY — liên hệ quản trị." },
      { status: 500 },
    );
  }

  try {
    const { data: link, error: linkErr } = await admin
      .from("parent_share_links")
      .select("student_id, enabled, view_count")
      .eq("token", token)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link || !link.enabled) {
      return NextResponse.json(
        { error: "Đường dẫn không còn hiệu lực. Liên hệ trung tâm để nhận đường dẫn mới." },
        { status: 404 },
      );
    }

    const studentId = link.student_id as string;

    const { data: student, error: sErr } = await admin
      .from("profiles")
      .select(
        "id, name, student_code, avatar, phone, enrolled_at, study_status, left_at, branch:branches (name, phone, address)",
      )
      .eq("id", studentId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!student) {
      return NextResponse.json({ error: "Không tìm thấy học viên." }, { status: 404 });
    }

    const { data: parentLinks, error: pErr } = await admin
      .from("parent_students")
      .select("relationship, parent:profiles!parent_students_parent_id_fkey (name, phone)")
      .eq("student_id", studentId);
    if (pErr) throw pErr;

    type ParentRow = { relationship: string; parent: { name: string; phone: string | null } | null };
    const parents = (parentLinks ?? []) as unknown as ParentRow[];

    // Khớp 4 số cuối: SĐT phụ huynh nào cũng được, hoặc SĐT của chính
    // học viên (nhiều em lớn tự đăng ký, chưa nhập hồ sơ phụ huynh).
    const matched =
      parents.find((p) => last4(p.parent?.phone) === code) ??
      (last4(student.phone) === code ? null : undefined);
    if (matched === undefined) {
      noteFailure(token);
      return NextResponse.json({ error: "Số điện thoại không đúng." }, { status: 401 });
    }
    attempts.delete(token);

    const data = await loadPortalData(admin, studentId);

    await admin
      .from("parent_share_links")
      .update({
        last_viewed_at: new Date().toISOString(),
        view_count: (link.view_count ?? 0) + 1,
      })
      .eq("student_id", studentId);

    type Branch = { name: string; phone: string | null };
    const embedded = student.branch as unknown as Branch | Branch[] | null;
    const branch = Array.isArray(embedded) ? embedded[0] ?? null : embedded;

    return NextResponse.json({
      student: {
        name: student.name,
        code: student.student_code,
        avatar: student.avatar,
        enrolled_at: student.enrolled_at,
        study_status: student.study_status,
        left_at: student.left_at,
      },
      center: branch ? { name: branch.name, phone: branch.phone } : null,
      viewer: matched
        ? { name: matched.parent?.name ?? "", relationship: matched.relationship }
        : null,
      ...data,
    });
  } catch (e) {
    console.error("parent-portal:", e);
    return NextResponse.json({ error: "Có lỗi xảy ra. Thử lại sau." }, { status: 500 });
  }
}

/* ================= Dữ liệu hiển thị cho phụ huynh ================= */

/**
 * Gom đủ những gì phụ huynh muốn biết về việc học của con, gộp quanh
 * TỪNG BUỔI (ngày nào, học bài gì, cô nhận xét ra sao, được mấy sao) —
 * vì đó mới là thứ trả lời câu "hôm nay con học thế nào", chứ không
 * phải mấy con số tổng.
 *
 * Chi tiết chỉ lấy cho `DETAIL_LIMIT` buổi gần nhất; phần đếm tổng vẫn
 * tính trên toàn bộ điểm danh để số liệu không lệch.
 */
const DETAIL_LIMIT = 60;

type SessionRow = {
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  class: { name: string } | null;
  teacher: { name: string } | null;
};

async function loadPortalData(admin: SupabaseClient, studentId: string) {
  const [pkgRes, remainRes, clsRes, ownRes, attRes, payRes, pointsRes] = await Promise.all([
    admin
      .from("enrollment_packages")
      .select("id, name, total_sessions, start_date")
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("start_date"),
    admin.rpc("student_sessions_remaining", { sid: studentId }),
    admin
      .from("class_students")
      .select(
        "status, class:classes (id, name, status, schedules:class_schedules (weekday, start_time, end_time))",
      )
      .eq("student_id", studentId),
    admin
      .from("student_schedules")
      .select("weekday, start_time, end_time")
      .eq("student_id", studentId)
      .order("weekday"),
    admin
      .from("attendance")
      .select(
        "session_id, status, session:sessions (date, start_time, end_time, status, class:classes (name), teacher:profiles!sessions_teacher_id_fkey (name))",
      )
      .eq("student_id", studentId)
      .limit(500),
    admin
      .from("payments")
      .select("amount, paid_at, receipt_no, package:enrollment_packages (name)")
      .eq("student_id", studentId)
      .order("paid_at", { ascending: false })
      .limit(50),
    admin
      .from("class_points")
      .select("session_id, points")
      .eq("student_id", studentId)
      .limit(2000),
  ]);

  for (const r of [pkgRes, remainRes, clsRes, ownRes, attRes, payRes, pointsRes]) {
    if (r.error) throw r.error;
  }

  type ClassRow = {
    status: string;
    class: {
      id: string;
      name: string;
      status: string;
      schedules: { weekday: number; start_time: string; end_time: string }[] | null;
    } | null;
  };
  type AttRow = { session_id: string; status: string; session: SessionRow | null };

  const packages = (pkgRes.data ?? []) as {
    name: string;
    total_sessions: number;
    start_date: string;
  }[];
  const totalSessions = packages.reduce((s, p) => s + (p.total_sessions ?? 0), 0);
  const remaining = (remainRes.data as number | null) ?? null;

  const attendance = ((attRes.data ?? []) as unknown as AttRow[])
    .filter((a) => a.session && a.session.status !== "cancelled")
    .sort((x, y) => (x.session!.date < y.session!.date ? 1 : x.session!.date > y.session!.date ? -1 : 0));

  // "Đã học" = số buổi bị trừ khỏi gói. Đếm đúng như hàm SQL
  // student_sessions_remaining (chỉ tính từ ngày kích hoạt gói đầu tiên),
  // nếu không thì "đã học" và "còn lại" sẽ đá nhau với học viên từng học
  // trước khi mua gói.
  const firstStart = packages[0]?.start_date ?? null;
  const charged = attendance.filter(
    (a) =>
      ["present", "absent_excused", "absent_unexcused"].includes(a.status) &&
      (!firstStart || a.session!.date >= firstStart),
  ).length;

  const attendedCount = attendance.filter(
    (a) => a.status === "present" || a.status === "makeup",
  ).length;
  const absentCount = attendance.length - attendedCount;

  const detail = attendance.slice(0, DETAIL_LIMIT);
  const sessionIds = detail.map((a) => a.session_id);

  const classIds = ((clsRes.data ?? []) as unknown as ClassRow[])
    .map((c) => c.class?.id)
    .filter((id): id is string => !!id);

  const [commentRes, logRes, lessonRes, hwRes] = await Promise.all([
    sessionIds.length
      ? admin
          .from("session_comments")
          .select("session_id, content, rating, teacher:profiles!session_comments_teacher_id_fkey (name)")
          .eq("student_id", studentId)
          .in("session_id", sessionIds)
      : emptyResult(),
    sessionIds.length
      ? admin
          .from("teaching_logs")
          .select("session_id, lesson_content")
          .in("session_id", sessionIds)
      : emptyResult(),
    sessionIds.length
      ? admin
          .from("session_lessons")
          .select("session_id, lesson:lessons (title, title_zh, summary)")
          .in("session_id", sessionIds)
      : emptyResult(),
    classIds.length
      ? admin
          .from("homeworks")
          .select("id, title, kind, due_at, created_at")
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .limit(60)
      : emptyResult(),
  ]);
  for (const r of [commentRes, logRes, lessonRes, hwRes]) {
    if (r.error) throw r.error;
  }

  const homeworks = (hwRes.data ?? []) as {
    id: string;
    title: string;
    kind: string;
    due_at: string | null;
    created_at: string;
  }[];

  const subRes = homeworks.length
    ? await admin
        .from("submissions")
        .select("homework_id, score, auto_score, status, submitted_at")
        .eq("student_id", studentId)
        .in("homework_id", homeworks.map((h) => h.id))
    : await emptyResult();
  if (subRes.error) throw subRes.error;

  /* --- gom theo buổi --- */

  const comments = new Map<string, { content: string; rating: number | null; teacher: string | null }>();
  for (const c of (commentRes.data ?? []) as unknown as {
    session_id: string;
    content: string;
    rating: number | null;
    teacher: { name: string } | null;
  }[]) {
    comments.set(c.session_id, {
      content: c.content,
      rating: c.rating,
      teacher: c.teacher?.name ?? null,
    });
  }

  const logs = new Map<string, string>();
  for (const l of (logRes.data ?? []) as { session_id: string; lesson_content: string | null }[]) {
    if (l.lesson_content) logs.set(l.session_id, l.lesson_content);
  }

  const lessons = new Map<string, { title: string; title_zh: string | null; summary: string | null }[]>();
  for (const l of (lessonRes.data ?? []) as unknown as {
    session_id: string;
    lesson: { title: string; title_zh: string | null; summary: string | null } | null;
  }[]) {
    if (!l.lesson) continue;
    const list = lessons.get(l.session_id) ?? [];
    list.push(l.lesson);
    lessons.set(l.session_id, list);
  }

  const pointsRows = (pointsRes.data ?? []) as { session_id: string; points: number }[];
  const starsBySession = new Map<string, number>();
  let starsTotal = 0;
  for (const p of pointsRows) {
    starsTotal += p.points;
    starsBySession.set(p.session_id, (starsBySession.get(p.session_id) ?? 0) + p.points);
  }

  const submissions = new Map<
    string,
    { score: number | null; status: string; submitted_at: string }
  >();
  for (const s of (subRes.data ?? []) as {
    homework_id: string;
    score: number | null;
    auto_score: number | null;
    status: string;
    submitted_at: string;
  }[]) {
    submissions.set(s.homework_id, {
      score: s.score ?? s.auto_score,
      status: s.status,
      submitted_at: s.submitted_at,
    });
  }

  const sessions = detail.map((a) => ({
    date: a.session!.date,
    start_time: a.session!.start_time,
    end_time: a.session!.end_time,
    class_name: a.session!.class?.name ?? null,
    teacher_name: comments.get(a.session_id)?.teacher ?? a.session!.teacher?.name ?? null,
    status: a.status,
    lessons: lessons.get(a.session_id) ?? [],
    lesson_content: logs.get(a.session_id) ?? null,
    comment: comments.get(a.session_id)?.content ?? null,
    rating: comments.get(a.session_id)?.rating ?? null,
    stars: starsBySession.get(a.session_id) ?? 0,
  }));

  const assignments = homeworks.map((h) => {
    const sub = submissions.get(h.id) ?? null;
    return {
      title: h.title,
      kind: h.kind,
      due_at: h.due_at,
      created_at: h.created_at,
      score: sub?.score ?? null,
      status: sub ? sub.status : "missing",
      submitted_at: sub?.submitted_at ?? null,
    };
  });

  const scored = assignments.filter((a) => typeof a.score === "number");
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, a) => s + (a.score as number), 0) / scored.length) * 10) / 10
    : null;

  const classes = ((clsRes.data ?? []) as unknown as ClassRow[])
    .filter((c) => c.class && c.status === "active" && c.class.status !== "cancelled")
    .map((c) => ({
      name: c.class!.name,
      schedules: (c.class!.schedules ?? []).map((s) => ({
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    }));

  return {
    progress: {
      has_package: packages.length > 0,
      total_sessions: totalSessions,
      used: charged,
      remaining: remaining ?? Math.max(0, totalSessions - charged),
      packages: packages.map((p) => ({ name: p.name, total_sessions: p.total_sessions })),
    },
    stats: {
      attended: attendedCount,
      absent: absentCount,
      stars: starsTotal,
      avg_score: avgScore,
    },
    classes,
    own_schedules: (ownRes.data ?? []) as {
      weekday: number;
      start_time: string;
      end_time: string | null;
    }[],
    sessions,
    assignments,
    payments: ((payRes.data ?? []) as unknown as {
      amount: number;
      paid_at: string;
      receipt_no: string;
      package: { name: string } | null;
    }[]).map((p) => ({
      amount: Number(p.amount),
      paid_at: p.paid_at,
      receipt_no: p.receipt_no,
      package_name: p.package?.name ?? null,
    })),
  };
}

/** Trả về "kết quả rỗng" cùng hình dạng với PostgrestResponse để chỗ gọi khỏi rẽ nhánh. */
function emptyResult() {
  return Promise.resolve({ data: [] as never[], error: null });
}
