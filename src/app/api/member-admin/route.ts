import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";

/**
 * Quản lý tài khoản thành viên (chỉ staff/admin đang đăng nhập):
 * - reset-password: đặt lại mật khẩu về mặc định kat12345
 * - delete: xóa hồ sơ + tài khoản đăng nhập
 * Phân quyền: staff không được động vào hồ sơ staff/admin (chống chiếm
 * quyền); không ai tự xóa chính mình.
 */
export async function POST(req: Request) {
  let action: string, profileId: string;
  try {
    const body = await req.json();
    action = String(body?.action ?? "");
    profileId = String(body?.profileId ?? "");
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!profileId || !["reset-password", "delete"].includes(action)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
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
    // Xác thực người gọi từ cookie phiên
    const cookieStore = await cookies();
    const authClient = createServerClient(url, anonKey, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    });
    const { data: { user: caller } } = await authClient.auth.getUser();
    if (!caller) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await admin
      .from("profiles").select("id, role").eq("user_id", caller.id).maybeSingle();
    if (!callerProfile || !["staff", "admin"].includes(callerProfile.role)) {
      return NextResponse.json(
        { error: "Chỉ quản trị / nhân viên hành chính được thao tác." },
        { status: 403 },
      );
    }

    const { data: target, error: tErr } = await admin
      .from("profiles")
      .select("id, user_id, name, role, student_code")
      .eq("id", profileId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    }

    // Staff không được động vào staff/admin khác
    if (["staff", "admin"].includes(target.role) && callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Chỉ quản trị viên được thao tác trên hồ sơ nhân viên / quản trị." },
        { status: 403 },
      );
    }

    if (action === "reset-password") {
      if (!target.user_id) {
        return NextResponse.json(
          { error: "Hồ sơ này chưa có tài khoản đăng nhập — hãy cấp tài khoản trước." },
          { status: 400 },
        );
      }
      const { error } = await admin.auth.admin.updateUserById(target.user_id, {
        password: DEFAULT_LOGIN_PASSWORD,
      });
      if (error) throw error;
      return NextResponse.json({ code: target.student_code });
    }

    // action === "delete"
    if (target.id === callerProfile.id) {
      return NextResponse.json({ error: "Không thể tự xóa chính mình." }, { status: 400 });
    }
    const { error: delErr } = await admin.from("profiles").delete().eq("id", profileId);
    if (delErr) {
      if (delErr.code === "23503") {
        return NextResponse.json(
          {
            error:
              "Không xóa được: thành viên còn dữ liệu gắn kèm (đang phụ trách lớp, đã điểm danh/nhận xét...). " +
              "Gỡ khỏi lớp hoặc đổi giáo viên phụ trách trước, hoặc để hồ sơ ở trạng thái không hoạt động.",
          },
          { status: 409 },
        );
      }
      throw delErr;
    }
    if (target.user_id) {
      // Hồ sơ đã xóa xong → xóa luôn tài khoản đăng nhập
      await admin.auth.admin.deleteUser(target.user_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("member-admin:", e);
    return NextResponse.json(
      { error: "Có lỗi xảy ra. Thử lại sau." },
      { status: 500 },
    );
  }
}
