"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SessionDetail } from "@/components/session-detail";

export default function TeacherSessionPage() {
  const params = useParams<{ id: string }>();

  /*
   * Mở từ bảng "Chưa nhận xét buổi học" ở trang chủ: `?comment=<student_id>`
   * → bật luôn ô nhận xét cho em đó, rồi gỡ tham số khỏi URL để tải lại trang
   * không bật lại lần nữa.
   */
  const [comment, setComment] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setComment(new URLSearchParams(window.location.search).get("comment"));
  }, []);
  const clearComment = useCallback(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Chờ đọc xong URL rồi mới dựng để ô nhận xét nhận đúng giá trị ban đầu
  if (comment === undefined) return null;
  return <SessionDetail sessionId={params.id} commentStudentId={comment} onCommentOpened={clearComment} />;
}
