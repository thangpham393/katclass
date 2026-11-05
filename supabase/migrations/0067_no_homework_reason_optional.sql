-- 0067 — "Không giao BTVN" KHÔNG bắt buộc ghi lý do
-- Chạy SAU 0066_homework_check_next_preview.sql.
-- Bỏ điều kiện homework_note khác rỗng khi homework_status = 'none';
-- vẫn giữ: GV phải xác nhận (assigned / none) và 'assigned' phải có bài thật.

create or replace function public.check_teaching_log_homework()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  if public.is_staff() then
    return new;
  end if;
  select class_id into v_class from public.sessions where id = new.session_id;
  -- Buổi học bù riêng không gắn lớp → không giao BTVN theo lớp được
  if v_class is null then
    return new;
  end if;
  if new.homework_status is null then
    raise exception 'Xác nhận bài tập về nhà của buổi (đã giao hoặc không giao) trước khi chấm công'
      using errcode = 'P0001';
  end if;
  if new.homework_status = 'assigned' and not public.session_has_homework(new.session_id) then
    raise exception 'Buổi này chưa có bài tập nào trên hệ thống — giao bài trước khi chấm công'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
