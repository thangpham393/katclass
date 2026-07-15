-- =====================================================================
-- Mã kích hoạt tài khoản cho giáo viên / nhân viên.
-- Chạy SAU 0005_makeup_flow.sql.
--
-- Luồng: admin tạo hồ sơ (role teacher/staff) → hệ thống cấp mã →
-- người đó đăng nhập Google/email lần đầu (hồ sơ student tự sinh) →
-- nhập mã tại /activate → RPC claim_invite nối tài khoản vào hồ sơ
-- được cấp, xóa hồ sơ student tạm, thu hồi mã.
-- Nếu email hồ sơ trùng email đăng nhập thì trigger 0004 tự nối,
-- không cần mã.
-- =====================================================================

-- 1. Cột mã kích hoạt (unique, null = chưa cấp hoặc đã dùng)
alter table public.profiles add column invite_code text unique;

-- 2. Staff được tạo hồ sơ giáo viên/nhân viên (0004 mới cho student/parent)
drop policy "staff insert profiles" on public.profiles;
create policy "staff insert profiles" on public.profiles
  for insert with check (
    public.is_staff() and role in ('student', 'parent', 'teacher', 'staff')
  );

-- 3. Staff được sửa hồ sơ không phải admin (cấp/thu hồi mã, sửa thông tin)
create policy "staff update non-admin profiles" on public.profiles
  for update using (public.is_staff() and role <> 'admin')
  with check (public.is_staff() and role <> 'admin');

-- 4. RPC kích hoạt: nối auth.uid() vào hồ sơ mang mã
create or replace function public.claim_invite(code text)
returns public.profiles
security definer
set search_path = public
language plpgsql
as $$
declare
  uid uuid := auth.uid();
  cleaned text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  target public.profiles;
  mine public.profiles;
begin
  if uid is null then
    raise exception 'Bạn cần đăng nhập trước khi nhập mã kích hoạt';
  end if;

  select * into target
  from public.profiles
  where user_id is null
    and upper(regexp_replace(coalesce(invite_code, ''), '[^A-Za-z0-9]', '', 'g')) = cleaned
    and cleaned <> '';
  if not found then
    raise exception 'Mã kích hoạt không hợp lệ hoặc đã được sử dụng';
  end if;

  -- Hồ sơ hiện tại của tài khoản (student tự sinh khi đăng nhập lần đầu)
  select * into mine from public.profiles where user_id = uid;
  if found then
    if mine.role <> 'student'
       or exists (select 1 from public.class_students cs where cs.student_id = mine.id) then
      raise exception 'Tài khoản này đã gắn với hồ sơ khác — liên hệ quản trị viên';
    end if;
    delete from public.profiles where id = mine.id;
  end if;

  update public.profiles p
     set user_id = uid,
         invite_code = null,
         email = case when coalesce(p.email, '') = ''
                      then coalesce((select u.email from auth.users u where u.id = uid), '')
                      else p.email end,
         avatar = coalesce(
           p.avatar,
           (select u.raw_user_meta_data ->> 'avatar_url' from auth.users u where u.id = uid)
         )
   where p.id = target.id
   returning * into target;

  return target;
end;
$$;
