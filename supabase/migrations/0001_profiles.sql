-- Hồ sơ người dùng, gắn 1-1 với auth.users.
-- Chạy file này trong Supabase Dashboard > SQL Editor (hoặc `supabase db push`).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Ai cũng chỉ đọc/tạo được hồ sơ của chính mình.
-- Không có policy UPDATE: người dùng không tự đổi được role của mình;
-- việc gán role (teacher/admin) làm qua Dashboard hoặc service role.
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'student');

-- Tự tạo hồ sơ khi có tài khoản mới (email/password hoặc Google).
create function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, name, email, avatar)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
