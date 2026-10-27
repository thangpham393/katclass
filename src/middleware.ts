import { NextResponse, type NextRequest } from "next/server";
import { PRACTICE_COOKIE, isPublicPracticePath, verifyPracticePass } from "@/lib/practice-pass";

/**
 * Chỉ chặn khu luyện tập tĩnh /luyen-tap: trang danh mục xem tự do,
 * mở bài (và tài nguyên của bài) phải có vé mã học viên — xem lib/practice-pass.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPracticePath(pathname)) return NextResponse.next();
  if (await verifyPracticePass(req.cookies.get(PRACTICE_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const gate = new URL("/vao-luyen-tap", req.url);
  gate.searchParams.set("next", pathname + search);
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/luyen-tap/:path+"],
};
