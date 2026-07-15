-- =====================================================================
-- Tách profiles khỏi auth.users.
-- Lý do: học viên thực tế đa số KHÔNG có email/tài khoản đăng nhập —
-- hồ sơ phải tồn tại độc lập, khi nào học viên đăng nhập thì liên kết.
--
-- Thay đổi:
--   - profiles.id: uuid độc lập (business key, mọi FK giữ nguyên)
--   - profiles.user_id: liên kết auth.users, NULL nếu chưa có tài khoản
--   - Thêm student_code (mã học viên, unique), address, note
--   - Đăng ký mới: nếu có hồ sơ trùng email chưa liên kết → tự nối vào
--   - Toàn bộ RLS/RPC chuyển từ "auth.uid() = profile id"
--     sang my_profile_id() (tra profiles.user_id)
-- Chạy SAU 0003_content.sql, TRƯỚC file import học viên.
-- =====================================================================

-- 1. Cấu trúc
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column user_id uuid unique references auth.users (id) on delete set null;
update public.profiles set user_id = id;
alter table public.profiles add column student_code text unique;
alter table public.profiles add column address text;
alter table public.profiles add column note text;

-- 2. Hàm hỗ trợ
create function public.my_profile_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_my_student(sid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_students
    where parent_id = public.my_profile_id() and student_id = sid
  );
$$;

create or replace function public.can_view_class(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = cid and c.teacher_id = public.my_profile_id())
    or exists (select 1 from public.class_students cs
               where cs.class_id = cid and cs.student_id = public.my_profile_id())
    or exists (select 1 from public.class_students cs
               join public.parent_students ps on ps.student_id = cs.student_id
               where cs.class_id = cid and ps.parent_id = public.my_profile_id());
$$;

create or replace function public.teaches_session(sess uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.id = sess
      and (s.teacher_id = public.my_profile_id() or c.teacher_id = public.my_profile_id())
  );
$$;

-- 3. Đăng ký tài khoản mới: nối vào hồ sơ có sẵn (trùng email) hoặc tạo mới
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  update public.profiles
     set user_id = new.id,
         avatar = coalesce(avatar, new.raw_user_meta_data ->> 'avatar_url')
   where user_id is null
     and email <> ''
     and lower(email) = lower(coalesce(new.email, ''));

  if not found then
    insert into public.profiles (user_id, name, email, avatar)
    values (
      new.id,
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      coalesce(new.email, ''),
      new.raw_user_meta_data ->> 'avatar_url'
    );
  end if;
  return new;
end;
$$;

-- 4. Viết lại các policy so sánh trực tiếp với auth.uid()
drop policy "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (user_id = auth.uid());

drop policy "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (user_id = auth.uid() and role = 'student');

create policy "staff insert profiles" on public.profiles
  for insert with check (public.is_staff() and role in ('student', 'parent'));

drop policy "read own family links" on public.parent_students;
create policy "read own family links" on public.parent_students
  for select using (
    parent_id = public.my_profile_id()
    or student_id = public.my_profile_id()
    or public.is_staff()
  );

drop policy "view class members" on public.class_students;
create policy "view class members" on public.class_students
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.can_view_class(class_id)
  );

drop policy "view sessions" on public.sessions;
create policy "view sessions" on public.sessions
  for select using (
    public.can_view_class(class_id)
    or exists (select 1 from public.makeup_credits mc
               where mc.makeup_session_id = sessions.id
                 and mc.student_id = public.my_profile_id())
  );

drop policy "teachers update own sessions" on public.sessions;
create policy "teachers update own sessions" on public.sessions
  for update using (teacher_id = public.my_profile_id());

drop policy "view attendance" on public.attendance;
create policy "view attendance" on public.attendance
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or public.teaches_session(session_id)
  );

drop policy "view makeup credits" on public.makeup_credits;
create policy "view makeup credits" on public.makeup_credits
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
  );

drop policy "view session comments" on public.session_comments;
create policy "view session comments" on public.session_comments
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or teacher_id = public.my_profile_id()
  );

drop policy "teachers write session comments" on public.session_comments;
create policy "teachers write session comments" on public.session_comments
  for insert with check (
    teacher_id = public.my_profile_id() and public.teaches_session(session_id)
  );

drop policy "teachers update own comments" on public.session_comments;
create policy "teachers update own comments" on public.session_comments
  for update using (teacher_id = public.my_profile_id());

drop policy "teachers assign homeworks" on public.homeworks;
create policy "teachers assign homeworks" on public.homeworks
  for all using (
    public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = public.my_profile_id())
  )
  with check (
    public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = public.my_profile_id())
  );

drop policy "teachers manage homework questions" on public.homework_questions;
create policy "teachers manage homework questions" on public.homework_questions
  for all using (
    exists (select 1 from public.homeworks h
            join public.classes c on c.id = h.class_id
            where h.id = homework_id
              and (public.is_staff() or c.teacher_id = public.my_profile_id()))
  );

drop policy "view submissions" on public.submissions;
create policy "view submissions" on public.submissions
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = public.my_profile_id())
  );

drop policy "teachers grade submissions" on public.submissions;
create policy "teachers grade submissions" on public.submissions
  for update using (
    public.is_staff()
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = public.my_profile_id())
  );

-- 5. RPC nộp bài: dùng profile id thay vì auth.uid()
create or replace function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer
set search_path = public
language plpgsql
as $$
declare
  sid uuid := public.my_profile_id();
  total int;
  correct int;
  result public.submissions;
begin
  if sid is null then
    raise exception 'Không tìm thấy hồ sơ học viên';
  end if;

  if not exists (
    select 1
    from public.homeworks h
    join public.class_students cs on cs.class_id = h.class_id
    where h.id = hw_id and cs.student_id = sid
  ) then
    raise exception 'Bạn không có quyền nộp bài tập này';
  end if;

  select count(*),
         count(*) filter (where qa.answer = my_answers -> hq.question_id::text)
    into total, correct
  from public.homework_questions hq
  join public.question_answers qa on qa.question_id = hq.question_id
  where hq.homework_id = hw_id;

  insert into public.submissions (homework_id, student_id, answers, auto_score, score, status)
  values (
    hw_id,
    sid,
    my_answers,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    'graded'
  )
  on conflict (homework_id, student_id) do update
    set answers = excluded.answers,
        auto_score = excluded.auto_score,
        score = excluded.score,
        submitted_at = now()
  returning * into result;

  return result;
end;
$$;
