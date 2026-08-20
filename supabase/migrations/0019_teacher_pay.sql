-- =====================================================================
-- TIỀN CÔNG GIÁO VIÊN: hành chính thiết lập mức lương cho từng GV,
-- bảng công tháng /admin/payroll tự quy ra tiền.
-- Chạy SAU 0018_teaching_logs.sql.
--
-- 2 loại giáo viên (chốt với trung tâm 20/08/2026):
--   1. 'visiting'  — THỈNH GIẢNG: trả theo buổi dạy, mức tiền phụ thuộc
--      SĨ SỐ LỚP (bảng bậc thang trong teacher_pay_tiers). Sĩ số lấy theo
--      số HV đang active của lớp tại thời điểm tính, không phụ thuộc buổi
--      đó ai vắng.
--   2. 'fulltime' — LƯƠNG CỨNG tháng + số giờ chuẩn/tháng; dạy vượt giờ
--      chuẩn thì mỗi giờ vượt trả thêm overtime_rate.
--
-- Tiền công KHÔNG lưu sẵn theo tháng mà tính lại từ buổi dạy + mức lương
-- hiện hành (giống cách tính số buổi còn lại của gói học phí).
-- =====================================================================

create table public.teacher_pay_profiles (
  teacher_id uuid primary key references public.profiles (id) on delete cascade,
  pay_type text not null default 'visiting'
    check (pay_type in ('visiting', 'fulltime')),
  base_salary numeric not null default 0,    -- fulltime: lương cứng / tháng
  standard_hours numeric not null default 0, -- fulltime: số giờ dạy chuẩn / tháng
  overtime_rate numeric not null default 0,  -- fulltime: tiền mỗi giờ vượt
  note text,
  updated_at timestamptz not null default now(),
  constraint teacher_pay_amounts_non_negative
    check (base_salary >= 0 and standard_hours >= 0 and overtime_rate >= 0)
);

-- Bậc thang theo sĩ số cho GV thỉnh giảng: [min_students, max_students] → tiền/buổi
create table public.teacher_pay_tiers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  min_students int not null default 1,
  max_students int,                    -- null = không giới hạn trên
  amount numeric not null default 0,   -- tiền cho 1 buổi dạy
  constraint teacher_pay_tiers_range
    check (min_students >= 0 and (max_students is null or max_students >= min_students)),
  constraint teacher_pay_tiers_amount check (amount >= 0)
);

create index teacher_pay_tiers_teacher_idx on public.teacher_pay_tiers (teacher_id, min_students);

alter table public.teacher_pay_profiles enable row level security;
alter table public.teacher_pay_tiers enable row level security;

-- Chỉ hành chính đọc/sửa mức lương (dữ liệu nhạy cảm, GV không xem của nhau).
create policy "staff manage pay profiles" on public.teacher_pay_profiles
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage pay tiers" on public.teacher_pay_tiers
  for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.touch_pay_profile()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_pay_profile
  before update on public.teacher_pay_profiles
  for each row execute function public.touch_pay_profile();
