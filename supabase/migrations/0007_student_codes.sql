-- =====================================================================
-- Mã học viên chuẩn HVKAT00xxx + tự cấp mã cho học viên mới.
-- Chạy SAU 0006_invite_codes.sql.
--
-- 1. Đổi tiền tố mã hiện có: HV00123 → HVKAT00123.
-- 2. Sequence tiếp nối số lớn nhất hiện có; trigger tự cấp mã cho
--    hồ sơ học viên mới (kể cả hồ sơ tự sinh khi đăng nhập lần đầu).
-- 3. Học viên cũ chưa có mã cũng được cấp luôn.
--
-- Mã này dùng để đăng nhập (qua API /api/student-auth): hệ thống tạo
-- tài khoản email ảo <mã>@hocvien.katclass.vn với mật khẩu mặc định
-- kat12345, học viên đổi mật khẩu sau khi vào hệ thống.
-- =====================================================================

-- 1. Đổi tiền tố các mã hiện tại (giữ nguyên phần số)
update public.profiles
   set student_code = 'HVKAT' || substring(student_code from 3)
 where student_code like 'HV%'
   and student_code not like 'HVKAT%';

-- 2. Sequence + trigger tự cấp mã cho học viên mới
create sequence if not exists public.student_code_seq;

select setval(
  'public.student_code_seq',
  greatest(
    coalesce(
      (select max(nullif(regexp_replace(student_code, '\D', '', 'g'), '')::bigint)
       from public.profiles
       where student_code like 'HVKAT%'),
      0
    ),
    1
  )
);

create or replace function public.assign_student_code()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.role = 'student' and coalesce(new.student_code, '') = '' then
    new.student_code := 'HVKAT' || lpad(nextval('public.student_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger on_profile_assign_student_code
  before insert on public.profiles
  for each row execute function public.assign_student_code();

-- 3. Cấp mã cho học viên hiện có nhưng chưa có mã
update public.profiles
   set student_code = 'HVKAT' || lpad(nextval('public.student_code_seq')::text, 5, '0')
 where role = 'student'
   and coalesce(student_code, '') = '';
