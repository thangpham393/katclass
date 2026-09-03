-- =====================================================================
-- 0032: KHÁCH HÀNG TIỀM NĂNG (trang /admin/leads)
--
-- Phụ huynh hỏi thăm khóa học nhưng CHƯA ghi danh thì không thể nằm ở
-- bảng `profiles`: chưa có mã học viên, chưa thuộc lớp, chưa có học phí —
-- nhét vào đó là mọi báo cáo sĩ số, chuyên cần, doanh thu đều lệch. Nên
-- hồ sơ tiềm năng có bảng riêng, chốt xong mới sinh hồ sơ học viên thật
-- và ghi lại `student_id` để không nhập liệu hai lần.
--
-- Kèm theo: nhật ký trao đổi (lead_notes), file/hình đính kèm
-- (lead_files + bucket 'leads') và mẫu tin nhắn sửa được
-- (message_templates) để văn phòng gửi Invoice / follow-up cho phụ huynh.
-- =====================================================================

-- 1. Hồ sơ khách hàng tiềm năng ---------------------------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  parent_name  text not null,                  -- người liên hệ (phụ huynh)
  phone        text,
  email        text,
  address      text,
  student_name text,                           -- tên con, có thể chưa biết
  dob          date,
  test_level   text,                           -- cấp độ test đầu vào (LEVELS)
  branch_id    uuid references public.branches (id) on delete set null,
  status       text not null default 'new'
    check (status in ('new', 'followup', 'invoiced', 'registered', 'lost')),
  note         text,
  -- Hồ sơ học viên sinh ra khi chốt; giữ lại để mở nhanh từ thẻ khách hàng
  student_id   uuid references public.profiles (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.leads is
  'Khách hàng tiềm năng: phụ huynh đã hỏi thăm nhưng chưa ghi danh';
comment on column public.leads.status is
  'new = mới, followup = đang chăm, invoiced = đã gửi invoice, registered = đã đăng ký, lost = không theo';

create index if not exists leads_status_idx on public.leads (status, created_at desc);
create index if not exists leads_branch_idx on public.leads (branch_id);

-- 2. Nhật ký trao đổi --------------------------------------------------
create table if not exists public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  body       text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);

-- 3. File & hình đính kèm ---------------------------------------------
create table if not exists public.lead_files (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  name       text not null,
  path       text not null,                    -- đường dẫn trong bucket 'leads'
  kind       text not null default 'file' check (kind in ('file', 'image')),
  size       bigint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_files_lead_idx on public.lead_files (lead_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit)
values ('leads', 'leads', false, 26214400)     -- 25MB/file
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "read lead files" on storage.objects;
create policy "read lead files" on storage.objects
  for select using (bucket_id = 'leads' and public.is_staff());

drop policy if exists "manage lead files" on storage.objects;
create policy "manage lead files" on storage.objects
  for all using (bucket_id = 'leads' and public.has_perm('students.manage'))
  with check (bucket_id = 'leads' and public.has_perm('students.manage'));

-- 4. Mẫu tin nhắn gửi phụ huynh ---------------------------------------
-- Văn phòng sửa lời văn thường xuyên (đổi ưu đãi, đổi cách xưng hô) nên
-- mẫu nằm ở database, không hard-code trong giao diện.
create table if not exists public.message_templates (
  key        text primary key,
  title      text not null,
  body       text not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on column public.message_templates.body is
  'Chỗ thay thế: {parent} = tên phụ huynh, {student} = tên học viên, {center} = tên trung tâm';

insert into public.message_templates (key, title, body) values
  ('lead_invoice', 'Gửi Invoice',
'Kính chào anh/chị {parent},

KAT CHINESE xin cảm ơn anh/chị đã quan tâm đến khóa học cho bé {student}. Trung tâm xin gửi thông tin chi tiết khoá học con sẽ đăng ký và Invoice ạ.

Anh/chị thanh toán xong vui lòng phản hồi cho trung tâm sắp xếp lịch học sớm nhất cho con tại KAT CHINESE anh chị nhé.

Trân trọng,
KAT CHINESE'),
  ('lead_followup', 'Hỏi thăm (follow-up)',
'Kính chào anh/chị {parent},

KAT CHINESE xin phép hỏi thăm anh/chị về việc học tiếng Trung của bé {student} ạ. Trung tâm vẫn còn giữ chỗ lớp phù hợp với trình độ của con.

Anh/chị phản hồi giúp trung tâm để sắp xếp buổi học thử cho bé trong tuần này nhé ạ.

Trân trọng,
KAT CHINESE')
on conflict (key) do nothing;

-- 5. Phân quyền --------------------------------------------------------
-- Khách hàng tiềm năng đi kèm quyền hồ sơ học viên (students.manage) —
-- đúng nhóm người sẽ biến khách thành học viên.
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_files enable row level security;
alter table public.message_templates enable row level security;

drop policy if exists "staff manage leads" on public.leads;
create policy "staff manage leads" on public.leads
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "staff read leads" on public.leads;
create policy "staff read leads" on public.leads
  for select using (public.is_staff());

drop policy if exists "staff manage lead notes" on public.lead_notes;
create policy "staff manage lead notes" on public.lead_notes
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "staff read lead notes" on public.lead_notes;
create policy "staff read lead notes" on public.lead_notes
  for select using (public.is_staff());

drop policy if exists "staff manage lead files" on public.lead_files;
create policy "staff manage lead files" on public.lead_files
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "staff read lead files" on public.lead_files;
create policy "staff read lead files" on public.lead_files
  for select using (public.is_staff());

drop policy if exists "staff read templates" on public.message_templates;
create policy "staff read templates" on public.message_templates
  for select using (public.is_staff());

drop policy if exists "staff manage templates" on public.message_templates;
create policy "staff manage templates" on public.message_templates
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));
