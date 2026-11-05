-- 0066 — CHẤM CÔNG PHẢI KÈM BTVN + HỌC VIÊN XEM TRƯỚC BUỔI SAU
-- Chạy SAU 0065_comment_parent_contact.sql.
--
-- 1) Nhiều GV bỏ qua màn "Vào lớp" mà bấm chấm công thẳng → quên giao BTVN.
--    teaching_logs.homework_status ghi GV đã xác nhận phần BTVN của buổi:
--      * 'assigned' — đã có bài tập trên hệ thống cho buổi này
--      * 'none'     — buổi không giao BTVN (lý do tùy chọn ở homework_note — 0067 bỏ bắt buộc)
--    Trigger chặn GIÁO VIÊN tạo bản ghi công cho buổi có lớp mà chưa xác
--    nhận, hoặc xác nhận 'assigned' khi thực tế chưa có bài nào. Hành chính
--    chấm hộ (is_staff) không bị chặn. Chỉ kiểm khi INSERT để sửa bản ghi
--    cũ (trước 0066) không vướng.
--    "Bài của buổi" = homeworks.session_id = buổi đó, hoặc bài của lớp
--    không gắn buổi nhưng tạo trong ngày học / ngày hôm sau (giờ VN).
--
-- 2) RPC class_next_previews: học viên / phụ huynh không đọc được
--    teaching_logs (RLS 0059) → trả riêng "dự kiến buổi sau" + BTVN của
--    buổi đã chấm công gần nhất mỗi lớp, để HV xem trước bài.

alter table public.teaching_logs
  add column if not exists homework_status text
    check (homework_status in ('assigned', 'none'));

create or replace function public.session_has_homework(p_session uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.homeworks h on h.class_id = s.class_id
    where s.id = p_session
      and (
        h.session_id = s.id
        or (h.session_id is null
            and (h.created_at at time zone 'Asia/Ho_Chi_Minh')::date between s.date and s.date + 1)
      )
  );
$$;

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
  if new.homework_status = 'none' and nullif(btrim(coalesce(new.homework_note, '')), '') is null then
    raise exception 'Ghi lý do buổi này không giao bài tập về nhà'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists teaching_logs_homework_check on public.teaching_logs;
create trigger teaching_logs_homework_check
  before insert on public.teaching_logs
  for each row execute function public.check_teaching_log_homework();

create or replace function public.class_next_previews(p_class_ids uuid[])
returns table (
  class_id uuid,
  logged_date date,
  next_plan text,
  homework_note text
)
language sql stable security definer
set search_path = public
as $$
  select distinct on (s.class_id)
    s.class_id, s.date, tl.next_plan,
    -- 'none' thì homework_note là lý do không giao, không phải bài cho HV
    case when tl.homework_status = 'none' then null else tl.homework_note end
  from public.sessions s
  join public.teaching_logs tl on tl.session_id = s.id
  where s.class_id = any (p_class_ids)
    and public.can_view_class(s.class_id)
  order by s.class_id, s.date desc, s.start_time desc;
$$;

grant execute on function public.class_next_previews(uuid[]) to authenticated;
grant execute on function public.session_has_homework(uuid) to authenticated;
