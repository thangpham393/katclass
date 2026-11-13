import type { ReactNode } from "react";

/**
 * Trang theo ID là trang client đọc dữ liệu sau khi tải — không cần lưu đệm.
 * Không khai báo thì Next.js lưu đệm (ISR) từng ID một → Vercel tính phí
 * "ISR Writes" cho mỗi buổi/bài tập mới và ghi lại toàn bộ sau mỗi lần deploy.
 */
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
