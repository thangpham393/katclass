-- =====================================================================
-- 0057: SỬA NGÀY BẮT ĐẦU CỦA LỚP.
-- Chạy SAU 0056_class_end_clears_sessions.sql.
--
-- change_class_start_date(lớp, ngày mới, áp dụng?) đổi classes.start_date và
-- xếp lại các buổi đã sinh từ ngày mới theo lịch tuần, giữ thứ tự buổi.
-- p_apply = false → chỉ xem trước; true → đổi thật (trùng giờ GV/phòng với
-- lớp khác thì báo lỗi, không đổi gì).
--
-- Lớp đã có buổi đã học (chấm công / điểm danh / hoàn thành) hoặc buổi bù cả
-- lớp thì không đổi được: ngày bắt đầu khi đó là buổi đầu đã dạy, còn dời các
-- buổi còn lại thì dùng "Áp lịch tuần mới" (0055).
--
-- reschedule_class_sessions lọc buổi theo `date >= p_from` nên dời ngày bắt
-- đầu về SAU sẽ sót các buổi trước ngày mới → thêm p_all_unheld để lấy mọi
-- buổi chưa học. Thêm tham số là đổi chữ ký hàm nên phải drop bản cũ.
-- =====================================================================

drop function if exists public.reschedule_class_sessions(uuid, date, boolean);

create or replace function public.reschedule_class_sessions(
  p_class_id uuid,
  p_from date default current_date,
  p_apply boolean default false,
  p_all_unheld boolean default false
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
      and (p_all_unheld or s.date >= p_from)
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

revoke all on function public.reschedule_class_sessions(uuid, date, boolean, boolean) from public;
grant execute on function public.reschedule_class_sessions(uuid, date, boolean, boolean) to authenticated;

create or replace function public.change_class_start_date(
  p_class_id uuid,
  p_start date,
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
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền sửa lịch lớp.' using errcode = '42501';
  end if;
  if p_start is null then
    raise exception 'Chưa chọn ngày bắt đầu.';
  end if;

  if exists (
    select 1 from sessions s
    where s.class_id = p_class_id
      and s.status <> 'cancelled'
      and (
        s.type <> 'regular'
        or s.status <> 'scheduled'
        or exists (select 1 from teaching_logs t where t.session_id = s.id)
        or exists (select 1 from attendance att where att.session_id = s.id)
      )
  ) then
    raise exception 'Lớp đã có buổi đã học hoặc buổi bù nên không đổi được ngày bắt đầu. Muốn dời các buổi còn lại, dùng "Áp lịch tuần mới".';
  end if;

  if p_apply then
    update classes set start_date = p_start where id = p_class_id;
  end if;

  if exists (
    select 1 from sessions s
    where s.class_id = p_class_id and s.status = 'scheduled'
  ) then
    return query
      select * from public.reschedule_class_sessions(p_class_id, p_start, p_apply, true);
  end if;
end;
$$;

revoke all on function public.change_class_start_date(uuid, date, boolean) from public;
grant execute on function public.change_class_start_date(uuid, date, boolean) to authenticated;
