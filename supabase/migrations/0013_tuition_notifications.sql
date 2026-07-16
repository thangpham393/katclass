-- =====================================================================
-- GIAI ĐOẠN 2 (phần 1): học phí gói buổi + thông báo in-app.
-- Chạy SAU 0012_class_textbook.sql.
--
-- Chính sách học phí đã chốt (KE-HOACH-CHUC-NANG.md mục 5.1):
--   - Học viên mua gói N buổi (giá + ưu đãi), hành chính thu tiền, xuất biên lai.
--   - Mỗi điểm danh present / absent_excused / absent_unexcused trừ 1 buổi.
--   - Điểm danh makeup (đi học bù) KHÔNG trừ — đã trừ ở buổi vắng.
--   - Số buổi còn lại TÍNH NGƯỢC từ điểm danh kể từ ngày kích hoạt gói
--     đầu tiên (không lưu số dư — không lệch dữ liệu khi sửa điểm danh).
--   - Nhiều gói: trừ lần lượt theo thứ tự ngày kích hoạt (gói cũ hết
--     trước rồi mới trừ sang gói mới).
--   - Còn ≤ 3 buổi → cảnh báo hành chính + thông báo học viên/phụ huynh.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Gói buổi đã bán cho học viên
-- ---------------------------------------------------------------------
create table public.enrollment_packages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,                          -- vd: "Gói 24 buổi"
  total_sessions int not null check (total_sessions > 0),
  price numeric(12, 0) not null check (price >= 0),        -- giá gốc (VND)
  discount numeric(12, 0) not null default 0
    check (discount >= 0 and discount <= price),           -- ưu đãi (VND)
  start_date date not null default current_date,           -- ngày kích hoạt: điểm danh từ ngày này bắt đầu trừ
  status text not null default 'active' check (status in ('active', 'cancelled')),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index enrollment_packages_student_idx
  on public.enrollment_packages (student_id, start_date);

-- ---------------------------------------------------------------------
-- 2. Thanh toán (một gói có thể đóng nhiều lần) + số biên lai tự cấp
-- ---------------------------------------------------------------------
create sequence public.receipt_no_seq;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.enrollment_packages (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 0) not null check (amount > 0),
  method text not null check (method in ('cash', 'transfer')),
  receipt_no text not null unique
    default 'BL-' || lpad(nextval('public.receipt_no_seq')::text, 5, '0'),
  note text,
  received_by uuid references public.profiles (id),
  paid_at timestamptz not null default now()
);

create index payments_package_idx on public.payments (package_id);
create index payments_student_idx on public.payments (student_id);

-- ---------------------------------------------------------------------
-- 3. Số buổi còn lại — tính ngược từ điểm danh
-- ---------------------------------------------------------------------

