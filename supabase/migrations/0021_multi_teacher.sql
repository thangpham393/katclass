-- =====================================================================
-- 0021: Nhiều giáo viên cho một lớp + gán GV theo từng buổi trong tuần
--   • class_teachers: danh sách GV của lớp (1 GV chính + các GV khác)
--   • class_schedules.teacher_id: GV đứng lớp cho buổi đó trong tuần
--     (VD: CN cô A, T3 cô B) — dùng khi sinh buổi học
-- =====================================================================

-- 1. Danh sách giáo viên của lớp -------------------------------------
create table if not exists public.class_teachers (
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'assistant' check (role in ('main', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create index if not exists class_teachers_teacher_idx on public.class_teachers (teacher_id);

-- GV phụ trách hiện tại → 'main'
insert into public.class_teachers (class_id, teacher_id, role)
select c.id, c.teacher_id, 'main' from public.classes c
where c.teacher_id is not null
on conflict (class_id, teacher_id) do update set role = 'main';

-- Giữ classes.teacher_id (GV chính) đồng bộ với class_teachers
create or replace function public.sync_main_class_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_id is not null then
    insert into public.class_teachers (class_id, teacher_id, role)
    values (new.id, new.teacher_id, 'main')
    on conflict (class_id, teacher_id) do update set role = 'main';
    -- GV chính cũ (nếu đổi) lùi về 'assistant'
    update public.class_teachers
       set role = 'assistant'
     where class_id = new.id and teacher_id <> new.teacher_id and role = 'main';
  else
    update public.class_teachers set role = 'assistant'
     where class_id = new.id and role = 'main';
  end if;
  return new;
end;
$$;

drop trigger if exists on_class_teacher_changed on public.classes;
create trigger on_class_teacher_changed
  after insert or update of teacher_id on public.classes
  for each row execute function public.sync_main_class_teacher();

-- 2. GV cho từng buổi trong lịch tuần ---------------------------------
alter table public.class_schedules
  add column if not exists teacher_id uuid references public.profiles (id);

-- 3. Quyền: GV trong class_teachers cũng xem/dạy được lớp ------------
create or replace function public.can_view_class(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = cid and c.teacher_id = public.my_profile_id())
    or exists (select 1 from public.class_teachers ct
               where ct.class_id = cid and ct.teacher_id = public.my_profile_id())
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
    left join public.classes c on c.id = s.class_id
    where s.id = sess
      and (
        s.teacher_id = public.my_profile_id()
        or c.teacher_id = public.my_profile_id()
        or exists (select 1 from public.class_teachers ct
                   where ct.class_id = s.class_id
                     and ct.teacher_id = public.my_profile_id())
      )
  );
$$;

alter table public.class_teachers enable row level security;

drop policy if exists "view class teachers" on public.class_teachers;
create policy "view class teachers" on public.class_teachers
  for select using (teacher_id = public.my_profile_id() or public.can_view_class(class_id));

drop policy if exists "staff manage class teachers" on public.class_teachers;
create policy "staff manage class teachers" on public.class_teachers
  for all using (public.is_staff()) with check (public.is_staff());
