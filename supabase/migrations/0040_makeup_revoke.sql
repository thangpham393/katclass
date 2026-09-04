-- =====================================================================
-- Thu hồi quyền học bù khi sửa lại điểm danh.
-- Chạy SAU 0039_alumni.sql.
--
-- Vấn đề: `handle_excused_absence` (0002) sinh quyền học bù khi điểm danh
-- 'absent_excused', nhưng không có gì gỡ lại. Nếu giáo viên bấm nhầm
-- "Có phép" rồi sửa thành "Có mặt", học viên vẫn nằm mãi ở "Chờ xếp bù".
--
--   1. Đổi trạng thái điểm danh khác 'absent_excused' → xoá quyền còn
--      'pending' của đúng buổi đó (chưa xếp lịch nên xoá là sạch).
--      Quyền đã 'scheduled'/'attended' giữ nguyên — buổi bù đã đặt rồi,
--      admin tự bấm "Bỏ xếp bù" nếu muốn huỷ.
--   2. Xoá điểm danh (hiếm) cũng gỡ quyền 'pending' tương ứng.
--   3. Vá ngược dữ liệu cũ đang kẹt trong danh sách chờ.
-- =====================================================================

create or replace function public.revoke_makeup_on_attendance_change()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.makeup_credits
     where student_id = old.student_id
       and missed_session_id = old.session_id
       and status = 'pending';
    return old;
  end if;

  if new.status <> 'absent_excused' then
    delete from public.makeup_credits
     where student_id = new.student_id
       and missed_session_id = new.session_id
       and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_attendance_revoke_makeup on public.attendance;
create trigger on_attendance_revoke_makeup
  after update of status or delete on public.attendance
  for each row execute function public.revoke_makeup_on_attendance_change();

-- Vá ngược: quyền chờ xếp nhưng điểm danh buổi gốc không còn là vắng có phép
delete from public.makeup_credits mc
 where mc.status = 'pending'
   and exists (
     select 1 from public.attendance a
      where a.session_id = mc.missed_session_id
        and a.student_id = mc.student_id
        and a.status <> 'absent_excused'
   );
