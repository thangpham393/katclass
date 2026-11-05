-- =====================================================================
-- 0068: SLIDE HTML tải lên trong lớp, lưu kho dùng chung
--
-- Giáo viên soạn slide dạng một file .html (có hiệu ứng, JS, audio nhúng…).
-- Trong lớp chỉ cần chọn file là chiếu được; file đồng thời được lưu vào kho
-- để giáo viên khác mở lại, không phải tải lên mỗi lần.
--
-- Chiếu: app tải nội dung file về rồi dựng trong <iframe srcdoc sandbox>
-- KHÔNG có allow-same-origin → script trong slide chạy được nhưng không đọc
-- được phiên đăng nhập / dữ liệu của app. (Storage Supabase cũng không phục
-- vụ text/html trực tiếp nên không thể nhúng bằng signed URL.)
--
-- Chống trùng: mỗi file băm SHA-256, cùng nội dung chỉ lưu một bản.
--
-- Chạy SAU 0067_no_homework_reason_optional.sql.
-- =====================================================================

-- 1. Kho file --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('html-slides', 'html-slides', false, 52428800, array['text/html'])   -- 50MB/file
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read html slides" on storage.objects;
create policy "read html slides" on storage.objects
  for select using (
    bucket_id = 'html-slides'
    and public.my_role() in ('teacher', 'staff', 'accountant', 'admin')
  );

drop policy if exists "upload html slides" on storage.objects;
create policy "upload html slides" on storage.objects
  for insert with check (
    bucket_id = 'html-slides'
    and public.my_role() in ('teacher', 'staff', 'accountant', 'admin')
  );

drop policy if exists "delete html slides" on storage.objects;
create policy "delete html slides" on storage.objects
  for delete using (
    bucket_id = 'html-slides'
    and (owner = auth.uid() or public.has_perm('library.manage'))
  );

-- 2. Danh mục slide --------------------------------------------------
create table if not exists public.html_slides (
  id           uuid primary key default gen_random_uuid(),
  -- Bài học của buổi lúc tải lên → buổi sau dạy cùng bài tự hiện lên đầu.
  -- Null = slide chung, chỉ tìm thấy trong kho.
  lesson_id    uuid references public.lessons (id) on delete set null,
  name         text not null,
  path         text not null,                 -- đường dẫn trong bucket 'html-slides'
  size_bytes   int  not null default 0,
  sha256       text not null unique,
  created_by   uuid references public.profiles (id) default public.my_profile_id(),
  created_at   timestamptz not null default now()
);

create index if not exists html_slides_lesson_idx on public.html_slides (lesson_id);
create index if not exists html_slides_created_idx on public.html_slides (created_at desc);

comment on table public.html_slides is
  'Slide HTML một file giáo viên tải lên trong lớp, dùng chung cho mọi giáo viên';

alter table public.html_slides enable row level security;

drop policy if exists "read html slides" on public.html_slides;
create policy "read html slides" on public.html_slides
  for select using (public.my_role() in ('teacher', 'staff', 'accountant', 'admin'));

drop policy if exists "add html slides" on public.html_slides;
create policy "add html slides" on public.html_slides
  for insert with check (
    public.my_role() in ('teacher', 'staff', 'accountant', 'admin')
    and created_by = public.my_profile_id()
  );

-- Đổi tên / gắn bài: người tải lên hoặc người soạn thư viện
drop policy if exists "edit html slides" on public.html_slides;
create policy "edit html slides" on public.html_slides
  for update using (created_by = public.my_profile_id() or public.has_perm('library.manage'))
  with check (created_by = public.my_profile_id() or public.has_perm('library.manage'));

drop policy if exists "delete html slides" on public.html_slides;
create policy "delete html slides" on public.html_slides
  for delete using (created_by = public.my_profile_id() or public.has_perm('library.manage'));
