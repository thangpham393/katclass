import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_STUDENT_PASSWORD,
  isStudentCode,
  normalizeStudentCode,
  studentCodeEmail,
} from "@/lib/student-login";

/**
 * Đổi mã học viên → email đăng nhập.
 * Lần đầu (hồ sơ chưa có tài khoản): tạo tài khoản email ảo với mật khẩu
 * mặc định kat12345 rồi nối vào hồ sơ. Các lần sau: trả về email của
 * tài khoản đã liên kết để client đăng nhập bằng mật khẩu.
 * Chạy bằng service role (chỉ phía server) — cần env SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(req: Request) {
  let code: string;
  try {
    const body = await req.json();
    code = normalizeStudentCode(String(body?.code ?? ""));
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }

  if (!isStudentCode(code)) {
    return NextResponse.json(
      { error: "Mã học viên không hợp lệ — mã có dạng HVKAT00123." },
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
      .select("id, user_id, name, role")
      .eq("student_code", code)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile || profile.role !== "student") {
      return NextResponse.json(
        { error: "Không tìm thấy học viên với mã này. Kiểm tra lại mã trên biên lai/thẻ học viên." },
        { status: 404 },
      );
    }

    // Đã có tài khoản → trả email để client đăng nhập bằng mật khẩu
    if (profile.user_id) {
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(profile.user_id);
      if (uErr) throw uErr;
      const providers = (u.user?.app_metadata?.providers as string[] | undefined) ?? [];
      return NextResponse.json({
        email: u.user?.email ?? studentCodeEmail(code),
        hasPassword: providers.includes("email"),
      });
    }

    // Lần đầu: tạo tài khoản với mật khẩu mặc định
    const email = studentCodeEmail(code);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_STUDENT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: profile.name },
    });

    let userId = created?.user?.id;
    if (cErr) {
      // Tài khoản ảo đã tồn tại từ lần chạy dở trước → nhận diện qua đăng nhập mặc định
      const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signin } = await anon.auth.signInWithPassword({
        email,
        password: DEFAULT_STUDENT_PASSWORD,
      });
      if (!signin?.user) throw cErr;
      userId = signin.user.id;
    }

    // Trigger đăng ký có thể đã tự tạo hồ sơ student thừa cho email ảo → dọn,
    // rồi nối tài khoản vào đúng hồ sơ mang mã học viên
    await admin.from("profiles").delete().eq("user_id", userId!).neq("id", profile.id);
    const { error: linkErr } = await admin
      .from("profiles")
      .update({ user_id: userId })
      .eq("id", profile.id);
    if (linkErr) throw linkErr;

    return NextResponse.json({ email, hasPassword: true, firstLogin: true });
  } catch (e) {
    console.error("student-auth:", e);
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi xử lý mã học viên. Thử lại sau." },
      { status: 500 },
    );
  }
}
