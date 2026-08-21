import { redirect } from "next/navigation";

/** Đường dẫn cũ — kho học liệu nay dùng chung ở /library/lessons. */
export default function RedirectLibraryLessonsPage() {
  redirect("/library/lessons");
}
