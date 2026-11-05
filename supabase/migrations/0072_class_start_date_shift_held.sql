-- =====================================================================
-- 0072: SỬA NGÀY BẮT ĐẦU KHI LỚP ĐÃ CÓ BUỔI ĐÃ HỌC.
-- Chạy SAU 0071_makeup_waive.sql.
--
-- Hay gặp: lớp sinh buổi từ ngày khai giảng dự kiến, thực tế khai giảng
-- lệch vài hôm nhưng GV vẫn chấm công / điểm danh vào các buổi đã sinh →
-- ngày của buổi đã học sai, mà 0057 chặn đổi ngày bắt đầu khi có buổi đã học.
--
-- change_class_start_date(..., p_include_held = true) xếp lại TẤT CẢ buổi
-- thường chưa hủy của lớp (cả buổi đã học) từ ngày mới theo lịch tuần, giữ
-- thứ tự buổi. Điểm danh / chấm công / nhận xét gắn theo session_id nên đi
-- theo buổi, không mất gì. Buổi đã học giữ nguyên GV đứng buổi + phòng
-- (có thể là GV dạy thay); buổi chưa học lấy GV/phòng theo lịch tuần như cũ.
--
-- Chặn: buổi đã học bị dời sang sau hôm nay (chọn ngày bắt đầu quá muộn);
-- lớp đã lên khóa mới (0062) — số buổi đánh lại theo từng khóa, dời cả lớp
-- sẽ lệch mốc course_started_on.
--
-- Lưu ý: bảng công /admin/payroll đếm theo ngày buổi → dời buổi đã học sang
-- tháng khác thì công chuyển theo tháng đó.
-- =====================================================================

drop function if exists public.change_class_start_date(uuid, date, boolean);
drop function if exists public.reschedule_class_sessions(uuid, date, boolean, boolean);

create or replace function public.reschedule_class_sessions(
  p_class_id uuid,
  p_from date default current_date,
  p_apply boolean default false,
  p_all_unheld boolean default false,
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
  with s0 as (
    select s.*,
           (s.status = 'completed'
             or exists (select 1 from teaching_logs t where t.session_id = s.id)
             or exists (select 1 from attendance att where att.session_id = s.id)) as held
    from sessions s
    where s.class_id = p_class_id
      and s.type = 'regular' -- buổi bù cả lớp xếp giờ riêng, không theo lịch tuần
      and s.status <> 'cancelled'
  ),
  a as (
    -- buổi được xếp lại: mặc định chỉ buổi chưa học; p_include_held thì mọi buổi
    select s0.id, s0.session_no, s0.date, s0.start_time, s0.end_time, s0.room_id, s0.teacher_id, s0.held,
           row_number() over (order by s0.date, s0.start_time) as rn
    from s0
    where p_include_held
       or (not s0.held and s0.status = 'scheduled' and (p_all_unheld or s0.date >= p_from))
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
  ),
  j as (
    select a.id as sid, a.rn, a.session_no, a.held,
           a.date as old_date, a.start_time as old_start, a.end_time as old_end,
           a.room_id as old_room, a.teacher_id as old_teacher,
           b.date as new_date, b.start_time as new_start, b.end_time as new_end,
           -- buổi đã học giữ GV đứng buổi (có thể là GV dạy thay) + phòng thực tế
           case when a.held then a.room_id else b.room_id end as new_room,
           case when a.held then a.teacher_id else b.teacher_id end as new_teacher
    from a join b on b.rn = a.rn
  )
  select j.*,
         (j.old_date, j.old_start, j.old_end, j.old_room, j.old_teacher)
           is distinct from (j.new_date, j.new_start, j.new_end, j.new_room, j.new_teacher) as changed
  from j;

  alter table _resched_plan add column conflict text;
  update _resched_plan p set conflict = case
    when p.held and p.new_date > current_date then
      'Buổi đã học không thể dời sang sau hôm nay — chọn ngày bắt đầu sớm hơn.'
    else coalesce(
      -- Trùng giờ với buổi của lớp khác (buổi trong kế hoạch thì sẽ dời đi, không tính)
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
    ) end
  where p.changed;

  if p_apply then
    if exists (select 1 from _resched_plan where changed and conflict is not null) then
      raise exception 'Còn buổi không dời được (trùng giờ GV/phòng hoặc buổi đã học rơi vào tương lai) — xem trước để biết buổi nào.'
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

    -- Chỉ báo HV/PH khi có buổi sắp tới bị dời; sửa ngày buổi đã qua thì thôi
    select count(*) into v_changed from _resched_plan
     where changed and (old_date >= current_date or new_date >= current_date);
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
               || to_char(greatest(p_from, current_date), 'DD/MM/YYYY') || ': ' || coalesce(v_schedule, '') || ' ('
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

revoke all on function public.reschedule_class_sessions(uuid, date, boolean, boolean, boolean) from public;
grant execute on function public.reschedule_class_sessions(uuid, date, boolean, boolean, boolean) to authenticated;

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
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền sửa lịch lớp.' using errcode = '42501';
  end if;
  if p_start is null then
    raise exception 'Chưa chọn ngày bắt đầu.';
  end if;

  if p_include_held then
    if exists (select 1 from classes c where c.id = p_class_id and c.course_started_on is not null) then
      raise exception 'Lớp đã lên khóa mới nên không dời cả buổi đã học được. Sửa ngày từng buổi ở danh sách buổi.';
    end if;
  elsif exists (
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
    raise exception 'Lớp đã có buổi đã học hoặc buổi bù. Tích "Dời cả buổi đã học" nếu ngày của các buổi đã học bị lệch so với thực tế.'
      using errcode = 'P0001', hint = 'held_sessions';
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
end;
$$;

revoke all on function public.change_class_start_date(uuid, date, boolean, boolean) from public;
grant execute on function public.change_class_start_date(uuid, date, boolean, boolean) to authenticated;
