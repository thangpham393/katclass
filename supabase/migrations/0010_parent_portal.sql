-- =====================================================================
-- Cổng phụ huynh: mã đăng nhập PHKAT + quyền đọc cần thiết.
-- Chạy SAU 0009_lock_signup.sql.
--
-- 1. Phụ huynh đăng nhập bằng mã như mọi vai trò khác: PHKAT00001...
--    Trigger cấp mã mở rộng cho role 'parent'; admin cấp tài khoản qua
--    /api/provision-account (mật khẩu mặc định kat12345, đổi sau).
-- 2. Người đăng nhập nào cũng đọc được hồ sơ đội ngũ (teacher/staff/
--    admin) — để học viên/phụ huynh thấy TÊN giáo viên trong lịch học,
--    nhận xét... (trước đó embed profiles trả về null vì RLS chặn).
-- =====================================================================

-- 1. Sequence + trigger cấp mã cho phụ huynh
create sequence if not exists public.parent_code_seq;

select setval('public.parent_code_seq', greatest(coalesce(
  (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
   from public.profiles where student_code like 'PHKAT%'), 0), 1));

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
    elsif new.role = 'admin' then
      prefix := 'QLKAT'; seqname := 'public.admin_code_seq';
    elsif new.role = 'parent' then
      prefix := 'PHKAT'; seqname := 'public.parent_code_seq';
    else
      return new;
    end if;
    new.student_code := prefix || lpad(nextval(seqname)::text, 5, '0');
  end if;
  return new;
end;
$$;

-- 2. Cấp mã cho phụ huynh hiện có (nếu đã tạo trước migration này)
update public.profiles
   set student_code = 'PHKAT' || lpad(nextval('public.parent_code_seq')::text, 5, '0')
 where role = 'parent' and coalesce(student_code, '') = '';

comment on column public.profiles.student_code is
  'Mã thành viên dùng đăng nhập: HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân viên), QLKAT (quản trị), PHKAT (phụ huynh)';

-- 3. Ai đăng nhập cũng đọc được hồ sơ đội ngũ (hiện tên GV cho HV/PH)
create policy "read team profiles" on public.profiles
  for select using (auth.uid() is not null and role in ('teacher', 'staff', 'admin'));
