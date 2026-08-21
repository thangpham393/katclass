import { redirect } from "next/navigation";

/** Đường dẫn cũ — kho học liệu nay dùng chung ở /library/textbooks. */
export default function RedirectLibraryTextbooksPage() {
  redirect("/library/textbooks");
}
