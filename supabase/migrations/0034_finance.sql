-- =====================================================================
-- 0034: SỔ THU CHI (Doanh thu — Chi phí — Lợi nhuận)
--
-- Học phí đã có sổ riêng: mỗi lần thu là một dòng `payments` kèm biên
-- lai, không chép lại vào đây (chép là có ngày lệch nhau, rồi không
-- biết tin bên nào). Bảng này chỉ giữ hai thứ `payments` không biết:
--
--   1. KHOẢN THU NGOÀI HỌC PHÍ — bán sách, học cụ, phí thi HSK, thu hộ.
--   2. CHI PHÍ — lương, mặt bằng, marketing, điện nước, vật tư...
--
-- Trang Doanh thu cộng hai nguồn (payments + bảng này) để ra lợi nhuận.
-- Một bảng chung cho cả thu lẫn chi vì hai bên giống hệt nhau về cột và
-- báo cáo luôn phải đọc song song; tách đôi chỉ tổ viết mọi thứ hai lần.
-- =====================================================================

create table if not exists public.finance_entries (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references public.branches (id) on delete set null
                 default public.default_branch_id(),
  kind         text not null check (kind in ('revenue', 'expense')),
  -- Khóa nhóm, nhãn tiếng Việt nằm ở src/lib/db-finance.ts:
  -- thu: supplies | books | exam | other
  -- chi: salary | rent | marketing | supplies | utilities | other
  category     text not null,
  amount       numeric(12, 0) not null check (amount > 0),
  occurred_on  date not null default current_date,
  method       text not null default 'cash' check (method in ('cash', 'transfer')),
  title        text not null,                  -- diễn giải ngắn in trong bảng
  note         text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.finance_entries is
  'Sổ thu chi thủ công: khoản thu ngoài học phí + toàn bộ chi phí trung tâm';

create index if not exists finance_entries_kind_date_idx
  on public.finance_entries (kind, occurred_on desc);
create index if not exists finance_entries_branch_date_idx
  on public.finance_entries (branch_id, occurred_on desc);

alter table public.finance_entries enable row level security;

-- Sổ chi có lương giáo viên nên KHÔNG mở cho toàn bộ nhân sự như hoá
-- đơn: chỉ ai giữ quyền học phí (kế toán, quản lý) mới đọc và ghi được.
drop policy if exists "finance manage" on public.finance_entries;
create policy "finance manage" on public.finance_entries
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));
