-- =====================================================================
-- 0055: TIẾN ĐỘ LỚP + ÁP LỊCH TUẦN MỚI CHO CÁC BUỔI ĐÃ SINH.
-- Chạy SAU 0054_class_photos.sql.
--
-- 1. View class_progress: mỗi lớp một dòng — ngày buổi đầu/buổi cuối, số
--    buổi đã học (có chấm công), đã qua mà chưa chấm công, còn sắp tới.
--    Trang danh sách lớp dùng để hiện tiến độ mà không phải tải mọi buổi.
--
-- 2. Lỗi cũ: "Lưu lịch tuần" chỉ thay class_schedules, các buổi đã sinh vẫn
--    giữ giờ cũ. Bấm "Sinh buổi học" sau đó thì ngày nào đã có buổi giờ cũ
--    sẽ bị chặn vì trùng giờ GV (23P01) hoặc sinh thêm buổi thứ hai trong
--    ngày → admin thấy lịch "vẫn theo giờ cũ".
--
--    reschedule_class_sessions(lớp, từ ngày, áp dụng?) xếp lại các buổi
--    CHƯA DIỄN RA của lớp vào các khung của lịch tuần hiện tại, giữ nguyên
--    thứ tự: buổi sớm nhất → khung sớm nhất. Giữ id + session_no nên slide,
--    ghi chú chuẩn bị, HV đã xếp bù vào buổi đều đi theo buổi.
--    Chỉ đụng buổi 'scheduled', chưa chấm công, chưa điểm danh.
--    p_apply = false → chỉ xem trước; true → đổi thật (nếu còn trùng giờ
--    GV/phòng với lớp khác thì báo lỗi, không đổi gì).
--
--    Đổi hàng loạt thì trigger 0015 sẽ bắn mỗi buổi một thông báo cho từng
--    HV → tắt trigger trong lúc chạy, gửi MỘT thông báo tổng hợp thay vào.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tiến độ lớp
-- ---------------------------------------------------------------------
create or replace view public.class_progress
with (security_invoker = on) as
select
  s.class_id,
  min(s.date) filter (where s.status <> 'cancelled') as first_date,
  max(s.date) filter (where s.status <> 'cancelled') as last_date,
  count(*) filter (where s.status = 'completed')::int as done,
  count(*) filter (where s.status = 'scheduled' and s.date < current_date)::int as past_pending,
  count(*) filter (where s.status = 'scheduled' and s.date >= current_date)::int as upcoming
from public.sessions s
where s.class_id is not null
group by s.class_id;

grant select on public.class_progress to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cho phép tắt trigger báo đổi lịch trong một giao dịch
-- ---------------------------------------------------------------------
drop trigger if exists on_session_schedule_change on public.sessions;
create trigger on_session_schedule_change
  after update on public.sessions
  for each row
  when (coalesce(current_setting('classhub.bulk_reschedule', true), '') <> 'on')
  execute function public.notify_session_schedule_change();

