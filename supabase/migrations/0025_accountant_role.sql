-- =====================================================================
-- 0025: Tách quyền KẾ TOÁN khỏi QUẢN LÝ HÀNH CHÍNH
--
--   • admin      — toàn quyền (kể cả lương, bảng công, phân quyền)
--   • accountant — kế toán: xem/sửa mức lương GV, bảng công, tiền công
--   • staff      — quản lý hành chính: vận hành lớp/học viên/học phí,
--                  KHÔNG xem được mức lương GV và bảng công tiền
--
-- Chỉ admin mới cấp được vai trò kế toán (chống hành chính tự nâng quyền
-- để xem lương: policy update/insert hồ sơ chặn role 'accountant').
-- =====================================================================

-- 1. Vai trò mới ------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'parent', 'teacher', 'staff', 'accountant', 'admin'));

-- 2. Hàm quyền --------------------------------------------------------

-- Khu quản trị dùng chung: hành chính + kế toán + admin
create or replace function public.is_staff()
returns boolean
language sql stable
as $$
  select public.my_role() in ('staff', 'accountant', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select public.my_role() = 'admin';
$$;

-- Ai được xem tiền: kế toán + admin (hành chính thì không)
create or replace function public.can_view_pay()
returns boolean
language sql stable
as $$
  select public.my_role() in ('accountant', 'admin');
$$;

-- 3. Mức lương GV: chuyển từ is_staff() sang can_view_pay() -----------
drop policy if exists "staff manage pay profiles" on public.teacher_pay_profiles;
drop policy if exists "staff manage pay tiers" on public.teacher_pay_tiers;

create policy "accounting manage pay profiles" on public.teacher_pay_profiles
  for all using (public.can_view_pay()) with check (public.can_view_pay());
create policy "accounting manage pay tiers" on public.teacher_pay_tiers
  for all using (public.can_view_pay()) with check (public.can_view_pay());

-- 4. Hồ sơ: hành chính không được tạo/sửa hồ sơ kế toán --------------
drop policy if exists "staff insert profiles" on public.profiles;
create policy "staff insert profiles" on public.profiles
  for insert with check (
    public.is_admin()
    or (public.is_staff() and role in ('student', 'parent', 'teacher', 'staff'))
  );

drop policy if exists "staff update non-admin profiles" on public.profiles;
create policy "staff update non-admin profiles" on public.profiles
  for update using (
    public.is_admin() or (public.is_staff() and role not in ('admin', 'accountant'))
  )
  with check (
    public.is_admin() or (public.is_staff() and role not in ('admin', 'accountant'))
  );

-- 5. Mã thành viên cho kế toán: KTKAT00001 ---------------------------
create sequence if not exists public.accountant_code_seq;
select setval('public.accountant_code_seq', greatest(coalesce(
  (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
   from public.profiles where student_code like 'KTKAT%'), 0), 1));

create or replace function public.assign_student_code()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  prefix text;
  seqname text;
begin
  if coalesce(new.student_code, '') = '' then
    if new.role = 'student' then
      prefix := 'HVKAT'; seqname := 'public.student_code_seq';
    elsif new.role = 'teacher' then
      prefix := 'GVKAT'; seqname := 'public.teacher_code_seq';
    elsif new.role = 'staff' then
      prefix := 'NVKAT'; seqname := 'public.staff_code_seq';
    elsif new.role = 'accountant' then
      prefix := 'KTKAT'; seqname := 'public.accountant_code_seq';
    elsif new.role = 'admin' then
      prefix := 'QLKAT'; seqname := 'public.admin_code_seq';
    else
      return new; -- parent: chưa cấp mã ở giai đoạn này
    end if;
    new.student_code := prefix || lpad(nextval(seqname)::text, 5, '0');
  end if;
  return new;
end;
$$;

update public.profiles
   set student_code = 'KTKAT' || lpad(nextval('public.accountant_code_seq')::text, 5, '0')
 where role = 'accountant' and coalesce(student_code, '') = '';

comment on column public.profiles.student_code is
  'Mã thành viên dùng đăng nhập: HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân viên hành chính), KTKAT (kế toán), QLKAT (quản trị)';