-- Tổng buổi còn lại của một học viên trên các gói active.
-- NULL nếu học viên chưa mua gói nào.
create or replace function public.student_sessions_remaining(sid uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  with tot as (
    select sum(total_sessions)::int as total, min(start_date) as first_start
    from enrollment_packages
    where student_id = sid and status = 'active'
  )
  select case
    when (select first_start from tot) is null then null
    else greatest(0, (select total from tot) - (
      select count(*)::int
      from attendance a
      join sessions s on s.id = a.session_id
      where a.student_id = sid
        and a.status in ('present', 'absent_excused', 'absent_unexcused')
        and s.status <> 'cancelled'
        and s.date >= (select first_start from tot)
    ))
  end;
$$;

-- View số dư từng gói (phân bổ FIFO theo ngày kích hoạt) + tiền đã đóng.
-- security_invoker: RLS của bảng gốc quyết định ai thấy dòng nào —
-- học viên thấy gói của mình, phụ huynh thấy của con, staff thấy tất cả.
create view public.package_balances
with (security_invoker = on) as
with pkg as (
  select p.*,
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
  (pkg.price - pkg.discount) as final_price,
  pkg.start_date,
  pkg.note,
  pkg.created_at,
  least(pkg.total_sessions, greatest(0, coalesce(u.used_total, 0) - pkg.cum_before)) as used_sessions,
  (pkg.total_sessions
    - least(pkg.total_sessions, greatest(0, coalesce(u.used_total, 0) - pkg.cum_before))) as remaining_sessions,
  coalesce(pa.paid_amount, 0) as paid_amount,
  (pkg.price - pkg.discount - coalesce(pa.paid_amount, 0)) as debt
from pkg
join public.profiles pr on pr.id = pkg.student_id
left join used u on u.student_id = pkg.student_id
left join paid pa on pa.package_id = pkg.id;

-- ---------------------------------------------------------------------
-- 4. Thông báo in-app (cột channel để sẵn cho Zalo OA/ZNS sau này)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'homework_new',      -- bài tập mới được giao
    'makeup_scheduled',  -- được xếp lịch học bù
    'child_absent',      -- con vắng mặt (gửi phụ huynh)
    'package_low',       -- gói buổi sắp hết / đã hết
    'generic'
  )),
  title text not null,
  body text,
  link text,                                   -- đường dẫn in-app khi bấm vào
  channel text not null default 'inapp' check (channel in ('inapp', 'zalo')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Trigger sinh thông báo (security definer → bỏ qua RLS khi insert)
-- ---------------------------------------------------------------------

-- 5a. Giao bài tập mới → báo mọi học viên active trong lớp
create or replace function public.notify_homework_new()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into notifications (recipient_id, type, title, body, link)
  select cs.student_id, 'homework_new',
         'Bài tập mới: ' || new.title,
         'Lớp ' || c.name
           || case when new.due_at is not null
                then ' · hạn nộp ' || to_char(new.due_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
                else '' end,
         '/student/homework/' || new.id
  from class_students cs
  join classes c on c.id = new.class_id
  where cs.class_id = new.class_id and cs.status = 'active';
  return new;
end;
$$;

create trigger on_homework_notify
  after insert on public.homeworks
  for each row execute function public.notify_homework_new();

-- 5b. Xếp học bù → báo học viên + phụ huynh
create or replace function public.notify_makeup_scheduled()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sess record;
  sname text;
begin
  if new.status = 'scheduled' and new.makeup_session_id is not null
     and (tg_op = 'INSERT'
          or old.makeup_session_id is distinct from new.makeup_session_id
          or old.status is distinct from new.status) then
    select s.date, s.start_time, c.name as class_name into sess
    from sessions s
    left join classes c on c.id = s.class_id
    where s.id = new.makeup_session_id;

    select name into sname from profiles where id = new.student_id;

    insert into notifications (recipient_id, type, title, body, link)
    select r.recipient_id, 'makeup_scheduled', r.title,
           'Buổi ' || to_char(sess.date, 'DD/MM/YYYY') || ' lúc '
             || to_char(sess.start_time, 'HH24:MI')
             || ' · lớp ' || coalesce(sess.class_name, '?'),
           r.link
    from (
      select new.student_id as recipient_id,
             'Bạn được xếp lịch học bù'::text as title,
             '/student'::text as link
      union all
      select ps.parent_id,
             sname || ' được xếp lịch học bù',
             '/parent'
      from parent_students ps
      where ps.student_id = new.student_id
    ) r;
  end if;
  return new;
end;
$$;

create trigger on_makeup_notify
  after insert or update on public.makeup_credits
  for each row execute function public.notify_makeup_scheduled();

-- 5c. Điểm danh: báo phụ huynh khi con vắng + cảnh báo sắp hết gói buổi
create or replace function public.notify_attendance_events()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sess record;
  sname text;
  remaining int;
begin
  -- upsert lại cùng trạng thái (sửa ghi chú...) thì không báo lại
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select s.date, c.name as class_name into sess
  from sessions s
  left join classes c on c.id = s.class_id
  where s.id = new.session_id;

  select name into sname from profiles where id = new.student_id;

  -- Con vắng mặt → báo phụ huynh
  if new.status in ('absent_excused', 'absent_unexcused') then
    insert into notifications (recipient_id, type, title, body, link)
    select ps.parent_id, 'child_absent',
           sname || case when new.status = 'absent_excused'
             then ' vắng mặt (có phép)' else ' vắng mặt (không phép)' end,
           'Lớp ' || coalesce(sess.class_name, '?')
             || ' · buổi ngày ' || to_char(sess.date, 'DD/MM/YYYY')
             || case when new.status = 'absent_excused'
                  then ' — trung tâm sẽ xếp lịch học bù.' else '.' end,
           '/parent'
    from parent_students ps
    where ps.student_id = new.student_id;
  end if;

  -- Trạng thái có trừ buổi → kiểm tra gói sắp hết (≤ 3 buổi)
  if new.status in ('present', 'absent_excused', 'absent_unexcused') then
    remaining := student_sessions_remaining(new.student_id);
    if remaining is not null and remaining <= 3 then
      insert into notifications (recipient_id, type, title, body, link)
      select r.recipient_id, 'package_low',
             case when remaining = 0 then 'Đã hết buổi trong gói học'
                  else 'Gói học sắp hết buổi' end,
             sname
               || case when remaining = 0 then ' đã dùng hết số buổi trong gói.'
                       else ' chỉ còn ' || remaining || ' buổi trong gói.' end
               || ' Vui lòng liên hệ trung tâm để gia hạn.',
             r.link
      from (
        select new.student_id as recipient_id, '/student'::text as link
        union all
        select ps.parent_id, '/parent'
        from parent_students ps
        where ps.student_id = new.student_id
      ) r
      -- chống dội thông báo: mỗi người tối đa 1 cảnh báo package_low / 3 ngày
      where not exists (
        select 1 from notifications n
        where n.recipient_id = r.recipient_id
          and n.type = 'package_low'
          and n.created_at > now() - interval '3 days'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger on_attendance_notify
  after insert or update of status on public.attendance
  for each row execute function public.notify_attendance_events();

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.enrollment_packages enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- Gói buổi: học viên xem của mình, phụ huynh xem của con, staff quản lý
create policy "view own packages" on public.enrollment_packages
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
  );
create policy "staff manage packages" on public.enrollment_packages
  for all using (public.is_staff()) with check (public.is_staff());

-- Thanh toán: như gói buổi
create policy "view own payments" on public.payments
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
  );
create policy "staff manage payments" on public.payments
  for all using (public.is_staff()) with check (public.is_staff());

-- Thông báo: ai nhận người đó đọc + đánh dấu đã đọc; staff gửi tay được
create policy "read own notifications" on public.notifications
  for select using (recipient_id = public.my_profile_id() or public.is_staff());
create policy "mark own notifications read" on public.notifications
  for update using (recipient_id = public.my_profile_id())
  with check (recipient_id = public.my_profile_id());
create policy "staff manage notifications" on public.notifications
  for all using (public.is_staff()) with check (public.is_staff());
