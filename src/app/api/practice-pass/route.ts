import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeLoginCode } from "@/lib/student-login";
import { PRACTICE_COOKIE, PRACTICE_PASS_DAYS, signPracticePass } from "@/lib/practice-pass";

/**
 * Cấp vé vào khu luyện tập /luyen-tap khi học viên nhập đúng mã HVKAT.
 * Chỉ nhận học viên đang học hoặc bảo lưu (study_status khác 'left').
 * Mã có dạng tuần tự nên chặn dò theo IP (bộ đếm trong RAM, như parent-portal).
 */

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function tooManyAttempts(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function noteFailure(ip: string) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: Date.now() });
  } else {
    rec.count++;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  let code: string;
  try {
    const body = await req.json();
    code = normalizeLoginCode(String(body?.code ?? ""));
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  if (!/^HVKAT\d{1,10}$/.test(code)) {
    return NextResponse.json(
      { error: "Mã học viên có dạng HVKAT00123 — xem lại mã trung tâm đã cấp." },
      { status: 400 },
    );
  }
  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: "Nhập sai quá nhiều lần. Thử lại sau 10 phút hoặc liên hệ trung tâm." },
      { status: 429 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY — liên hệ quản trị." },
      { status: 500 },
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, role, study_status")
      .eq("student_code", code)
      .maybeSingle();
    if (error) throw error;
    if (!profile || profile.role !== "student") {
      noteFailure(ip);
      return NextResponse.json(
        { error: "Không tìm thấy học viên với mã này. Kiểm tra lại mã được trung tâm cấp." },
        { status: 404 },
      );
    }
    if (profile.study_status === "left") {
      return NextResponse.json(
        { error: "Mã này thuộc học viên đã nghỉ học — liên hệ trung tâm KAT để mở lại." },
        { status: 403 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(PRACTICE_COOKIE, await signPracticePass(code), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PRACTICE_PASS_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    console.error("practice-pass:", e);
    return NextResponse.json({ error: "Có lỗi xảy ra khi kiểm tra mã. Thử lại sau." }, { status: 500 });
  }
}
