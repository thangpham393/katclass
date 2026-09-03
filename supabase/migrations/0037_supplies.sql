-- =====================================================================
-- 0037: KHO HỌC CỤ (sách, vở, bộ thẻ từ, dụng cụ học tập)
--
-- Hai bảng, không có cột "tồn kho":
--
--   • `supply_items`  — DANH MỤC, dùng chung cả hai cơ sở. Một cuốn giáo
--     trình Landmark bán 120k thì Thủ Đức cũng bán 120k; nếu sau này lệch
--     giá thật thì thêm bảng giá riêng, chứ chép danh mục thành hai bản
--     là hôm sau đổi tên sách phải sửa hai chỗ.
--
--   • `supply_moves` — TỪNG LẦN VÀO/RA của một cơ sở. Tồn kho là tổng
--     `qty` chứ không phải một con số ghi sẵn: ghi sẵn thì mỗi lần cấp
--     phát phải sửa hai chỗ trong một giao dịch, lệch một lần là mãi mãi
--     không biết sai từ đâu. Cộng lại thì chậm hơn vài mili-giây nhưng
--     luôn giải thích được vì sao còn đúng bằng đó.
--
-- Quy ước dấu: qty > 0 là hàng vào kho, qty < 0 là hàng ra khỏi kho.
-- `kind` chỉ nói LÝ DO (nhập / cấp phát / kiểm kê), không quyết định dấu.
--
-- Tiền: mỗi lần nhập hoặc cấp phát có thu tiền đều sinh MỘT dòng trong
-- sổ thu chi (0034) và giữ id ở `finance_entry_id` — nhờ vậy trang Doanh
-- thu không cần biết gì về kho, và xoá phiếu thì xoá được luôn dòng tiền
-- đi kèm thay vì để lại một khoản mồ côi.
-- =====================================================================

create table if not exists public.supply_items (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique,                    -- mã tự đặt, để trống cũng được
  name        text not null,
  -- book | notebook | cards | tool | uniform | other (nhãn ở db-supplies.ts)
  category    text not null default 'other',
  unit        text not null default 'cái',    -- cuốn, bộ, hộp...
  cost_price  numeric(12, 0) not null default 0 check (cost_price >= 0),
  sale_price  numeric(12, 0) not null default 0 check (sale_price >= 0),
  low_stock   integer not null default 0 check (low_stock >= 0), -- ngưỡng cảnh báo
  note        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.supply_items is
  'Danh mục học cụ dùng chung mọi chi nhánh; tồn kho nằm ở supply_moves';
comment on column public.supply_items.low_stock is
  'Tồn kho của một chi nhánh xuống tới mức này thì trang Kho báo "sắp hết"';

create index if not exists supply_items_name_idx on public.supply_items (name);

create table if not exists public.supply_moves (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.supply_items (id) on delete cascade,
  branch_id         uuid references public.branches (id) on delete set null
                      default public.default_branch_id(),
  -- in: nhập kho | issue: cấp phát cho học viên | adjust: kiểm kê, hỏng, mất
  kind              text not null check (kind in ('in', 'issue', 'adjust')),
  qty               integer not null check (qty <> 0),
  unit_price        numeric(12, 0) not null default 0 check (unit_price >= 0),
  student_id        uuid references public.profiles (id) on delete set null,
  invoice_id        uuid references public.invoices (id) on delete set null,
  finance_entry_id  uuid references public.finance_entries (id) on delete set null,
  occurred_on       date not null default current_date,
  note              text,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table public.supply_moves is
  'Nhật ký vào/ra kho học cụ: qty > 0 là nhập, qty < 0 là xuất';

create index if not exists supply_moves_item_idx
  on public.supply_moves (item_id, occurred_on desc);
create index if not exists supply_moves_branch_idx
  on public.supply_moves (branch_id, occurred_on desc);
create index if not exists supply_moves_student_idx
  on public.supply_moves (student_id, occurred_on desc);

-- Tồn kho từng mặt hàng ở từng cơ sở. `security_invoker` để RLS của
-- supply_moves vẫn áp dụng cho người đang hỏi, không bị view mở toang.
create or replace view public.supply_stock
with (security_invoker = on) as
select
  m.item_id,
  m.branch_id,
  coalesce(sum(m.qty), 0)::int                            as qty,
  coalesce(sum(m.qty) filter (where m.qty > 0), 0)::int    as qty_in,
  coalesce(-sum(m.qty) filter (where m.qty < 0), 0)::int   as qty_out,
  max(m.occurred_on)                                      as last_move_on
from public.supply_moves m
group by m.item_id, m.branch_id;

comment on view public.supply_stock is 'Tồn kho học cụ = tổng nhật ký vào/ra theo chi nhánh';

alter table public.supply_items enable row level security;
alter table public.supply_moves enable row level security;

-- Ai cũng trong nhà mới xem được kho (giáo viên cần biết còn sách để phát),
-- nhưng sửa danh mục và ghi phiếu thì phải giữ quyền học phí như sổ thu chi
-- — mỗi dòng ở đây đều kéo theo tiền.
drop policy if exists "staff read supply items" on public.supply_items;
create policy "staff read supply items" on public.supply_items
  for select using (public.is_staff());

drop policy if exists "manage supply items" on public.supply_items;
create policy "manage supply items" on public.supply_items
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));

drop policy if exists "staff read supply moves" on public.supply_moves;
create policy "staff read supply moves" on public.supply_moves
  for select using (public.is_staff());

drop policy if exists "manage supply moves" on public.supply_moves;
create policy "manage supply moves" on public.supply_moves
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));
