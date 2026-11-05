-- =====================================================================
-- 0071: HỌC BÙ — "KHÔNG CẦN BÙ"
--
-- Ở hàng "Chờ xếp bù", admin có thể đánh dấu một lượt là không cần bù
-- (học viên tự học, phụ huynh không yêu cầu...). Lượt chuyển sang
-- status = 'waived', lý do (tùy chọn) ghi vào cột note.
--
-- Học phí / số buổi: view package_balances vốn đã trừ 1 buổi cho điểm danh
-- 'absent_excused' → lượt 'waived' tự tính như một buổi đã học, không cần
-- sửa gì thêm. Giữ lại dòng (không xoá) để trigger handle_excused_absence
-- không sinh lại lượt bù (on conflict do nothing).
--
-- Chạy SAU 0070_slide_folders.sql.
-- =====================================================================

alter table public.makeup_credits
  drop constraint if exists makeup_credits_status_check;
alter table public.makeup_credits
  add constraint makeup_credits_status_check
  check (status in ('pending', 'scheduled', 'attended', 'expired', 'cancelled', 'waived'));

alter table public.makeup_credits
  add column if not exists waived_at timestamptz;

-- Sửa điểm danh buổi gốc khỏi 'absent_excused' (hoặc xoá điểm danh) thì lượt
-- "không cần bù" cũng mất ý nghĩa → gỡ cùng lượt đang chờ (0040).
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
       and status in ('pending', 'waived');
    return old;
  end if;

  if new.status <> 'absent_excused' then
    delete from public.makeup_credits
     where student_id = new.student_id
       and missed_session_id = new.session_id
       and status in ('pending', 'waived');
  end if;
  return new;
end;
$$;
