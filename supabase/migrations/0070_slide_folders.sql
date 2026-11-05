-- =====================================================================
-- 0070: KHO PPT BÀI GIẢNG — thư mục theo giáo trình cho slide HTML
--
-- Slide HTML (0068) xếp vào thư mục, mỗi thư mục thường ứng với một giáo
-- trình (textbook_id) để gắn slide vào đúng bài của giáo trình đó.
-- Slide tải lên từ lớp học / trang chuẩn bị (có lesson_id, chưa có thư mục)
-- tự rơi vào thư mục của giáo trình chứa bài đó, nếu đã có thư mục.
--
-- Chạy SAU 0069_session_html_slide.sql.
-- =====================================================================

-- 1. Thư mục ---------------------------------------------------------
create table if not exists public.slide_folders (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  textbook_id  uuid references public.textbooks (id) on delete set null,
  sort         int  not null default 0,
  created_by   uuid references public.profiles (id) default public.my_profile_id(),
  created_at   timestamptz not null default now()
);

create index if not exists slide_folders_textbook_idx on public.slide_folders (textbook_id);

comment on table public.slide_folders is
  'Thư mục của Kho PPT bài giảng (slide HTML), thường đặt theo tên giáo trình';

alter table public.slide_folders enable row level security;

drop policy if exists "read slide folders" on public.slide_folders;
create policy "read slide folders" on public.slide_folders
  for select using (public.my_role() in ('teacher', 'staff', 'accountant', 'admin'));

drop policy if exists "manage slide folders" on public.slide_folders;
create policy "manage slide folders" on public.slide_folders
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

-- 2. Slide thuộc thư mục ---------------------------------------------
-- Xoá thư mục thì slide KHÔNG mất, chỉ về mục "Chưa xếp thư mục".
alter table public.html_slides
  add column if not exists folder_id uuid references public.slide_folders (id) on delete set null;

create index if not exists html_slides_folder_idx on public.html_slides (folder_id);

-- 3. Tự xếp thư mục theo giáo trình của bài ---------------------------
create or replace function public.html_slide_auto_folder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folder_id is null and new.lesson_id is not null then
    select f.id into new.folder_id
    from public.lessons l
    join public.slide_folders f on f.textbook_id = l.textbook_id
    where l.id = new.lesson_id
    order by f.sort, f.created_at
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists html_slide_auto_folder on public.html_slides;
create trigger html_slide_auto_folder
  before insert or update of lesson_id on public.html_slides
  for each row execute function public.html_slide_auto_folder();

-- Xếp luôn các slide đã có
update public.html_slides s
set folder_id = f.id
from public.lessons l
join public.slide_folders f on f.textbook_id = l.textbook_id
where s.folder_id is null and s.lesson_id = l.id;

-- Tạo thư mục cho một giáo trình → gom luôn slide chưa xếp của các bài thuộc
-- giáo trình đó vào
create or replace function public.slide_folder_collect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.textbook_id is not null then
    update public.html_slides s
    set folder_id = new.id
    from public.lessons l
    where s.folder_id is null and s.lesson_id = l.id and l.textbook_id = new.textbook_id;
  end if;
  return new;
end;
$$;

drop trigger if exists slide_folder_collect on public.slide_folders;
create trigger slide_folder_collect
  after insert or update of textbook_id on public.slide_folders
  for each row execute function public.slide_folder_collect();
