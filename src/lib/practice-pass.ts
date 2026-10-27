/**
 * "Vé" vào khu luyện tập HSK tĩnh (public/luyen-tap).
 *
 * Học viên nhập mã HVKAT ở /vao-luyen-tap → /api/practice-pass kiểm tra mã
 * trong profiles rồi đặt cookie `kat_lt` = "<mã>.<hết hạn>.<chữ ký>".
 * Middleware chỉ cần kiểm chữ ký (không gọi DB) nên chạy được ở Edge.
 * Dùng Web Crypto để cùng một code chạy cả Node (route) lẫn Edge (middleware).
 */

export const PRACTICE_COOKIE = "kat_lt";
export const PRACTICE_PASS_DAYS = 30;

/** Trang trong /luyen-tap xem tự do (danh mục bài); còn lại phải có vé. */
const PUBLIC_PAGES = new Set([
  "/luyen-tap/index.html",
  "/luyen-tap/hsk1-index.html",
  "/luyen-tap/hsk2-index.html",
  "/luyen-tap/hsk3-index.html",
  "/luyen-tap/chude-index.html",
]);

export function isPublicPracticePath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || pathname.endsWith(".css");
}

function secret(): string {
  // Không thêm env mới: tái dùng service role key (chỉ có phía server).
  return process.env.PRACTICE_PASS_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signPracticePass(code: string): Promise<string> {
  const exp = Date.now() + PRACTICE_PASS_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${code}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Trả về mã học viên nếu vé hợp lệ và còn hạn, ngược lại null. */
export async function verifyPracticePass(value: string | undefined): Promise<string | null> {
  if (!value || !secret()) return null;
  const [code, exp, sig] = value.split(".");
  if (!code || !exp || !sig) return null;
  if (!(Number(exp) > Date.now())) return null;
  return (await hmac(`${code}.${exp}`)) === sig ? code : null;
}
