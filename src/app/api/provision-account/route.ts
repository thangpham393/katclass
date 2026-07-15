import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LOGIN_PASSWORD, codeEmail, isLoginCode } from "@/lib/student-login";

/**
 * Cấp tài khoản đăng nhập cho một hồ sơ (học viên/giáo viên/nhân viên):
 * tạo tài khoản email ảo gắn với mã thành viên, mật khẩu mặc định
 * kat12345, rồi nối vào hồ sơ. CHỈ staff/admin đang đăng nhập gọi được.
 * Cần env SUPABASE_SERVICE_ROLE_KEY (chỉ phía server).
 */
export async function POST(req: Request) {
  let profileId: string;
  try {
    const body = await req.json();
    profileId = String(body?.profileId ?? "");
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!profileId) {
    return NextResponse.json({ error: "Thiếu profileId." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server chưa cấu hình SUPABASE_SERVICE_ROLE_KEY — thêm env rồi deploy lại." },
      { status: 500 },
    );
  }

  try {
    // Người gọi phải là staff/admin (đọc phiên đăng nhập từ cookie)
    const cookieStore = await cookies();
    const authClient = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data: { user: caller } } = await authClient.auth.getUser();
    if (!caller) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("user_id", caller.id).maybeSingle();
    if (!callerProfile || !["staff", "admin"].includes(callerProfile.role)) {
      return NextResponse.json(
        { error: "Chỉ quản trị / nhân viên hành chính được cấp tài khoản." },
        { status: 403 },
      );
    }

    // Hồ sơ cần cấp tài khoản
    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("id, user_id, name, role, student_code")
      .eq("id", profileId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    }
    if (target.user_id) {
      return NextResponse.json({ code: target.student_code, already: true });
    }
    const code = target.student_code ?? "";
    if (!isLoginCode(code)) {
      return NextResponse.json(
        { error: "Hồ sơ chưa có mã thành viên hợp lệ — kiểm tra đã chạy migration 0007 + 0008 chưa." },
        { status: 400 },
      );
    }

    // Tạo tài khoản với mật khẩu mặc định
    const email = codeEmail(code);
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_LOGIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: target.name },
    });

    let userId = created?.user?.id;
    if (cErr) {
      // Tài khoản đã tồn tại từ lần cấp dở trước → nhận diện qua mật khẩu mặc định
      const anon = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signin } = await anon.auth.signInWithPassword({
        email,
        password: DEFAULT_LOGIN_PASSWORD,
      });
      if (!signin?.user) {
        return NextResponse.json(
          { error: `Tài khoản của mã ${code} đã tồn tại nhưng chưa nối được vào hồ sơ — liên hệ hỗ trợ kỹ thuật.` },
          { status: 409 },
        );
      }
      userId = signin.user.id;
    }

    // Trigger đăng ký có thể tự tạo hồ sơ thừa cho email ảo → dọn, rồi nối
    await admin.from("profiles").delete().eq("user_id", userId!).neq("id", target.id);
    const { error: linkErr } = await admin
      .from("profiles").update({ user_id: userId }).eq("id", target.id);
    if (linkErr) throw linkErr;

    return NextResponse.json({ code });
  } catch (e) {
    console.error("provision-account:", e);
    return NextResponse.json(
      { error: "Có lỗi khi cấp tài khoản. Thử lại sau." },
      { status: 500 },
    );
  }
}
