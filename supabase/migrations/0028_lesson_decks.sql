-- =====================================================================
-- 0028: BỘ SLIDE CÓ TIẾNG nạp sẵn vào thư viện
--
-- Vấn đề: slide giáo trình gốc là file PowerPoint có nút loa trong từng
-- slide. Nhúng Google Slides thì bấm nút loa không kêu; vẽ lại .pptx bằng
-- JavaScript ngay trong trình duyệt thì vỡ bố cục, chữ bị bẻ dọc.
--
-- Cách làm: tách đôi công việc, mỗi bên dùng thứ nó giỏi nhất.
--   • HÌNH  ← bản PDF xuất từ chính file PowerPoint (giống 100% bản gốc).
--   • TIẾNG ← các file mp3/mp4 bóc ra từ ruột file .pptx, kèm TOẠ ĐỘ của
--     icon loa đọc từ XML của slide → trong lớp, nút bấm nằm đúng chỗ cái
--     loa trên hình, bấm từ nào nghe từ đó.
-- Việc bóc tách chạy một lần lúc nạp thư viện, nên vào lớp là chiếu ngay,
-- không phải chờ giải nén và không phụ thuộc file trên máy của ai.
--
-- Chạy SAU 0027_role_permissions.sql.
-- =====================================================================

-- 1. Kho file --------------------------------------------------------
-- Bucket riêng, KHÔNG public: học liệu là tài sản bản quyền của trung tâm,
-- ai đăng nhập mới xin được link tạm (signed URL) để xem.
insert into storage.buckets (id, name, public, file_size_limit)
values ('decks', 'decks', false, 104857600)   -- 100MB/file
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "read decks" on storage.objects;
create policy "read decks" on storage.objects
  for select using (bucket_id = 'decks' and auth.uid() is not null);

drop policy if exists "manage decks" on storage.objects;
create policy "manage decks" on storage.objects
  for all using (bucket_id = 'decks' and public.has_perm('library.manage'))
  with check (bucket_id = 'decks' and public.has_perm('library.manage'));

-- 2. Bộ slide gắn vào bài học ----------------------------------------
create table if not exists public.lesson_decks (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  name         text not null,                 -- tên hiển thị, mặc định là tên file
  pdf_path     text not null,                 -- đường dẫn trong bucket 'decks'
  slide_count  int  not null default 0,
  -- spots[i] = danh sách nút tiếng của slide thứ i+1:
  --   [{ "path": "decks/…/media/audio1.mp3", "name", "kind": "audio|video",
  --      "rect": { "x": 0.37, "y": 0.18, "w": 0.08, "h": 0.08 } | null }]
  -- rect theo TỈ LỆ cạnh slide (0..1) nên phóng to thu nhỏ vẫn đúng chỗ.
  spots        jsonb not null default '[]'::jsonb,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index if not exists lesson_decks_lesson_idx on public.lesson_decks (lesson_id);

comment on table public.lesson_decks is
  'Bộ slide chiếu trong lớp: hình từ PDF, tiếng bóc từ .pptx kèm toạ độ nút loa';

alter table public.lesson_decks enable row level security;

-- Ai đăng nhập cũng đọc được: giáo viên đứng lớp cần chiếu, học viên xem lại
-- bài cũng cần. Chỉ người có quyền soạn thư viện mới thêm/xoá.
drop policy if exists "read lesson decks" on public.lesson_decks;
create policy "read lesson decks" on public.lesson_decks
  for select using (auth.uid() is not null);

drop policy if exists "staff manage lesson decks" on public.lesson_decks;
create policy "staff manage lesson decks" on public.lesson_decks
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));
