/**
 * Quy ước đăng nhập bằng mã thành viên (dùng chung giữa trang login,
 * trang admin và các API route):
 * - Mã do admin cấp: HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân
 *   viên hành chính), QLKAT (quản trị) + số thứ tự, vd HVKAT00123.
 * - Admin "cấp tài khoản" (API /api/provision-account) → hệ thống tạo
 *   tài khoản email ảo gắn với mã, mật khẩu mặc định kat12345.
 * - Người dùng đổi mật khẩu sau khi vào hệ thống (/account/password).
 */

export const DEFAULT_LOGIN_PASSWORD = "kat12345";

const LOGIN_CODE_RE = /^(HVKAT|GVKAT|NVKAT|QLKAT)\d{1,10}$/;

/** "hvkat 00123" → "HVKAT00123" */
export function normalizeLoginCode(raw: string): string {
  return raw.replace(/[\s\-.]/g, "").toUpperCase();
}

export function isLoginCode(code: string): boolean {
  return LOGIN_CODE_RE.test(code);
}

/** Email ảo gắn với mã (chỉ dùng nội bộ, không gửi mail). */
export function codeEmail(code: string): string {
  const c = code.toLowerCase();
  return c.startsWith("hvkat")
    ? `${c}@hocvien.katclass.vn`
    : `${c}@noibo.katclass.vn`;
}
