/**
 * Quy ước đăng nhập bằng mã học viên (dùng chung giữa trang login và
 * API route /api/student-auth):
 * - Mã dạng HVKAT00123, không phân biệt hoa thường khi nhập.
 * - Mỗi mã ứng với một tài khoản email ảo <mã>@hocvien.katclass.vn,
 *   được API tạo tự động ở lần đăng nhập đầu với mật khẩu mặc định.
 */

export const DEFAULT_STUDENT_PASSWORD = "kat12345";

/** "hvkat 00123" → "HVKAT00123" */
export function normalizeStudentCode(raw: string): string {
  return raw.replace(/[\s\-.]/g, "").toUpperCase();
}

export function isStudentCode(code: string): boolean {
  return /^HVKAT\d{1,10}$/.test(code);
}

/** Email ảo gắn với mã học viên (chỉ dùng nội bộ, không gửi mail). */
export function studentCodeEmail(code: string): string {
  return `${code.toLowerCase()}@hocvien.katclass.vn`;
}
