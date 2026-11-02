-- =====================================================================
-- 0063: GIÁO VIÊN THẤY NHẬN XÉT DO NGƯỜI KHÁC VIẾT.
-- Chạy SAU 0062_class_course_stages.sql.
--
-- Trước đây giáo viên chỉ đọc được nhận xét MÌNH viết (teacher_id = mình):
-- admin / GV dạy thay nhận xét một buổi thì phụ huynh nhận được, còn GV của
-- lớp mở buổi đó vẫn thấy trống và bảng "Học viên chưa nhận xét" vẫn báo
-- thiếu.
--
-- 1. Nhận xét từng buổi: GV đọc được mọi nhận xét của buổi mình dạy hoặc
--    buổi của lớp mình phụ trách (teaches_session) — sửa thì vẫn theo luật
--    cũ (0043): sửa xong nhận xét thành của người vừa sửa.
-- 2. Nhận xét tổng kết: GV đọc được bản ĐÃ PHÁT HÀNH của học viên mình dạy
--    (bản nháp của người khác vẫn riêng tư).
-- =====================================================================

drop policy if exists "view session comments" on public.session_comments;
create policy "view session comments" on public.session_comments
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('classroom.teach')
    or teacher_id = public.my_profile_id()
    or public.teaches_session(session_id)
  );

drop policy if exists "view student reviews" on public.student_reviews;
create policy "view student reviews" on public.student_reviews
  for select using (
    ((student_id = public.my_profile_id() or public.is_my_student(student_id))
      and published_at is not null)
    or teacher_id = public.my_profile_id()
    or public.has_perm('classroom.teach')
    or (published_at is not null and public.teaches_student(student_id))
  );
