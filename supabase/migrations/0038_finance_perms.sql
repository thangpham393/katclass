-- =====================================================================
-- 0038: TÁCH QUYỀN TIỀN BẠC KHỎI QUẢN LÝ HÀNH CHÍNH
--
-- Trước: một khóa `tuition.manage` gánh cả bốn thứ — gói buổi, hoá đơn,
--        sổ thu chi và kho học cụ. Hành chính cần kho học cụ nên buộc
--        phải giữ khóa đó, kéo theo nhìn thấy luôn Doanh thu và Hoá đơn.
-- Sau:   ba khóa tách bạch, ai cần gì tích nấy —
--        • tuition.manage  → gói buổi, thu tiền, hoá đơn (trang Hoá đơn)
--        • finance.view    → sổ thu chi (trang Doanh thu; có cả lương)
--        • supplies.manage → kho học cụ (việc hành chính thuần túy)
--
-- Hành chính mặc định chỉ còn supplies.manage; kế toán và quản lý giữ
-- nguyên cả ba. Đổi lại ở màn Cài đặt > Phân quyền bất cứ lúc nào.
-- =====================================================================

-- 1. Khóa mới cho vai trò kế toán ------------------------------------
insert into public.role_permissions (role, permission)
select r.role, p.permission
  from (values ('accountant')) as r(role),
       (values ('finance.view'), ('supplies.manage')) as p(permission)
on conflict do nothing;

-- 2. Hành chính: giữ kho học cụ, bỏ tiền -------------------------------
insert into public.role_permissions (role, permission)
values ('staff', 'supplies.manage')
on conflict do nothing;

delete from public.role_permissions
 where role = 'staff'
   and permission in ('tuition.manage', 'finance.view');

-- 3. Sổ thu chi đọc khóa riêng ----------------------------------------
drop policy if exists "finance manage" on public.finance_entries;
create policy "finance manage" on public.finance_entries
  for all using (public.has_perm('finance.view'))
  with check (public.has_perm('finance.view'));

-- 4. Kho học cụ đọc khóa riêng ----------------------------------------
drop policy if exists "manage supply items" on public.supply_items;
create policy "manage supply items" on public.supply_items
  for all using (public.has_perm('supplies.manage'))
  with check (public.has_perm('supplies.manage'));

drop policy if exists "manage supply moves" on public.supply_moves;
create policy "manage supply moves" on public.supply_moves
  for all using (public.has_perm('supplies.manage'))
  with check (public.has_perm('supplies.manage'));

-- 5. Hoá đơn: chỉ ai giữ quyền học phí ---------------------------------
-- Bỏ hai lối cũ (`students.manage` để lập hoá đơn cho khách tiềm năng và
-- `is_staff()` để đọc): cả hai đều mở cửa cho hành chính, đúng thứ đang
-- muốn đóng. Ai phụ trách sale mà cần lập hoá đơn thì tích thêm
-- `tuition.manage` cho vai trò đó ở màn Cài đặt.
drop policy if exists "staff manage invoices" on public.invoices;
create policy "staff manage invoices" on public.invoices
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));

drop policy if exists "staff read invoices" on public.invoices;
create policy "staff read invoices" on public.invoices
  for select using (public.has_perm('tuition.manage'));
