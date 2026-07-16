-- =====================================================================
-- GIAI ĐOẠN 2 (phần 2): GV đăng ký nghỉ / đề xuất đổi buổi
-- → admin duyệt (xếp dạy thay / hủy buổi / áp lịch mới) + thông báo.
-- Chạy SAU 0014_lesson_visibility.sql.
--
-- Luồng:
--   1. GV chọn một buổi sắp tới của mình, gửi yêu cầu:
--      - 'leave'      : xin nghỉ buổi đó (admin xếp GV dạy thay hoặc hủy buổi)
--      - 'reschedule' : đề xuất đổi buổi sang ngày/giờ khác
--   2. Admin duyệt: cập nhật buổi học (client) rồi chốt yêu cầu.
--      Trùng lịch GV/phòng đã có exclusion constraint chặn (lỗi 23P01).
--   3. Thông báo tự sinh bằng trigger:
--      - GV gửi yêu cầu       → báo admin/staff ('request_new')
--      - Admin chốt yêu cầu   → báo GV kết quả ('request_resolved')
--      - Duyệt có GV dạy thay → báo GV thay + HV/PH lớp ('schedule_change')
--      - Buổi bị đổi ngày/giờ hoặc hủy (bất kể nguồn nào, kể cả admin sửa
--        tay) → báo HV active của lớp + HV được xếp học bù vào buổi đó
--        + PH của các HV ('schedule_change').
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bảng yêu cầu nghỉ / đổi buổi
-- ---------------------------------------------------------------------
create table public.session_change_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('leave', 'reschedule')),
  reason text,
  -- đề xuất lịch mới (bắt buộc với type = 'reschedule')
  proposed_date date,
  proposed_start_time time,
  proposed_end_time time,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- kết quả duyệt
  resolution text check (resolution in ('substitute', 'cancel_session', 'reschedule')),
  substitute_teacher_id uuid references public.profiles (id),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reschedule_needs_proposal check (
    type <> 'reschedule'
    or (proposed_date is not null
        and proposed_start_time is not null
        and proposed_end_time is not null
        and proposed_end_time > proposed_start_time)
  )
);

create index session_change_requests_teacher_idx
  on public.session_change_requests (teacher_id, created_at desc);
create index session_change_requests_status_idx
  on public.session_change_requests (status, created_at desc);

-- Mỗi buổi chỉ có tối đa 1 yêu cầu đang chờ duyệt
create unique index session_change_requests_pending_uniq
  on public.session_change_requests (session_id)
  where status = 'pending';

-- ---------------------------------------------------------------------
-- 2. Nới check constraint type thông báo (thêm 3 type mới)
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'homework_new',      -- bài tập mới được giao
    'makeup_scheduled',  -- được xếp lịch học bù
    'child_absent',      -- con vắng mặt (gửi phụ huynh)
    'package_low',       -- gói buổi sắp hết / đã hết
    'schedule_change',   -- buổi học đổi lịch / hủy / đổi GV (gửi HV + PH)
    'request_new',       -- GV gửi yêu cầu nghỉ/đổi buổi (gửi admin/staff)
    'request_resolved',  -- kết quả duyệt yêu cầu (gửi GV)
    'generic'
  ));

-- ---------------------------------------------------------------------
-- 3. Trigger: buổi học bị đổi ngày/giờ hoặc hủy → báo HV + PH
--    (bắn cho MỌI nguồn thay đổi: duyệt yêu cầu, admin sửa tay...)
-- ---------------------------------------------------------------------
create or replace function public.notify_session_schedule_change()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_class text;
  v_title text;
  v_body text;
  v_time_changed boolean;
  v_cancelled boolean;
begin
  -- buổi đã hủy từ trước thì thôi
  if old.status = 'cancelled' then return new; end if;

  v_time_changed := (old.date, old.start_time, old.end_time)
    is distinct from (new.date, new.start_time, new.end_time);
  v_cancelled := new.status = 'cancelled';
  if not v_time_changed and not v_cancelled then return new; end if;

  -- chỉ báo cho buổi chưa diễn ra (lịch cũ hoặc mới còn ở tương lai)
  if greatest(old.date, new.date) < current_date then return new; end if;

  select c.name into v_class from classes c where c.id = new.class_id;

  if v_cancelled then
    v_title := 'Buổi học bị hủy';
    v_body := 'Lớp ' || coalesce(v_class, '?') || ': buổi '
      || to_char(new.date, 'DD/MM/YYYY') || ' ('
      || to_char(new.start_time, 'HH24:MI') || '–'
      || to_char(new.end_time, 'HH24:MI') || ') đã bị hủy.';
  else
    v_title := 'Buổi học đổi lịch';
    v_body := 'Lớp ' || coalesce(v_class, '?') || ': buổi '
      || to_char(old.date, 'DD/MM/YYYY') || ' ' || to_char(old.start_time, 'HH24:MI')
      || ' chuyển sang ' || to_char(new.date, 'DD/MM/YYYY') || ' '
      || to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI') || '.';
  end if;

  -- HV active của lớp + HV được xếp học bù vào buổi này + PH của các HV
  with stu as (
    select cs.student_id as sid
    from class_students cs
    where cs.class_id = new.class_id and cs.status = 'active'
    union
    select mc.student_id
    from makeup_credits mc
    where mc.makeup_session_id = new.id and mc.status = 'scheduled'
  )
  insert into notifications (recipient_id, type, title, body, link)
  select r.pid, 'schedule_change', v_title, v_body, r.link
  from (
    select sid as pid, '/student'::text as link from stu
    union
    select ps.parent_id, '/parent'
    from parent_students ps
    join stu on stu.sid = ps.student_id
  ) r;

  return new;
