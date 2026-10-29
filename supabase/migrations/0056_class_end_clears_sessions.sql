-- =====================================================================
-- 0056: LỚP KẾT THÚC / HỦY → DỌN CÁC BUỔI CHƯA DIỄN RA.
-- Chạy SAU 0055_class_progress_reschedule.sql.
--
-- Lỗi cũ: đổi trạng thái lớp sang 'completed' / 'cancelled' chỉ sửa
-- classes.status, các buổi đã sinh sẵn vẫn 'scheduled' → lớp đã kết thúc
-- vẫn hiện ở thời khóa biểu, lịch dạy GV, tab Hôm nay/Ngày mai và danh
-- sách buổi để xếp học bù.
--
-- Trigger xoá các buổi CHƯA DIỄN RA của lớp (cùng tiêu chí với
-- delete_unheld_sessions ở 0055): từ hôm nay trở đi, 'scheduled', chưa
-- chấm công, chưa điểm danh. Buổi đã dạy giữ nguyên cho lịch sử / chấm
-- công / học phí. HV đã xếp bù vào buổi bị xoá → trả về hàng chờ.
--
-- Xoá chứ không chuyển 'cancelled': trigger on_session_schedule_change
-- (0015) bắn thông báo "buổi bị hủy" cho từng buổi → spam HV. Trigger đó
-- chỉ chạy khi update nên delete không gửi gì.
--
-- Mở lại lớp → dùng "Sinh buổi học" / áp lịch tuần (0055) để sinh lại.
-- =====================================================================

create or replace function public.clear_unheld_sessions_of_class(p_class_id uuid)
returns int
security definer
set search_path = public
language plpgsql
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(s.id), '{}') into v_ids
  from sessions s
  where s.class_id = p_class_id
    and s.status = 'scheduled'
    and s.date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
    and not exists (select 1 from teaching_logs t where t.session_id = s.id)
    and not exists (select 1 from attendance att where att.session_id = s.id);

  update makeup_credits
     set makeup_session_id = null, status = 'pending'
   where makeup_session_id = any (v_ids) and status = 'scheduled';

  delete from sessions where id = any (v_ids);
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke all on function public.clear_unheld_sessions_of_class(uuid) from public;

create or replace function public.on_class_ended()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform public.clear_unheld_sessions_of_class(new.id);
  return new;
end;
$$;

drop trigger if exists on_class_ended on public.classes;
create trigger on_class_ended
  after update of status on public.classes
  for each row
  when (new.status in ('completed', 'cancelled') and old.status is distinct from new.status)
  execute function public.on_class_ended();

-- Dọn một lần cho các lớp đã kết thúc / hủy từ trước.
select public.clear_unheld_sessions_of_class(c.id)
from public.classes c
where c.status in ('completed', 'cancelled');
