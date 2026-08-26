-- =====================================================================
-- 0026: HAI CHI NHÁNH (Landmark & Thủ Đức)
--
-- Bảng `branches` đã có từ 0002 nhưng chưa dùng. Migration này:
--   1. Gắn mã (code) + cờ chi nhánh mặc định cho branches.
--   2. Dồn TOÀN BỘ dữ liệu đang có về chi nhánh Landmark
--      (hồ sơ, lớp, phòng học, buổi học) — Thủ Đức bắt đầu từ số 0.
--   3. Thêm branch_id cho `sessions` (buổi bù riêng không gắn lớp nên
--      không suy ra được chi nhánh qua lớp) + trigger tự điền theo lớp.
--   4. Thêm branch_id vào view `package_balances` để lọc học phí.
--
-- KHO HỌC LIỆU DÙNG CHUNG cả 2 chi nhánh: textbooks / lessons / vocab /
-- questions / homeworks / courses KHÔNG gắn chi nhánh — cố ý giữ nguyên.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Mã chi nhánh + chi nhánh mặc định
-- ---------------------------------------------------------------------
alter table public.branches add column if not exists code text;
alter table public.branches add column if not exists is_default boolean not null default false;
create unique index if not exists branches_code_key on public.branches (code);

-- Nếu đã lỡ tạo tay chi nhánh Landmark thì gắn mã cho nó thay vì tạo trùng
update public.branches set code = 'landmark'
where code is null and name ilike '%landmark%';

update public.branches set code = 'thuduc'
where code is null and (name ilike '%thủ đức%' or name ilike '%thu duc%');

insert into public.branches (name, code, is_default)
select 'Landmark', 'landmark', true
where not exists (select 1 from public.branches where code = 'landmark');

insert into public.branches (name, code, is_default)
select 'Thủ Đức', 'thuduc', false
where not exists (select 1 from public.branches where code = 'thuduc');

-- Landmark là chi nhánh mặc định (dữ liệu cũ dồn về đây)
update public.branches set is_default = coalesce(code = 'landmark', false);

/**
 * Chi nhánh mặc định — dùng làm DEFAULT cho các cột branch_id để
 * không bao giờ còn dòng dữ liệu "mồ côi" không thuộc chi nhánh nào.
 */
create or replace function public.default_branch_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.branches where is_default order by created_at limit 1
$$;

-- ---------------------------------------------------------------------
-- 2. Dồn dữ liệu cũ về Landmark + đặt DEFAULT cho dữ liệu mới
-- ---------------------------------------------------------------------
update public.profiles set branch_id = public.default_branch_id() where branch_id is null;
update public.classes   set branch_id = public.default_branch_id() where branch_id is null;
update public.rooms     set branch_id = public.default_branch_id() where branch_id is null;

alter table public.profiles alter column branch_id set default public.default_branch_id();
alter table public.classes  alter column branch_id set default public.default_branch_id();
alter table public.rooms    alter column branch_id set default public.default_branch_id();

-- ---------------------------------------------------------------------
-- 3. Buổi học gắn chi nhánh
-- ---------------------------------------------------------------------
alter table public.sessions add column if not exists branch_id uuid references public.branches (id);

update public.sessions s
   set branch_id = c.branch_id
  from public.classes c
 where c.id = s.class_id and s.branch_id is null;

update public.sessions set branch_id = public.default_branch_id() where branch_id is null;
alter table public.sessions alter column branch_id set default public.default_branch_id();

/** Buổi học luôn theo chi nhánh của lớp; buổi bù riêng lấy chi nhánh được truyền vào. */
create or replace function public.sessions_fill_branch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.class_id is not null then
    select c.branch_id into new.branch_id from public.classes c where c.id = new.class_id;
  end if;
  if new.branch_id is null then
    new.branch_id := public.default_branch_id();
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_fill_branch on public.sessions;
create trigger sessions_fill_branch
  before insert or update of class_id on public.sessions
  for each row execute function public.sessions_fill_branch();

-- ---------------------------------------------------------------------
-- 4. Chỉ mục lọc theo chi nhánh
-- ---------------------------------------------------------------------
create index if not exists sessions_branch_date_idx on public.sessions (branch_id, date);
create index if not exists classes_branch_idx       on public.classes (branch_id);
create index if not exists rooms_branch_idx         on public.rooms (branch_id);
create index if not exists profiles_branch_role_idx on public.profiles (branch_id, role);

-- ---------------------------------------------------------------------
-- 5. Học phí lọc theo chi nhánh Ở TẦNG CLIENT — KHÔNG đụng vào view
--
-- `package_balances` là view, muốn thêm cột branch_id thì phải viết lại
-- TOÀN BỘ định nghĩa view — mà định nghĩa đó đổi theo từng migration
-- (0013 rồi 0023). Chép lại ở đây là buộc 0026 phải chạy sau đúng phiên
-- bản view đó, hỏng ngay nếu database đang ở phiên bản khác.
-- Thay vào đó `fetchPackageBalances` lấy trước id học viên của chi nhánh
-- rồi lọc `student_id in (...)` — không phụ thuộc hình dạng view.
-- ---------------------------------------------------------------------
