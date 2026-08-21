import { redirect } from "next/navigation";

/** Đường dẫn cũ — kho học liệu nay dùng chung ở /library/textbooks. */
export default async function RedirectTextbookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/library/textbooks/${id}`);
}
