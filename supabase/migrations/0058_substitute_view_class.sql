-- =====================================================================
-- 0058: GV DẠY THAY XEM ĐƯỢC LỚP CỦA BUỔI MÌNH ĐỨNG.
-- Chạy SAU 0057_class_start_date.sql.
--
-- Hành chính đổi GV ở "Sửa lớp" (check-in ca dạy) chỉ đổi sessions.teacher_id.
-- Policy "view sessions" (0016) cho GV đó đọc được buổi, nhưng
-- can_view_class (0021) chỉ tính GV phụ trách / GV trong class_teachers →
-- GV dạy thay đọc buổi mà không đọc được lớp: tên lớp ra "?", danh sách
-- học viên trống, không điểm danh được.
--
-- Nay: GV được xếp đứng ít nhất một buổi của lớp cũng xem được lớp đó
-- (lớp, học viên trong lớp, học liệu lớp...). Trang "Lớp của tôi" vẫn chỉ
-- liệt kê lớp phụ trách vì fetchTeacherClasses lọc tường minh.
-- =====================================================================

create index if not exists sessions_teacher_class_idx
  on public.sessions (teacher_id, class_id);

create or replace function public.can_view_class(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = cid and c.teacher_id = public.my_profile_id())
    or exists (select 1 from public.class_teachers ct
               where ct.class_id = cid and ct.teacher_id = public.my_profile_id())
    or exists (select 1 from public.sessions s
               where s.class_id = cid and s.teacher_id = public.my_profile_id())
    or exists (select 1 from public.class_students cs
               where cs.class_id = cid and cs.student_id = public.my_profile_id())
    or exists (select 1 from public.class_students cs
               join public.parent_students ps on ps.student_id = cs.student_id
               where cs.class_id = cid and ps.parent_id = public.my_profile_id());
$$;
