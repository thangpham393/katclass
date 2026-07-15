-- =====================================================================
-- 0011: THƯ VIỆN GIÁO TRÌNH
-- Kho giáo trình do trung tâm nạp sẵn (HSK 1-6, ...): mỗi giáo trình
-- gồm nhiều bài học kèm từ vựng / ngữ pháp / câu hỏi luyện tập.
-- Bài học thư viện dùng chung bảng lessons (thêm cột textbook_id) nên
-- giáo viên gán vào buổi học / lọc câu hỏi theo bài như bình thường.
-- Chạy SAU 0010_parent_portal.sql.
-- =====================================================================

create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,      -- slug định danh khi import, vd 'hsk1-standard'
  name text not null,             -- vd 'HSK 1 — Giáo trình chuẩn'
  name_zh text,                   -- vd '标准教程 HSK 1'
  level text,                     -- khớp LEVELS: HSK1..HSK6, KIDS, GIAO_TIEP, OTHER
  description text,
  cover_url text,
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Bài học có thể thuộc một giáo trình thư viện. Xóa giáo trình sẽ xóa
-- các bài học của nó (lesson_vocab / session_lessons xóa theo cascade
-- sẵn có; questions.lesson_id tự về null theo 0003).
alter table public.lessons
  add column textbook_id uuid references public.textbooks (id) on delete cascade;

create index lessons_textbook_idx on public.lessons (textbook_id, unit, sort);

-- RLS: ai đăng nhập cũng xem được thư viện; chỉ staff/admin quản lý
-- (giáo viên dùng chứ không sửa kho giáo trình chung).
alter table public.textbooks enable row level security;

create policy "read textbooks" on public.textbooks
  for select using (auth.uid() is not null);

create policy "staff manage textbooks" on public.textbooks
  for all using (public.my_role() in ('staff', 'admin'))
  with check (public.my_role() in ('staff', 'admin'));