-- ---------------------------------------------------------------------
-- 3. Xếp lại các buổi chưa học theo lịch tuần hiện tại
-- ---------------------------------------------------------------------
create or replace function public.reschedule_class_sessions(
  p_class_id uuid,
  p_from date default current_date,
  p_apply boolean default false
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
  v_class text;
  v_changed int;
  v_schedule text;
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền sửa lịch lớp.' using errcode = '42501';
  end if;
  if not exists (select 1 from class_schedules cs where cs.class_id = p_class_id) then
    raise exception 'Lớp chưa có lịch tuần — nhập lịch trước.';
  end if;

  drop table if exists _resched_plan;
  create temp table _resched_plan on commit drop as
  with a as (
    -- buổi còn đổi được: chưa diễn ra, chưa chấm công, chưa điểm danh
    select s.id, s.session_no, s.date, s.start_time, s.end_time, s.room_id, s.teacher_id,
           row_number() over (order by s.date, s.start_time) as rn
    from sessions s
    where s.class_id = p_class_id
      and s.type = 'regular' -- buổi bù cả lớp xếp giờ riêng, không theo lịch tuần
      and s.status = 'scheduled'
      and s.date >= p_from
      and not exists (select 1 from teaching_logs t where t.session_id = s.id)
      and not exists (select 1 from attendance att where att.session_id = s.id)
  ),
  slots as (
    select d::date as date, cs.start_time, cs.end_time, cs.room_id,
           coalesce(cs.teacher_id, c.teacher_id) as teacher_id
    from generate_series(p_from::timestamp, (p_from + 730)::timestamp, interval '1 day') d
    join class_schedules cs
      on cs.class_id = p_class_id and cs.weekday = extract(dow from d)::int
    join classes c on c.id = p_class_id
    -- khung đã có buổi khác của lớp (đã học / đã hủy / đã điểm danh) thì bỏ,
    -- vd ngày lễ đã hủy buổi thì không xếp lại vào đó
    where not exists (
      select 1 from sessions o
      where o.class_id = p_class_id and o.date = d::date and o.start_time = cs.start_time
        and o.id not in (select id from a)
    )
  ),
  b as (
    select slots.*, row_number() over (order by slots.date, slots.start_time) as rn from slots
  )
  select a.id as sid, a.rn, a.session_no,
         a.date as old_date, a.start_time as old_start, a.end_time as old_end,
         b.date as new_date, b.start_time as new_start, b.end_time as new_end,
         b.room_id as new_room, b.teacher_id as new_teacher,
         (a.date, a.start_time, a.end_time, a.room_id, a.teacher_id)
           is distinct from (b.date, b.start_time, b.end_time, b.room_id, b.teacher_id) as changed
  from a join b on b.rn = a.rn;

  -- Trùng giờ với buổi của lớp khác (buổi trong kế hoạch thì sẽ dời đi, không tính)
  alter table _resched_plan add column conflict text;
  update _resched_plan p set conflict = coalesce(
    (select 'GV trùng giờ: ' || coalesce(c2.name, 'buổi học bù') || ' '
            || to_char(o.start_time, 'HH24:MI') || '–' || to_char(o.end_time, 'HH24:MI')
       from sessions o left join classes c2 on c2.id = o.class_id
      where p.new_teacher is not null and o.teacher_id = p.new_teacher
        and o.status <> 'cancelled'
        and o.id not in (select sid from _resched_plan)
        and tsrange(o.date + o.start_time, o.date + o.end_time)
            && tsrange(p.new_date + p.new_start, p.new_date + p.new_end)
      limit 1),
    (select 'Phòng trùng giờ: ' || coalesce(c2.name, 'buổi học bù') || ' '
            || to_char(o.start_time, 'HH24:MI') || '–' || to_char(o.end_time, 'HH24:MI')
       from sessions o left join classes c2 on c2.id = o.class_id
      where p.new_room is not null and o.room_id = p.new_room
        and o.status <> 'cancelled'
        and o.id not in (select sid from _resched_plan)
        and tsrange(o.date + o.start_time, o.date + o.end_time)
            && tsrange(p.new_date + p.new_start, p.new_date + p.new_end)
      limit 1)
  )
  where p.changed;

  if p_apply then
    if exists (select 1 from _resched_plan where changed and conflict is not null) then
      raise exception 'Còn buổi trùng giờ giáo viên/phòng với lớp khác — xem trước để biết buổi nào.'
        using errcode = '23P01';
    end if;

    perform set_config('classhub.bulk_reschedule', 'on', true);

    -- Bước 1: "đỗ tạm" các buổi sắp đổi vào khung 00:00:0x, bỏ GV/phòng, để
    -- unique (lớp, ngày, giờ) và chặn trùng GV/phòng không vướng chính các
    -- buổi của lớp đang đổi chỗ cho nhau (ràng buộc kiểm tra từng dòng).
    update sessions s
       set teacher_id = null, room_id = null,
           start_time = time '00:00' + p.rn * interval '1 second',
           end_time = time '00:00' + (p.rn + 1) * interval '1 second'
      from _resched_plan p
     where s.id = p.sid and p.changed;

    -- Bước 2: đưa về khung mới
    update sessions s
       set date = p.new_date, start_time = p.new_start, end_time = p.new_end,
           room_id = p.new_room, teacher_id = p.new_teacher
      from _resched_plan p
     where s.id = p.sid and p.changed;

    perform set_config('classhub.bulk_reschedule', 'off', true);

    select count(*) into v_changed from _resched_plan where changed;
    if v_changed > 0 then
      select c.name into v_class from classes c where c.id = p_class_id;
      select string_agg(
               (array['CN','T2','T3','T4','T5','T6','T7'])[cs.weekday + 1] || ' '
                 || to_char(cs.start_time, 'HH24:MI') || '–' || to_char(cs.end_time, 'HH24:MI'),
               ', ' order by (cs.weekday + 6) % 7, cs.start_time)
        into v_schedule
        from class_schedules cs where cs.class_id = p_class_id;

      with stu as (
        select cs.student_id as sid
        from class_students cs
        where cs.class_id = p_class_id and cs.status = 'active'
        union
        select mc.student_id
        from makeup_credits mc
        join _resched_plan p on p.sid = mc.makeup_session_id and p.changed
        where mc.status = 'scheduled'
      )
      insert into notifications (recipient_id, type, title, body, link)
      select r.pid, 'schedule_change', 'Lớp đổi lịch học',
             'Lớp ' || coalesce(v_class, '?') || ' đổi lịch từ ngày '
               || to_char(p_from, 'DD/MM/YYYY') || ': ' || coalesce(v_schedule, '') || ' ('
               || v_changed || ' buổi được dời).',
             r.link
      from (
        select sid as pid, '/student'::text as link from stu
        union
        select ps.parent_id, '/parent'
        from parent_students ps
        join stu on stu.sid = ps.student_id
      ) r;
    end if;
  end if;

  return query
    select p.sid, p.session_no, p.old_date, p.old_start, p.old_end,
           p.new_date, p.new_start, p.new_end, p.conflict
      from _resched_plan p
     where p.changed
     order by p.rn;
end;
$$;

revoke all on function public.reschedule_class_sessions(uuid, date, boolean) from public;
grant execute on function public.reschedule_class_sessions(uuid, date, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Xoá buổi đã sinh nhưng chưa học (sinh dư, sinh nhầm giờ...)
--    Chỉ xoá buổi 'scheduled' chưa chấm công, chưa điểm danh; buổi khác
--    trong danh sách được bỏ qua. HV đã được xếp bù vào buổi bị xoá thì
--    quyền học bù trả về 'pending' (hàng "Chờ xếp bù") — FK
--    makeup_credits.makeup_session_id không cascade nên phải gỡ trước.
--    Trả về số buổi đã xoá.
-- ---------------------------------------------------------------------
create or replace function public.delete_unheld_sessions(p_session_ids uuid[])
returns int
security definer
set search_path = public
language plpgsql
as $$
declare
  v_ids uuid[];
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền xoá buổi học.' using errcode = '42501';
  end if;

  select coalesce(array_agg(s.id), '{}') into v_ids
  from sessions s
  where s.id = any (p_session_ids)
    and s.status = 'scheduled'
    and not exists (select 1 from teaching_logs t where t.session_id = s.id)
    and not exists (select 1 from attendance att where att.session_id = s.id);

  update makeup_credits
     set makeup_session_id = null, status = 'pending'
   where makeup_session_id = any (v_ids) and status = 'scheduled';

  delete from sessions where id = any (v_ids);
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke all on function public.delete_unheld_sessions(uuid[]) from public;
grant execute on function public.delete_unheld_sessions(uuid[]) to authenticated;
