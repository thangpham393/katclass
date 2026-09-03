-- =====================================================================
-- 0031: NHẬT KÝ LIÊN HỆ HỌC VIÊN (trang "Vắng liên tiếp")
--
-- Danh sách vắng liên tiếp tự nó chỉ nói "em này nghỉ 3 buổi rồi";
-- việc thật là GỌI PHỤ HUYNH — và điều kiện để danh sách đó dùng được
-- hàng ngày là biết ai đã gọi, gọi lúc nào, kết quả ra sao. Không có
-- chỗ ghi thì hôm sau cả văn phòng gọi trùng một nhà.
--
-- Bảng ghi mọi lần liên hệ (không riêng ca vắng) nên trang Khách hàng
-- tiềm năng / Học viên đã nghỉ sau này dùng lại được cùng một nhật ký.
-- =====================================================================

create table if not exists public.student_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'call'
    check (channel in ('call', 'zalo', 'sms', 'meet', 'other')),
  outcome text not null default 'reached'
    check (outcome in ('reached', 'no_answer', 'handled')),
  note text,
  contacted_by uuid references public.profiles (id) on delete set null,
  contacted_at timestamptz not null default now()
);

comment on table public.student_contacts is
  'Nhật ký liên hệ phụ huynh/học viên: ai gọi, kênh nào, kết quả, ghi chú';
comment on column public.student_contacts.outcome is
  'reached = gọi được, no_answer = không nghe máy, handled = đã xử lý xong việc';

create index if not exists student_contacts_student_idx
  on public.student_contacts (student_id, contacted_at desc);

alter table public.student_contacts enable row level security;

-- Việc chăm sóc học viên đi kèm quyền hồ sơ học viên; kế toán/hành chính
-- có quyền đó là ghi được, giáo viên chỉ đọc phần học viên mình dạy.
drop policy if exists "staff manage student contacts" on public.student_contacts;
create policy "staff manage student contacts" on public.student_contacts
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "staff read student contacts" on public.student_contacts;
create policy "staff read student contacts" on public.student_contacts
  for select using (public.is_staff() or public.has_perm('students.manage'));
