-- =====================================================================
-- LỚP HỌC TRỰC TIẾP P4: động lực cho học viên + phụ huynh nhắc con làm bài.
-- Chạy SAU 0020_classroom.sql.
--
-- Thêm:
--   1. Loại thông báo 'homework_reminder'
--   2. RPC remind_homework() — phụ huynh (hoặc GV/staff) bấm nhắc con làm bài;
--      phụ huynh không có quyền insert thẳng vào notifications nên phải đi qua
--      hàm security definer có kiểm tra quan hệ.
--   3. Hàm points_since() — tổng ★ của học viên từ một mốc ngày (thẻ tích luỹ).
-- =====================================================================

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'homework_new',
    'makeup_scheduled',
    'child_absent',
    'package_low',
    'schedule_change',
    'request_new',
    'request_resolved',
    'session_report',
    'homework_reminder',  -- phụ huynh/GV nhắc học viên làm bài tập
    'generic'
  ));

-- ---------------------------------------------------------------------
-- Nhắc làm bài: chỉ phụ huynh của học viên đó, GV của lớp giao bài, hoặc staff
-- Chống dội: mỗi bài tập nhắc tối đa 1 lần / 6 giờ cho cùng một học viên.
-- ---------------------------------------------------------------------
create or replace function public.remind_homework(hw_id uuid, sid uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  hw record;
  me uuid := public.my_profile_id();
begin
  select h.id, h.title, h.due_at, h.class_id, c.name as class_name, c.teacher_id
    into hw
  from homeworks h
  left join classes c on c.id = h.class_id
  where h.id = hw_id;

  if hw.id is null then
    raise exception 'Không tìm thấy bài tập';
  end if;

  if not (
    public.is_staff()
    or hw.teacher_id = me
    or exists (select 1 from parent_students ps
               where ps.parent_id = me and ps.student_id = sid)
  ) then
    raise exception 'Bạn không có quyền nhắc học viên này';
  end if;

  if exists (
    select 1 from notifications n
    where n.recipient_id = sid
      and n.type = 'homework_reminder'
      and n.link = '/student/homework/' || hw_id
      and n.created_at > now() - interval '6 hours'
  ) then
    return;  -- vừa nhắc xong, bỏ qua cho đỡ dội
  end if;

  insert into notifications (recipient_id, type, title, body, link)
  values (
    sid,
    'homework_reminder',
    'Nhắc làm bài: ' || hw.title,
    coalesce('Lớp ' || hw.class_name, 'Bài tập')
      || case when hw.due_at is not null
           then ' · hạn nộp ' || to_char(hw.due_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
           else '' end,
    '/student/homework/' || hw_id
  );
end;
$$;

grant execute on function public.remind_homework(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Tổng ★ của học viên từ một mốc ngày (null = từ đầu). Dùng cho thẻ tích luỹ
-- ở trang chủ học viên và cổng phụ huynh; RLS của class_points vẫn áp dụng vì
-- hàm chạy quyền người gọi (security invoker mặc định).
-- ---------------------------------------------------------------------
create or replace function public.points_since(sid uuid, from_date date default null)
returns int
language sql stable
as $$
  select coalesce(sum(points), 0)::int
  from public.class_points
  where student_id = sid
    and (from_date is null or created_at >= from_date);
$$;
