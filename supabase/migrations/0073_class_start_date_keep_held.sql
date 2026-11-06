-- =====================================================================
-- 0073: SỬA NGÀY BẮT ĐẦU — GIỮ NGUYÊN BUỔI ĐÃ HỌC, DỒN BUỔI CHƯA HỌC.
-- Chạy SAU 0072_class_start_date_shift_held.sql.
--
-- Trường hợp hay gặp nhất: lớp sinh buổi từ ngày khai giảng dự kiến (vd
-- 6/10), thực tế khai giảng muộn hơn (20/10). Các buổi trước ngày thực tế
-- không ai chấm công, còn buổi GV chấm công thì ĐÚNG ngày thật — chỉ có số
-- buổi bị lệch (buổi dạy đầu tiên mang số 7). 0072 dời cả buổi đã học theo
-- thứ tự nên đẩy buổi đã học sang tương lai → bị chặn.
--
-- Nay, mặc định (p_include_held = false):
--   • buổi đã học (chấm công / điểm danh / hoàn thành) giữ nguyên ngày giờ;
--   • mọi buổi chưa học được xếp lại vào các khung còn trống từ ngày mới
--     theo lịch tuần (khung đã có buổi đã học thì bỏ qua);
--   • lưu thì đánh lại số buổi 1, 2, 3... theo ngày giờ.
--   Có buổi đã học TRƯỚC ngày mới thì báo lỗi — khi đó ngày của chính buổi
--   đã học bị sai, dùng p_include_held = true (0072) để dời cả buổi đã học.
-- =====================================================================

create or replace function public.change_class_start_date(
  p_class_id uuid,
  p_start date,
  p_apply boolean default false,
  p_include_held boolean default false
)
returns table (
  session_id uuid,
  session_no int,
  old_date date,
  old_start time,
  old_end time,
  new_date date,
  new_start time,
  new_end time,
  conflict text
)
security definer
set search_path = public
language plpgsql
as $$
#variable_conflict use_column
declare
  v_first_held date;
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền sửa lịch lớp.' using errcode = '42501';
  end if;
  if p_start is null then
    raise exception 'Chưa chọn ngày bắt đầu.';
  end if;
  if exists (select 1 from classes c where c.id = p_class_id and c.course_started_on is not null) then
    raise exception 'Lớp đã lên khóa mới nên không sửa ngày bắt đầu được. Sửa ngày từng buổi ở danh sách buổi.';
  end if;

  if not p_include_held then
    select min(s.date) into v_first_held
      from sessions s
     where s.class_id = p_class_id
       and s.status <> 'cancelled'
       and (s.status = 'completed'
            or exists (select 1 from teaching_logs t where t.session_id = s.id)
            or exists (select 1 from attendance att where att.session_id = s.id));
    if v_first_held < p_start then
      raise exception 'Có buổi đã học ngày % — trước ngày bắt đầu mới. Nếu ngày của các buổi đã học bị lệch so với thực tế, tích "Dời cả buổi đã học".',
        to_char(v_first_held, 'DD/MM/YYYY');
    end if;
  end if;

  if p_apply then
    update classes set start_date = p_start where id = p_class_id;
  end if;

  if exists (
    select 1 from sessions s
    where s.class_id = p_class_id and s.status <> 'cancelled' and s.type = 'regular'
  ) then
    return query
      select * from public.reschedule_class_sessions(p_class_id, p_start, p_apply, true, p_include_held);
  end if;

  -- Buổi đã học giữ ngày, buổi chưa học bị dồn ra sau → đánh lại số buổi theo ngày giờ
  if p_apply then
    perform set_config('classhub.bulk_reschedule', 'on', true);
    with numbered as (
      select s.id, row_number() over (order by s.date, s.start_time) as rn
        from sessions s
       where s.class_id = p_class_id and s.status <> 'cancelled'
    )
    update sessions s
       set session_no = n.rn
      from numbered n
     where s.id = n.id and s.session_no is distinct from n.rn;
    perform set_config('classhub.bulk_reschedule', 'off', true);
  end if;
end;
$$;
