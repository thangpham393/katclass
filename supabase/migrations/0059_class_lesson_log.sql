-- =====================================================================
-- 0059: GV CỦA LỚP ĐỌC ĐƯỢC NỘI DUNG CÁC BUỔI TRƯỚC.
-- Chạy SAU 0058_substitute_view_class.sql.
--
-- Policy "view teaching logs" (0027) chỉ cho GV đọc bản chấm công của buổi
-- chính mình đứng → GV dạy thay (hay GV phụ trách sau buổi người khác dạy
-- thay) không biết buổi trước lớp đã học tới đâu.
--
-- Nay: GV phụ trách lớp, GV trong class_teachers, hoặc GV được xếp đứng ít
-- nhất một buổi của lớp đều đọc được nội dung bài / ghi chú của mọi buổi
-- trong lớp. Học viên, phụ huynh vẫn không đọc được (ghi chú là nội bộ).
-- =====================================================================

create or replace function public.teaches_class(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.classes c
                 where c.id = cid and c.teacher_id = public.my_profile_id())
    or exists (select 1 from public.class_teachers ct
               where ct.class_id = cid and ct.teacher_id = public.my_profile_id())
    or exists (select 1 from public.sessions s
               where s.class_id = cid and s.teacher_id = public.my_profile_id());
$$;

drop policy if exists "view teaching logs" on public.teaching_logs;
create policy "view teaching logs" on public.teaching_logs
  for select using (
    public.has_perm('classroom.teach')
    or public.has_perm('payroll.view')
    or public.teaches_session(session_id)
    or exists (select 1 from public.sessions s
               where s.id = session_id
                 and s.class_id is not null
                 and public.teaches_class(s.class_id))
  );
