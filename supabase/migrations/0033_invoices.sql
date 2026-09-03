-- =====================================================================
-- 0033: HOÁ ĐƠN (Invoice)
--
-- Khác `payments` (biên lai của một lần thu tiền cho gói buổi đã bán),
-- hoá đơn là GIẤY BÁO GỬI TRƯỚC: khách hàng tiềm năng chưa phải học
-- viên, chưa có gói buổi, nhưng vẫn cần một tờ ghi rõ học phí, hạn
-- đóng và thông tin chuyển khoản để quyết định. Vì vậy hoá đơn đứng
-- riêng, gắn được vào `leads` hoặc `profiles` (hoặc không gắn ai).
--
-- Dòng nội dung để jsonb: mỗi trung tâm bán một kiểu (khoá học, học cụ,
-- phí ghi danh...), tách bảng con chỉ để lưu 1-3 dòng là thừa.
-- =====================================================================

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_no     text not null unique,
  branch_id      uuid references public.branches (id) on delete set null,
  lead_id        uuid references public.leads (id) on delete set null,
  student_id     uuid references public.profiles (id) on delete set null,
  customer_name  text not null,                  -- người đứng tên (phụ huynh)
  student_name   text,
  phone          text,
  issued_on      date not null default current_date,
  due_on         date,
  method         text not null default 'transfer' check (method in ('cash', 'transfer')),
  -- [{ "name": "HSK 1 cơ bản", "qty": 1, "price": 3600000, "course_id": "..." }]
  items          jsonb not null default '[]'::jsonb,
  discount       numeric(12, 0) not null default 0,
  paid_amount    numeric(12, 0) not null default 0,
  note           text,
  bank_info      text,                           -- thông tin chuyển khoản in trên hoá đơn
  terms          text,                           -- nội quy khoá học, in cuối hoá đơn
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.invoices is
  'Hoá đơn gửi khách: dùng cho khách hàng tiềm năng (leads) lẫn học viên';
comment on column public.invoices.items is
  'Dòng nội dung: [{ name, qty, price, course_id? }] — thành tiền = qty * price';

create index if not exists invoices_lead_idx on public.invoices (lead_id, created_at desc);
create index if not exists invoices_student_idx on public.invoices (student_id, created_at desc);
create index if not exists invoices_issued_idx on public.invoices (issued_on desc);

-- Số hoá đơn kế tiếp: INV0001, INV0002... Lấy số lớn nhất đang có + 1 nên
-- xoá hoá đơn cuối thì số đó được dùng lại — đúng ý văn phòng, và trùng
-- thì unique index chặn, không có chuyện hai tờ cùng số.
create or replace function public.next_invoice_no()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'INV' || lpad(
    (coalesce(max((regexp_replace(invoice_no, '\D', '', 'g'))::bigint), 0) + 1)::text, 4, '0')
  from public.invoices
  where invoice_no ~ '\d';
$$;

alter table public.invoices enable row level security;

-- Hoá đơn nằm giữa hai việc: bán hàng cho khách tiềm năng (students.manage)
-- và thu học phí (tuition.manage) — ai giữ một trong hai đều lập được.
drop policy if exists "staff manage invoices" on public.invoices;
create policy "staff manage invoices" on public.invoices
  for all using (public.has_perm('tuition.manage') or public.has_perm('students.manage'))
  with check (public.has_perm('tuition.manage') or public.has_perm('students.manage'));

drop policy if exists "staff read invoices" on public.invoices;
create policy "staff read invoices" on public.invoices
  for select using (public.is_staff());

-- Mẫu dùng lại khi lập hoá đơn: nội quy khoá học in ở cuối tờ.
insert into public.message_templates (key, title, body) values
  ('invoice_terms', 'Nội quy khoá học', '')
on conflict (key) do nothing;
