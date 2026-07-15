-- =====================================================================
-- GIAI ĐOẠN 1 (phần lõi): cơ sở, khóa học, lớp, buổi học, điểm danh,
-- học bù, nhận xét sau buổi.
-- Chạy SAU 0001_profiles.sql. Chạy TRƯỚC 0003_content.sql.
--
-- Chính sách đã chốt (2026-07-15):
--   - Vắng CÓ PHÉP: vẫn trừ buổi trong gói, được xếp học bù.
--   - Vắng KHÔNG PHÉP: trừ buổi, không học bù.
--   - Buổi học bù: không trừ thêm buổi (đã trừ ở buổi vắng).
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1. Vai trò: bổ sung parent (phụ huynh) và staff (hành chính/trợ giảng)
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'parent', 'teacher', 'staff', 'admin'));

-- ---------------------------------------------------------------------
-- 2. Cơ sở (chi nhánh)
-- ---------------------------------------------------------------------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column branch_id uuid references public.branches (id);
alter table public.profiles add column phone text;

-- ---------------------------------------------------------------------
-- 3. Liên kết phụ huynh ↔ con (một phụ huynh có thể có nhiều con)
-- ---------------------------------------------------------------------
create table public.parent_students (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  relationship text not null default 'guardian', -- father / mother / guardian...
  primary key (parent_id, student_id)
);

-- ---------------------------------------------------------------------
-- 4. Khóa học (khuôn mẫu) / phòng học / lớp học (instance của khóa)
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches (id),
  name text not null,
  level text check (level in ('HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','KIDS','GIAO_TIEP','OTHER')),
  total_sessions int not null default 0, -- số buổi chuẩn của khóa
  description text,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches (id),
  name text not null,
  capacity int
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches (id),
  course_id uuid references public.courses (id),
  name text not null,
  teacher_id uuid references public.profiles (id), -- giáo viên phụ trách
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  start_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Lịch lặp hằng tuần của lớp (dùng để sinh ra các buổi học cụ thể)
create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Chủ nhật
  start_time time not null,
  end_time time not null check (end_time > start_time),
  room_id uuid references public.rooms (id)
);

create table public.class_students (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'transferred', 'finished')),
  joined_at date not null default current_date,
  primary key (class_id, student_id)
);

-- ---------------------------------------------------------------------
-- 5. Buổi học cụ thể
-- ---------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  session_no int, -- buổi thứ mấy của khóa
  date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  room_id uuid references public.rooms (id),
  teacher_id uuid references public.profiles (id), -- giáo viên thực dạy (có thể dạy thay)
  type text not null default 'regular' check (type in ('regular', 'makeup')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled')),
  note text,
  unique (class_id, date, start_time)
);

-- Chặn xung đột ngay ở tầng DB: một phòng / một giáo viên
-- không thể có 2 buổi chồng giờ nhau (bỏ qua buổi đã hủy).
alter table public.sessions add constraint sessions_no_room_overlap
  exclude using gist (
    room_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  ) where (status <> 'cancelled' and room_id is not null);

alter table public.sessions add constraint sessions_no_teacher_overlap
  exclude using gist (
    teacher_id with =,
    tsrange((date + start_time), (date + end_time)) with &&
  ) where (status <> 'cancelled' and teacher_id is not null);

-- ---------------------------------------------------------------------
-- 6. Điểm danh & học bù
-- ---------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in (
    'present',           -- có mặt (trừ buổi)
    'absent_excused',    -- vắng có phép (trừ buổi + sinh quyền học bù)
    'absent_unexcused',  -- vắng không phép (trừ buổi, không học bù)
    'makeup'             -- đi học bù buổi này (không trừ buổi)
  )),
  note text,
  marked_by uuid references public.profiles (id),
  marked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.makeup_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  missed_session_id uuid not null references public.sessions (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'attended', 'expired', 'cancelled')),
  makeup_session_id uuid references public.sessions (id), -- buổi được xếp bù
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, missed_session_id)
);

-- Vắng có phép → tự sinh quyền học bù
create function public.handle_excused_absence()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.status = 'absent_excused' then
    insert into public.makeup_credits (student_id, missed_session_id)
    values (new.student_id, new.session_id)
    on conflict (student_id, missed_session_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_excused_absence
  after insert or update of status on public.attendance
  for each row execute function public.handle_excused_absence();

-- ---------------------------------------------------------------------
-- 7. Nhận xét học viên sau mỗi buổi học (phụ huynh xem được)
-- ---------------------------------------------------------------------
create table public.session_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id),
  content text not null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- =====================================================================
-- 8. Hàm hỗ trợ phân quyền (security definer để không đệ quy RLS)
-- =====================================================================
create function public.my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_staff()
returns boolean
language sql stable
as $$
  select public.my_role() in ('staff', 'admin');
$$;

-- Phụ huynh của học viên này?
create function public.is_my_student(sid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students
    where parent_id = auth.uid() and student_id = sid
  );
$$;

