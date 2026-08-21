import { redirect } from "next/navigation";

/** Đường dẫn cũ — kho học liệu nay dùng chung ở /library/vocab. */
export default function RedirectLibraryVocabPage() {
  redirect("/library/vocab");
}
