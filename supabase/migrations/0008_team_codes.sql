-- =====================================================================
-- Mã đăng nhập cho toàn bộ đội ngũ — cột student_code trở thành
-- "mã thành viên" dùng chung: HVKAT (học viên), GVKAT (giáo viên),
-- NVKAT (nhân viên hành chính), QLKAT (quản trị).
-- Chạy SAU 0007_student_codes.sql.
--
-- Chính sách đăng nhập mới: TẤT CẢ đăng nhập bằng mã do admin cấp
-- (qua API /api/provision-account, mật khẩu mặc định kat12345, đổi sau
-- khi vào hệ thống). Google/email tạm ẩn, chỉ còn cho quản trị.
-- =====================================================================

-- 1. Sequence cho từng nhóm
create sequence if not exists public.teacher_code_seq;
create sequence if not exists public.staff_code_seq;
create sequence if not exists public.admin_code_seq;

select setval('public.teacher_code_seq', greatest(coalesce(
  (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
   from public.profiles where student_code like 'GVKAT%'), 0), 1));
select setval('public.staff_code_seq', greatest(coalesce(
  (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
   from public.profiles where student_code like 'NVKAT%'), 0), 1));
select setval('public.admin_code_seq', greatest(coalesce(
  (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
   from public.profiles where student_code like 'QLKAT%'), 0), 1));

-- 2. Trigger cấp mã tự động cho MỌI vai trò (thay bản chỉ học viên ở 0007)
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
    else
      return new; -- parent: chưa cấp mã ở giai đoạn này
    end if;
    new.student_code := prefix || lpad(nextval(seqname)::text, 5, '0');
  end if;
  return new;
end;
$$;

-- 3. Cấp mã cho đội ngũ hiện có
update public.profiles
   set student_code = 'GVKAT' || lpad(nextval('public.teacher_code_seq')::text, 5, '0')
 where role = 'teacher' and coalesce(student_code, '') = '';

update public.profiles
   set student_code = 'NVKAT' || lpad(nextval('public.staff_code_seq')::text, 5, '0')
 where role = 'staff' and coalesce(student_code, '') = '';

update public.profiles
   set student_code = 'QLKAT' || lpad(nextval('public.admin_code_seq')::text, 5, '0')
 where role = 'admin' and coalesce(student_code, '') = '';

comment on column public.profiles.student_code is
  'Mã thành viên dùng đăng nhập: HVKAT (học viên), GVKAT (giáo viên), NVKAT (nhân viên), QLKAT (quản trị)';