-- Được xem lớp này? (staff/admin, GV phụ trách, học viên trong lớp,
-- hoặc phụ huynh có con trong lớp)
create function public.can_view_class(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = cid and c.teacher_id = auth.uid())
    or exists (select 1 from public.class_students cs
               where cs.class_id = cid and cs.student_id = auth.uid())
    or exists (select 1 from public.class_students cs
               join public.parent_students ps on ps.student_id = cs.student_id
               where cs.class_id = cid and ps.parent_id = auth.uid());
$$;

-- Giáo viên đứng buổi này? (GV phụ trách lớp hoặc GV thực dạy buổi)
create function public.teaches_session(sess uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.id = sess
      and (s.teacher_id = auth.uid() or c.teacher_id = auth.uid())
  );
$$;

-- =====================================================================
-- 9. Row Level Security
-- =====================================================================
alter table public.branches enable row level security;
alter table public.parent_students enable row level security;
alter table public.courses enable row level security;
alter table public.rooms enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_students enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.makeup_credits enable row level security;
alter table public.session_comments enable row level security;

-- profiles: mở rộng quyền đọc (0001 mới chỉ cho đọc hồ sơ của chính mình)
create policy "staff and teachers read all profiles" on public.profiles
  for select using (public.my_role() in ('teacher', 'staff', 'admin'));
create policy "parents read their children" on public.profiles
  for select using (public.is_my_student(id));
create policy "admin manages profiles" on public.profiles
  for update using (public.my_role() = 'admin');

-- branches / courses / rooms: ai đăng nhập cũng đọc được, staff/admin quản lý
create policy "read branches" on public.branches
  for select using (auth.uid() is not null);
create policy "staff manage branches" on public.branches
  for all using (public.is_staff()) with check (public.is_staff());

create policy "read courses" on public.courses
  for select using (auth.uid() is not null);
create policy "staff manage courses" on public.courses
  for all using (public.is_staff()) with check (public.is_staff());

create policy "read rooms" on public.rooms
  for select using (auth.uid() is not null);
create policy "staff manage rooms" on public.rooms
  for all using (public.is_staff()) with check (public.is_staff());

-- parent_students
create policy "read own family links" on public.parent_students
  for select using (parent_id = auth.uid() or student_id = auth.uid() or public.is_staff());
create policy "staff manage family links" on public.parent_students
  for all using (public.is_staff()) with check (public.is_staff());

-- classes / lịch / danh sách lớp
create policy "view own classes" on public.classes
  for select using (public.can_view_class(id));
create policy "staff manage classes" on public.classes
  for all using (public.is_staff()) with check (public.is_staff());

create policy "view class schedules" on public.class_schedules
  for select using (public.can_view_class(class_id));
create policy "staff manage class schedules" on public.class_schedules
  for all using (public.is_staff()) with check (public.is_staff());

create policy "view class members" on public.class_students
  for select using (
    student_id = auth.uid()
    or public.is_my_student(student_id)
    or public.can_view_class(class_id)
  );
create policy "staff manage class members" on public.class_students
  for all using (public.is_staff()) with check (public.is_staff());

-- sessions: người trong lớp xem; học viên học bù xem buổi được xếp bù
create policy "view sessions" on public.sessions
  for select using (
    public.can_view_class(class_id)
    or exists (select 1 from public.makeup_credits mc
               where mc.makeup_session_id = sessions.id
                 and mc.student_id = auth.uid())
  );
create policy "staff manage sessions" on public.sessions
  for all using (public.is_staff()) with check (public.is_staff());
create policy "teachers update own sessions" on public.sessions
  for update using (teacher_id = auth.uid());

-- attendance: học viên xem của mình, phụ huynh xem của con,
-- GV đứng buổi thì điểm danh được
create policy "view attendance" on public.attendance
  for select using (
    student_id = auth.uid()
    or public.is_my_student(student_id)
    or public.is_staff()
    or public.teaches_session(session_id)
  );
create policy "teachers and staff mark attendance" on public.attendance
  for insert with check (public.is_staff() or public.teaches_session(session_id));
create policy "teachers and staff update attendance" on public.attendance
  for update using (public.is_staff() or public.teaches_session(session_id));
create policy "staff delete attendance" on public.attendance
  for delete using (public.is_staff());

-- makeup_credits: học viên/phụ huynh xem, staff xếp lịch
create policy "view makeup credits" on public.makeup_credits
  for select using (
    student_id = auth.uid()
    or public.is_my_student(student_id)
    or public.is_staff()
  );
create policy "staff manage makeup credits" on public.makeup_credits
  for all using (public.is_staff()) with check (public.is_staff());

-- session_comments: GV viết cho buổi mình dạy; học viên/phụ huynh đọc
create policy "view session comments" on public.session_comments
  for select using (
    student_id = auth.uid()
    or public.is_my_student(student_id)
    or public.is_staff()
    or teacher_id = auth.uid()
  );
create policy "teachers write session comments" on public.session_comments
  for insert with check (teacher_id = auth.uid() and public.teaches_session(session_id));
create policy "teachers update own comments" on public.session_comments
  for update using (teacher_id = auth.uid());
create policy "staff manage session comments" on public.session_comments
  for all using (public.is_staff()) with check (public.is_staff());
