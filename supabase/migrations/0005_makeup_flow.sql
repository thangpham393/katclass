-- =====================================================================
-- Vòng học bù khép kín + quyền cho giáo viên đứng buổi bù.
-- Chạy SAU 0004_decouple_profiles.sql.
--
-- 1. Học viên được xếp bù vào buổi nào thì giáo viên dạy buổi đó phải
--    THẤY được quyền học bù (để điểm danh 'makeup') — bổ sung policy.
-- 2. Điểm danh 'makeup' → tự đóng quyền học bù (status = 'attended'),
--    đúng luồng "Điểm danh buổi bù → đóng yêu cầu học bù" đã chốt.
-- =====================================================================

-- 1. Giáo viên xem được các quyền học bù xếp vào buổi mình dạy
drop policy "view makeup credits" on public.makeup_credits;
create policy "view makeup credits" on public.makeup_credits
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or (makeup_session_id is not null and public.teaches_session(makeup_session_id))
  );

-- 2. Điểm danh học bù → đóng quyền học bù tương ứng
create or replace function public.handle_makeup_attendance()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.status = 'makeup' then
    update public.makeup_credits
       set status = 'attended'
     where student_id = new.student_id
       and makeup_session_id = new.session_id
       and status = 'scheduled';
  end if;
  return new;
end;
$$;

create trigger on_makeup_attendance
  after insert or update of status on public.attendance
  for each row execute function public.handle_makeup_attendance();
