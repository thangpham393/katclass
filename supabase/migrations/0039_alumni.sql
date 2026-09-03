-- =====================================================================
-- 0039: HỌC VIÊN ĐÃ NGHỈ / BẢO LƯU — LÝ DO, NGÀY NGHỈ, HẸN QUAY LẠI
--
-- Trước: `profiles.study_status` chỉ nói được em này 'left' hay 'reserved',
--        KHÔNG có nghỉ từ bao giờ và vì sao. Hệ quả: không thống kê được
--        vì sao mất học viên, cũng không lọc ra "nghỉ 2-3 tháng, học tới
--        HSK2" để mời quay lại khi mở khóa phù hợp.
-- Sau:   4 cột trên hồ sơ — ngày nghỉ, lý do (danh mục cố định để thống
--        kê), ghi chú tự do, và ngày hẹn quay lại (bảo lưu tới ngày nào,
--        hoặc phụ huynh hẹn "ra Tết cho học lại").
--
-- Ngày nghỉ do TRIGGER tự điền khi trạng thái chuyển sang nghỉ/bảo lưu:
-- người nhập chỉ đổi trạng thái trong danh sách học viên là đủ, còn muốn
-- ghi lùi ngày thì cứ điền tay — trigger không đè lên giá trị có sẵn.
-- Kích hoạt lại (về 'studying') thì xóa sạch 4 cột, tránh cảnh hồ sơ đang
-- học mà vẫn treo lý do nghỉ cũ.
--
-- "Đã mời quay lại chưa" KHÔNG thêm cột: dùng lại `student_contacts`
-- (0031) — có liên hệ nào ghi sau ngày nghỉ nghĩa là đã có người gọi.
-- =====================================================================

-- 1. Cột mới ----------------------------------------------------------
alter table public.profiles add column if not exists left_at date;
alter table public.profiles add column if not exists left_reason text;
alter table public.profiles add column if not exists left_note text;
alter table public.profiles add column if not exists return_at date;

comment on column public.profiles.left_at is
  'Ngày học viên nghỉ / bắt đầu bảo lưu (trigger tự điền khi đổi study_status)';
comment on column public.profiles.left_reason is
  'Lý do nghỉ theo danh mục cố định — để thống kê vì sao mất học viên';
comment on column public.profiles.left_note is 'Ghi chú thêm về việc nghỉ';
comment on column public.profiles.return_at is
  'Bảo lưu đến ngày / ngày phụ huynh hẹn cho học lại';

alter table public.profiles drop constraint if exists profiles_left_reason_check;
alter table public.profiles add constraint profiles_left_reason_check
  check (left_reason is null or left_reason in (
    'moved',     -- chuyển nhà / chuyển trường
    'schedule',  -- bận lịch, không xếp được giờ
    'finance',   -- học phí
    'distance',  -- nhà xa trung tâm
    'finished',  -- đã đạt mục tiêu / học xong chương trình
    'quality',   -- chưa hài lòng chất lượng
    'teacher',   -- không hợp giáo viên
    'health',    -- sức khỏe / việc gia đình
    'switch',    -- chuyển sang trung tâm khác
    'other'
  ));

create index if not exists profiles_left_at_idx on public.profiles (left_at)
  where role = 'student';

-- 2. Điền ngày nghỉ cho dữ liệu cũ ------------------------------------
-- Buổi cuối cùng em có tên trong điểm danh là mốc gần đúng nhất; chưa
-- từng điểm danh thì lấy ngày nhập học, cuối cùng mới tới ngày tạo hồ sơ.
update public.profiles p
   set left_at = coalesce(
         (select max(s.date)
            from public.attendance a
            join public.sessions s on s.id = a.session_id
           where a.student_id = p.id),
         p.enrolled_at,
         p.created_at::date)
 where p.role = 'student'
   and p.study_status in ('left', 'reserved')
   and p.left_at is null;

-- 3. Trigger đồng bộ theo trạng thái ----------------------------------
create or replace function public.sync_study_status_dates()
returns trigger
language plpgsql
as $$
begin
  if new.study_status is distinct from old.study_status then
    if new.study_status in ('left', 'reserved') then
      -- Không đè lên ngày người dùng tự ghi (cho phép ghi lùi ngày).
      if new.left_at is null then
        new.left_at := current_date;
      end if;
    else
      new.left_at := null;
      new.left_reason := null;
      new.left_note := null;
      new.return_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_study_status_dates on public.profiles;
create trigger sync_study_status_dates
  before update on public.profiles
  for each row
  when (new.role = 'student')
  execute function public.sync_study_status_dates();
