import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isLoginCode, normalizeLoginCode } from "@/lib/student-login";

/**
 * Đổi mã thành viên (HVKAT/GVKAT/NVKAT/QLKAT) → email đăng nhập.
 * KHÔNG tự tạo tài khoản: hồ sơ chưa được admin cấp tài khoản thì trả lỗi.
 * Chạy bằng service role (chỉ phía server) — cần env SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  let code: string;
  try {
    const body = await req.json();
    code = normalizeLoginCode(String(body?.code ?? ""));
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  if (!isLoginCode(code)) {
    return NextResponse.json(
      { error: "Mã không hợp lệ — mã có dạng HVKAT00123 (học viên) hoặc GVKAT/NVKAT (đội ngũ)." },
      { status: 400 },
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
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, user_id, role")
      .eq("student_code", code)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) {
      return NextResponse.json(
        { error: "Không tìm thấy thành viên với mã này. Kiểm tra lại mã được trung tâm cấp." },
        { status: 404 },
      );
    }
    if (!profile.user_id) {
      return NextResponse.json(
        { error: "Mã này chưa được cấp tài khoản đăng nhập — liên hệ trung tâm KAT để được cấp." },
        { status: 403 },
      );
    }

    const { data: u, error: uErr } = await admin.auth.admin.getUserById(profile.user_id);
    if (uErr) throw uErr;
    const providers = (u.user?.app_metadata?.providers as string[] | undefined) ?? [];
    return NextResponse.json({
      email: u.user?.email,
      hasPassword: providers.includes("email"),
    });
  } catch (e) {
    console.error("student-auth:", e);
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi xử lý mã. Thử lại sau." },
      { status: 500 },
    );
  }
}
