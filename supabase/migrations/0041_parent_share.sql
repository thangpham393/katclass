-- =====================================================================
-- 0041: CỔNG PHỤ HUYNH KHÔNG CẦN TÀI KHOẢN
--
-- Trước đây muốn phụ huynh xem tiến độ của con thì phải tạo hồ sơ PHKAT
-- + cấp tài khoản + dặn mật khẩu — ba bước, và gần như lần nào cũng kẹt
-- ở bước cuối (phụ huynh quên mật khẩu, không chịu đăng nhập).
--
-- Cách mới: mỗi học viên có MỘT đường dẫn bí mật (token ngẫu nhiên).
-- Gửi đường dẫn/QR cho phụ huynh là xong; mở ra chỉ cần nhập 4 số cuối
-- SĐT đã đăng ký để xác minh. Không tạo tài khoản, không mật khẩu.
--
-- Bí mật nằm ở token, nên:
--   * anon KHÔNG có policy nào trên bảng này — trang công khai đọc dữ
--     liệu qua route /api/parent-portal chạy bằng service role, tự kiểm
--     tra token + 4 số cuối rồi mới trả về đúng phần được xem.
--   * lộ đường dẫn thì admin bấm "Tạo đường dẫn mới" (đổi token) hoặc
--     tắt `enabled` — link cũ chết ngay.
-- =====================================================================

create table if not exists public.parent_share_links (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique,
  enabled boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,          -- lần đổi token gần nhất
  last_viewed_at timestamptz,      -- lần phụ huynh xem gần nhất (API ghi)
  view_count int not null default 0
);

comment on table public.parent_share_links is
  'Đường dẫn xem tiến độ dành cho phụ huynh — bí mật nằm ở token, không cần tài khoản';

alter table public.parent_share_links enable row level security;

-- Chỉ người quản lý học viên mới tạo/tắt/đổi link được. Không có policy
-- cho anon: cổng công khai đi qua service role ở API route.
drop policy if exists "staff manage parent share links" on public.parent_share_links;
create policy "staff manage parent share links" on public.parent_share_links
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));
