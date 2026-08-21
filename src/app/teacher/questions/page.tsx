import { redirect } from "next/navigation";

/** Đường dẫn cũ — kho học liệu nay dùng chung ở /library/questions. */
export default function RedirectLibraryQuestionsPage() {
  redirect("/library/questions");
}