end;
$$;

create trigger on_session_schedule_change
  after update on public.sessions
  for each row execute function public.notify_session_schedule_change();

-- ---------------------------------------------------------------------
-- 4. Trigger trên yêu cầu: báo admin khi GV gửi, báo GV khi được chốt,
--    báo GV dạy thay + HV/PH khi duyệt có dạy thay
-- ---------------------------------------------------------------------
create or replace function public.notify_change_request_events()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_sess record;
  v_teacher text;
  v_sub text;
  v_label text;
begin
  select s.date, s.start_time, s.class_id, c.name as class_name
    into v_sess
  from sessions s
  left join classes c on c.id = s.class_id
  where s.id = new.session_id;

  v_label := 'Buổi ' || to_char(v_sess.date, 'DD/MM/YYYY') || ' lúc '
    || to_char(v_sess.start_time, 'HH24:MI')
    || ' · lớp ' || coalesce(v_sess.class_name, '?');

  -- GV gửi yêu cầu mới → báo mọi admin/staff
  if tg_op = 'INSERT' and new.status = 'pending' then
    select name into v_teacher from profiles where id = new.teacher_id;
    insert into notifications (recipient_id, type, title, body, link)
    select p.id, 'request_new',
           case when new.type = 'leave'
             then 'GV xin nghỉ buổi dạy: ' || coalesce(v_teacher, '?')
             else 'GV đề xuất đổi buổi: ' || coalesce(v_teacher, '?') end,
           v_label || coalesce(' — ' || nullif(trim(new.reason), ''), ''),
           '/admin/requests'
    from profiles p
    where p.role in ('admin', 'staff');
    return new;
  end if;

  -- Admin chốt yêu cầu (duyệt / từ chối)
  if tg_op = 'UPDATE' and old.status = 'pending'
     and new.status in ('approved', 'rejected') then

    -- báo GV gửi yêu cầu
    insert into notifications (recipient_id, type, title, body, link)
    values (
      new.teacher_id, 'request_resolved',
      case when new.status = 'approved'
        then case when new.type = 'leave'
          then 'Yêu cầu nghỉ buổi dạy đã được duyệt'
          else 'Đề xuất đổi buổi đã được duyệt' end
        else case when new.type = 'leave'
          then 'Yêu cầu nghỉ buổi dạy bị từ chối'
          else 'Đề xuất đổi buổi bị từ chối' end
      end,
      v_label || coalesce(' — ' || nullif(trim(new.resolution_note), ''), ''),
      '/teacher/requests'
    );

    -- duyệt kèm GV dạy thay → báo GV thay + HV/PH của lớp
    if new.status = 'approved' and new.substitute_teacher_id is not null then
      select name into v_sub from profiles where id = new.substitute_teacher_id;

      insert into notifications (recipient_id, type, title, body, link)
      values (new.substitute_teacher_id, 'schedule_change',
              'Bạn được xếp dạy thay', v_label, '/teacher');

      with stu as (
        select cs.student_id as sid
        from class_students cs
        where cs.class_id = v_sess.class_id and cs.status = 'active'
      )
      insert into notifications (recipient_id, type, title, body, link)
      select r.pid, 'schedule_change', 'Đổi giáo viên buổi học',
             'Lớp ' || coalesce(v_sess.class_name, '?') || ': buổi '
               || to_char(v_sess.date, 'DD/MM/YYYY')
               || ' sẽ do giáo viên ' || coalesce(v_sub, 'khác') || ' dạy thay.',
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

  return new;
end;
$$;

create trigger on_change_request_notify
  after insert or update on public.session_change_requests
  for each row execute function public.notify_change_request_events();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.session_change_requests enable row level security;

-- GV xem yêu cầu của mình (kể cả khi là GV được xếp dạy thay); staff thấy hết
create policy "read own change requests" on public.session_change_requests
  for select using (
    teacher_id = public.my_profile_id()
    or substitute_teacher_id = public.my_profile_id()
    or public.is_staff()
  );

-- GV chỉ tạo yêu cầu cho buổi mình dạy
create policy "teacher create change request" on public.session_change_requests
  for insert with check (
    teacher_id = public.my_profile_id()
    and public.teaches_session(session_id)
  );

-- GV rút yêu cầu của mình khi còn chờ duyệt (pending → cancelled)
create policy "teacher cancel own pending request" on public.session_change_requests
  for update using (
    teacher_id = public.my_profile_id() and status = 'pending'
  ) with check (
    teacher_id = public.my_profile_id() and status in ('pending', 'cancelled')
  );

-- Staff/admin toàn quyền (duyệt, từ chối, sửa)
create policy "staff manage change requests" on public.session_change_requests
  for all using (public.is_staff()) with check (public.is_staff());
