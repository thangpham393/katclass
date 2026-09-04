import type { Metadata } from "next";

/**
 * Đường dẫn xem của phụ huynh là bí mật — chặn Google/Bing lập chỉ mục
 * để link lỡ bị chia sẻ công khai cũng không nằm trong kết quả tìm kiếm.
 */
export const metadata: Metadata = {
  title: "Thông tin học viên · KAT CLASS",
  robots: { index: false, follow: false },
};

export default function ParentShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
