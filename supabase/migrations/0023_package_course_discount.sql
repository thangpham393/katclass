-- =====================================================================
-- Gói học phí: gắn KHÓA HỌC (chương trình bán ra) + ưu đãi kép (% và tiền mặt).
-- Chạy SAU 0022_session_prep.sql.
--
--   - `course_id`: gói này bán chương trình nào (courses = chương trình bán
--     ra; giáo trình lớp dùng là chuyện khác, nằm ở classes.textbook_id).
--   - `discount_percent`: ưu đãi theo %, tính trên GIÁ GỐC.
--   - `discount`: ưu đãi tiền mặt (giữ nguyên cột cũ), trừ SAU phần %.
--     → giá cuối = price - round(price * discount_percent / 100) - discount
-- =====================================================================

alter table public.enrollment_packages
  add column if not exists course_id uuid references public.courses (id) on delete set null,
  add column if not exists discount_percent numeric(5, 2) not null default 0;

-- Tổng ưu đãi (% + tiền mặt) không được vượt giá gốc.
alter table public.enrollment_packages
  drop constraint if exists enrollment_packages_discount_check;

alter table public.enrollment_packages
  drop constraint if exists enrollment_packages_discount_percent_check;
alter table public.enrollment_packages
  add constraint enrollment_packages_discount_percent_check
    check (discount_percent >= 0 and discount_percent <= 100);

alter table public.enrollment_packages
  drop constraint if exists enrollment_packages_discount_total_check;
alter table public.enrollment_packages
  add constraint enrollment_packages_discount_total_check
    check (
      discount >= 0
      and round(price * discount_percent / 100) + discount <= price
    );

create index if not exists enrollment_packages_course_idx
  on public.enrollment_packages (course_id);

-- ---------------------------------------------------------------------
-- View số dư: giá cuối trừ cả hai loại ưu đãi, kèm thông tin khóa học.
-- Cột cũ giữ nguyên thứ tự/kiểu (create or replace giữ được grant + RLS),
-- cột mới thêm ở cuối.
-- ---------------------------------------------------------------------
create or replace view public.package_balances
with (security_invoker = on) as
with pkg as (
  select p.*,
         round(p.price * p.discount_percent / 100) as discount_amount,
         round(p.price * p.discount_percent / 100) + p.discount as discount_total,
         coalesce(sum(p.total_sessions) over (
           partition by p.student_id
           order by p.start_date, p.created_at
           rows between unbounded preceding and 1 preceding
         ), 0)::int as cum_before
  from public.enrollment_packages p
  where p.status = 'active'
),
first_pkg as (
  select student_id, min(start_date) as first_start
  from public.enrollment_packages
  where status = 'active'
  group by student_id
),
used as (
  select a.student_id, count(*)::int as used_total
  from public.attendance a
  join public.sessions s on s.id = a.session_id
  join first_pkg f on f.student_id = a.student_id
  where a.status in ('present', 'absent_excused', 'absent_unexcused')
    and s.status <> 'cancelled'
    and s.date >= f.first_start
  group by a.student_id
),
paid as (
  select package_id, sum(amount) as paid_amount
  from public.payments
  group by package_id
)
select
  pkg.id,
  pkg.student_id,
  pr.name as student_name,
  pr.student_code,
  pr.phone as student_phone,
  pkg.name,
  pkg.total_sessions,
  pkg.price,
  pkg.discount,
  (pkg.price - pkg.discount_total) as final_price,
  pkg.start_date,
  pkg.note,
  pkg.created_at,
  least(pkg.total_sessions, greatest(0, coalesce(u.used_total, 0) - pkg.cum_before)) as used_sessions,
  (pkg.total_sessions
    - least(pkg.total_sessions, greatest(0, coalesce(u.used_total, 0) - pkg.cum_before))) as remaining_sessions,
  coalesce(pa.paid_amount, 0) as paid_amount,
  (pkg.price - pkg.discount_total - coalesce(pa.paid_amount, 0)) as debt,
  -- cột mới (0023)
  pkg.course_id,
  c.name as course_name,
  c.level as course_level,
  pkg.discount_percent,
  pkg.discount_amount,
  pkg.discount_total
from pkg
join public.profiles pr on pr.id = pkg.student_id
left join public.courses c on c.id = pkg.course_id
left join used u on u.student_id = pkg.student_id
left join paid pa on pa.package_id = pkg.id;
