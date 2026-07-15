-- =====================================================================
-- KHÓA TỰ ĐĂNG KÝ — đăng nhập duy nhất bằng mã do admin cấp.
-- Chạy SAU 0008_team_codes.sql.
--
-- Trước đây: tài khoản lạ (Google/email) đăng nhập lần đầu sẽ tự sinh
-- hồ sơ học viên mới → ai có Gmail cũng "thành học viên". Từ nay:
--   - Trigger đăng ký chỉ NỐI vào hồ sơ có sẵn trùng email (nếu có),
--     tuyệt đối không tạo hồ sơ mới.
--   - Người dùng không tự insert hồ sơ được (bỏ policy insert own).
--   - Hồ sơ chỉ do staff/admin tạo (trang Học viên / Đội ngũ).
-- Tài khoản lạ đăng nhập sẽ không có hồ sơ → app tự đăng xuất và báo
-- "chưa được đăng ký".
-- =====================================================================

-- 1. Trigger đăng ký: chỉ nối, không tạo mới
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
  return new;
end;
$$;

-- 2. Bỏ quyền tự tạo hồ sơ của người dùng thường
drop policy if exists "insert own profile" on public.profiles;
