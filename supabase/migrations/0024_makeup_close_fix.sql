-- =====================================================================
-- Đóng quyền học bù chắc tay hơn.
-- Chạy SAU 0023_package_course_discount.sql.
--
-- Vấn đề: 0005 chỉ đóng quyền học bù khi điểm danh đúng trạng thái
-- 'makeup'. Nếu giáo viên bấm "Có mặt" (present) cho học viên tới học bù
-- — rất dễ xảy ra ở buổi bù riêng, nơi cả buổi chỉ có một học viên —
-- thì quyền vẫn nằm ở "Đã xếp, chờ học" mãi dù buổi đã học xong.
--
--   1. Điểm danh 'makeup' HOẶC 'present' ở đúng buổi được xếp bù → đóng.
--   2. Vá ngược dữ liệu cũ: quyền còn 'scheduled' nhưng đã có điểm danh
--      present/makeup ở buổi bù → chuyển 'attended'.
-- =====================================================================

create or replace function public.handle_makeup_attendance()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.status in ('makeup', 'present') then
    update public.makeup_credits
       set status = 'attended'
     where student_id = new.student_id
       and makeup_session_id = new.session_id
       and status = 'scheduled';
  end if;
  return new;
end;
$$;

-- Vá ngược các lượt đã học nhưng vẫn kẹt ở "đã xếp, chờ học"
update public.makeup_credits mc
   set status = 'attended'
 where mc.status = 'scheduled'
   and exists (
     select 1 from public.attendance a
      where a.session_id = mc.makeup_session_id
        and a.student_id = mc.student_id
        and a.status in ('makeup', 'present')
   );
