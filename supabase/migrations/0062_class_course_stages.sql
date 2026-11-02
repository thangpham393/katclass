-- =====================================================================
-- 0062: LỚP LÊN KHÓA MỚI + CHẶN SINH BUỔI KHI KHÓA ĐÃ ĐỦ BUỔI.
-- Chạy SAU 0061_care_requests.sql.
--
-- Trước đây lớp chỉ gắn MỘT khóa và tiến độ đếm mọi buổi từ ngày khai
-- giảng: lớp học xong YCT 1 (24 buổi) rồi học tiếp YCT 2 thì hiện "30/24,
-- còn 0", đổi khóa sang YCT 2 cũng vẫn đếm từ buổi 1.
--
-- 1. classes.course_started_on: ngày khóa HIỆN TẠI của lớp bắt đầu (null =
--    từ đầu lớp). Tiến độ (view class_progress) chỉ đếm buổi từ ngày đó.
-- 2. class_course_history: các khóa lớp đã học xong (khóa, từ ngày, đến
--    ngày, số buổi) — giữ lịch sử khi lên khóa.
-- 3. advance_class_course(lớp, khóa mới, từ ngày): ghi khóa cũ vào lịch sử,
--    gắn khóa mới, đánh lại số buổi từ ngày đó (buổi 1, 2...), ghi danh
--    khóa mới cho học viên đang học (student_courses).
-- 4. Trigger chặn THÊM buổi của lớp khi khóa hiện tại đã đủ số buổi (buổi
--    lớp nghỉ không tính) — muốn sinh tiếp phải lên khóa mới.
-- =====================================================================

alter table public.classes add column if not exists course_started_on date;

comment on column public.classes.course_started_on is
  'Ngày khóa hiện tại của lớp bắt đầu (null = từ đầu lớp); tiến độ chỉ đếm buổi từ ngày này';

create table if not exists public.class_course_history (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  course_name text,
  started_on date,
  ended_on date not null,
  sessions int not null default 0,
  created_by uuid references public.profiles (id) on delete set null default public.my_profile_id(),
  created_at timestamptz not null default now()
);

create index if not exists class_course_history_class_idx
  on public.class_course_history (class_id, ended_on);

alter table public.class_course_history enable row level security;

drop policy if exists "read class course history" on public.class_course_history;
create policy "read class course history" on public.class_course_history
  for select using (public.is_staff() or public.can_view_class(class_id));

drop policy if exists "manage class course history" on public.class_course_history;
create policy "manage class course history" on public.class_course_history
  for all using (public.has_perm('classes.manage'))
  with check (public.has_perm('classes.manage'));

-- ---------------------------------------------------------------------
-- Tiến độ chỉ tính buổi thuộc khóa hiện tại
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
join public.classes c on c.id = s.class_id
where c.course_started_on is null or s.date >= c.course_started_on
group by s.class_id;

grant select on public.class_progress to authenticated;

-- ---------------------------------------------------------------------
-- Lên khóa mới
-- ---------------------------------------------------------------------
create or replace function public.advance_class_course(
  p_class_id uuid,
  p_course_id uuid,
  p_from date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cls public.classes;
  v_old_start date;
  v_old_name text;
  v_count int;
  v_renumbered int;
begin
  if not public.has_perm('classes.manage') then
    raise exception 'Bạn không có quyền quản lý lớp.' using errcode = '42501';
  end if;
  if p_from is null then
    raise exception 'Chọn ngày bắt đầu khóa mới.';
  end if;

  select * into v_cls from public.classes where id = p_class_id for update;
  if v_cls.id is null then
    raise exception 'Không tìm thấy lớp.';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Không tìm thấy khóa học.';
  end if;
  if p_course_id = v_cls.course_id then
    raise exception 'Lớp đang học đúng khóa này rồi — chọn khóa tiếp theo.';
  end if;

  v_old_start := coalesce(
    v_cls.course_started_on,
    (select min(date) from public.sessions where class_id = p_class_id and status <> 'cancelled'),
    v_cls.start_date
  );
  if v_old_start is not null and p_from <= v_old_start then
    raise exception 'Ngày bắt đầu khóa mới phải sau ngày bắt đầu khóa hiện tại (%).',
      to_char(v_old_start, 'DD/MM/YYYY');
  end if;

  -- Khóa cũ vào lịch sử
  if v_cls.course_id is not null then
    select name into v_old_name from public.courses where id = v_cls.course_id;
    select count(*) into v_count
      from public.sessions
     where class_id = p_class_id
       and status <> 'cancelled'
       and (v_old_start is null or date >= v_old_start)
       and date < p_from;
    insert into public.class_course_history (class_id, course_id, course_name, started_on, ended_on, sessions)
    values (p_class_id, v_cls.course_id, v_old_name, v_old_start, p_from - 1, v_count);
  end if;

  update public.classes
     set course_id = p_course_id,
         course_started_on = p_from
   where id = p_class_id;

  -- Đánh lại số buổi của khóa mới: 1, 2, 3... theo thứ tự ngày giờ
  with numbered as (
    select id, row_number() over (order by date, start_time) as rn
      from public.sessions
     where class_id = p_class_id and date >= p_from
  )
  update public.sessions s
     set session_no = n.rn
    from numbered n
   where s.id = n.id;
  get diagnostics v_renumbered = row_count;

  -- Học viên đang học được ghi danh khóa mới
  insert into public.student_courses (student_id, course_id, registered_at)
  select cs.student_id, p_course_id, p_from
    from public.class_students cs
   where cs.class_id = p_class_id and cs.status = 'active'
  on conflict do nothing;

  return v_renumbered;
end;
$$;

revoke all on function public.advance_class_course(uuid, uuid, date) from public;
grant execute on function public.advance_class_course(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- Chặn thêm buổi khi khóa hiện tại đã đủ buổi
-- ---------------------------------------------------------------------
create or replace function public.block_sessions_beyond_course()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_name text;
  v_from date;
  v_count int;
begin
  if new.class_id is null or new.status = 'cancelled' then
    return new;
  end if;

  select co.total_sessions, co.name, c.course_started_on
    into v_total, v_name, v_from
    from public.classes c
    left join public.courses co on co.id = c.course_id
   where c.id = new.class_id;

  if v_total is null or v_total <= 0 then
    return new; -- khóa không ghi tổng buổi thì không giới hạn được
  end if;

  select count(*) into v_count
    from public.sessions
   where class_id = new.class_id
     and status <> 'cancelled'
     and (v_from is null or date >= v_from);

  if v_count >= v_total then
    raise exception 'Khóa "%" đã đủ % buổi. Bấm "Lên khóa mới" ở trang lớp để sinh buổi cho khóa tiếp theo.',
      v_name, v_total
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists block_sessions_beyond_course on public.sessions;
create trigger block_sessions_beyond_course
  before insert on public.sessions
  for each row execute function public.block_sessions_beyond_course();
