-- =====================================================================
-- 0030: HỒ SƠ HỌC VIÊN ĐẦY ĐỦ (form "Học viên mới")
--
-- Trước: hồ sơ học viên chỉ có tên / điện thoại / email / địa chỉ / ghi chú;
--        "đang học hay đã nghỉ" phải suy ngược từ class_students, ngày nhập
--        học lấy tạm created_at, người phụ trách thì không có chỗ nào lưu.
--
-- Migration này bổ sung đúng những gì form nhập cần, chia làm 3 phần:
--   1. Cột mới trên `profiles`: ngày sinh, ngày nhập học, trạng thái học,
--      người phụ trách.
--   2. `student_courses` — ghi danh khóa học (em đang theo chương trình
--      nào). Tiền vẫn nằm ở enrollment_packages, hai việc tách bạch:
--      ghi danh là chuyên môn, gói buổi là kế toán.
--   3. `student_schedules` — ca học riêng NGOÀI lớp (kèm 1-1, ca lẻ).
--      Lịch của lớp vẫn là class_schedules; bảng này chỉ dành cho phần
--      lịch mà lớp không phủ, nên không có hai nguồn sự thật cho cùng
--      một buổi.
--
-- Trạng thái học (`study_status`) từ nay là NGUỒN DUY NHẤT thay cho việc
-- suy từ lớp: học viên bảo lưu vẫn còn tên trong lớp, còn em đã nghỉ thì
-- có khi vẫn chưa ai gỡ khỏi lớp — suy ngược luôn sai một trong hai ca.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột mới của hồ sơ
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists enrolled_at date;
alter table public.profiles add column if not exists study_status text;
alter table public.profiles add column if not exists owner_id uuid
  references public.profiles (id) on delete set null;

comment on column public.profiles.dob is 'Ngày sinh (dùng cho danh sách sinh nhật)';
comment on column public.profiles.enrolled_at is 'Ngày nhập học của học viên';
comment on column public.profiles.study_status is
  'studying = đang học, reserved = bảo lưu, left = đã nghỉ. Chỉ có nghĩa với role student.';
comment on column public.profiles.owner_id is
  'Nhân viên/giáo viên phụ trách chăm sóc học viên này';

-- Điền dữ liệu cũ trước khi đặt NOT NULL: đang có tên trong lớp = đang học,
-- từng học mà lớp đã kết thúc/chuyển đi = đã nghỉ, chưa vào lớp nào = đang học
-- (mới ghi danh, chờ xếp lớp — không phải đã nghỉ).
update public.profiles p
   set study_status = case
         when exists (select 1 from public.class_students cs
                       where cs.student_id = p.id and cs.status = 'active') then 'studying'
         when exists (select 1 from public.class_students cs
                       where cs.student_id = p.id) then 'left'
         else 'studying'
       end
 where p.role = 'student' and p.study_status is null;

update public.profiles set study_status = 'studying'
 where study_status is null;

update public.profiles p
   set enrolled_at = coalesce(
         (select min(cs.joined_at) from public.class_students cs where cs.student_id = p.id),
         p.created_at::date)
 where p.role = 'student' and p.enrolled_at is null;

alter table public.profiles alter column study_status set default 'studying';
alter table public.profiles alter column study_status set not null;

alter table public.profiles drop constraint if exists profiles_study_status_check;
alter table public.profiles add constraint profiles_study_status_check
  check (study_status in ('studying', 'reserved', 'left'));

create index if not exists profiles_owner_idx on public.profiles (owner_id);
create index if not exists profiles_study_status_idx on public.profiles (study_status)
  where role = 'student';

-- ---------------------------------------------------------------------
-- 2. Ghi danh khóa học
-- ---------------------------------------------------------------------
create table if not exists public.student_courses (
  student_id uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  registered_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create index if not exists student_courses_course_idx
  on public.student_courses (course_id);

alter table public.student_courses enable row level security;

drop policy if exists "staff manage student courses" on public.student_courses;
create policy "staff manage student courses" on public.student_courses
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "read own student courses" on public.student_courses;
create policy "read own student courses" on public.student_courses
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or public.has_perm('classes.manage')
    or public.has_perm('tuition.manage')
  );

-- ---------------------------------------------------------------------
-- 3. Ca học riêng ngoài lớp
-- ---------------------------------------------------------------------
create table if not exists public.student_schedules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Chủ nhật
  start_time time not null,
  end_time time,
  teacher_id uuid references public.profiles (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists student_schedules_student_idx
  on public.student_schedules (student_id, weekday);

alter table public.student_schedules enable row level security;

drop policy if exists "staff manage student schedules" on public.student_schedules;
create policy "staff manage student schedules" on public.student_schedules
  for all using (public.has_perm('students.manage') or public.has_perm('classes.manage'))
  with check (public.has_perm('students.manage') or public.has_perm('classes.manage'));

drop policy if exists "read own student schedules" on public.student_schedules;
create policy "read own student schedules" on public.student_schedules
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or teacher_id = public.my_profile_id()
    or public.is_staff()
  );
