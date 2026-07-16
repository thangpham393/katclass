-- =====================================================================
-- Siết quyền xem bài học: học viên KHÔNG còn thấy toàn bộ thư viện
-- của trung tâm — chỉ thấy bài thuộc lớp mình tham gia.
-- Chạy SAU 0013_tuition_notifications.sql.
--
-- Học viên (và phụ huynh, qua con) xem được một bài học khi:
--   a) bài thuộc GIÁO TRÌNH của lớp mình (lessons.textbook_id = classes.textbook_id)
--   b) hoặc bài gắn KHÓA HỌC của lớp mình (lessons.course_id = classes.course_id
--      — bài GV tự soạn trước khi có thư viện giáo trình)
--   c) hoặc bài được GV gán vào một BUỔI của lớp mình (session_lessons
--      — kể cả khi GV chọn bài ngoài giáo trình)
--   d) hoặc bài gán vào buổi mình được xếp HỌC BÙ.
-- GV / staff / admin vẫn thấy tất cả.
-- =====================================================================

create or replace function public.can_view_lesson(lid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    -- a + b: bài thuộc giáo trình / khóa học của lớp mình (hoặc lớp của con)
    exists (
      select 1
      from lessons l
      join classes c on (
        (l.textbook_id is not null and c.textbook_id = l.textbook_id)
        or (l.course_id is not null and c.course_id = l.course_id)
      )
      join class_students cs on cs.class_id = c.id
      where l.id = lid
        and (cs.student_id = public.my_profile_id()
             or public.is_my_student(cs.student_id))
    )
    -- c: bài được gán vào buổi của lớp mình (hoặc lớp của con)
    or exists (
      select 1
      from session_lessons sl
      join sessions s on s.id = sl.session_id
      join class_students cs on cs.class_id = s.class_id
      where sl.lesson_id = lid
        and (cs.student_id = public.my_profile_id()
             or public.is_my_student(cs.student_id))
    )
    -- d: bài gán vào buổi mình (hoặc con mình) được xếp học bù
    or exists (
      select 1
      from session_lessons sl
      join makeup_credits mc on mc.makeup_session_id = sl.session_id
      where sl.lesson_id = lid
        and (mc.student_id = public.my_profile_id()
             or public.is_my_student(mc.student_id))
    );
$$;

drop policy "read lessons" on public.lessons;
create policy "read lessons" on public.lessons
  for select using (
    public.my_role() in ('teacher', 'staff', 'admin')
    or public.can_view_lesson(id)
  );

-- Học viên được xếp học bù xem được nội dung ôn tập của buổi bù
-- (policy cũ chỉ cho người trong lớp của buổi đó).
drop policy "view session lessons" on public.session_lessons;
create policy "view session lessons" on public.session_lessons
  for select using (
    exists (select 1 from public.sessions s
            where s.id = session_id and public.can_view_class(s.class_id))
    or exists (select 1 from public.makeup_credits mc
               where mc.makeup_session_id = session_lessons.session_id
                 and (mc.student_id = public.my_profile_id()
                      or public.is_my_student(mc.student_id)))
  );
