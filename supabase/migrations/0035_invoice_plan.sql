-- =====================================================================
-- 0035: HOÁ ĐƠN GẮN VỚI GÓI BUỔI + KẾ HOẠCH HỌC
--
-- Trước đây trung tâm làm hai việc ở hai chỗ: "bán gói buổi" (tạo
-- enrollment_packages, trừ buổi theo điểm danh) và "lập hoá đơn" (tờ
-- giấy gửi khách). Thực tế văn phòng chỉ làm MỘT thao tác — viết hoá
-- đơn cho phụ huynh — nên form gộp lại, và hoá đơn cần chứa luôn phần
-- kế hoạch học đã hứa với khách:
--
--   tổng số buổi · ngày bắt đầu · số buổi/tuần · ngày kết thúc dự kiến
--
-- `package_id` là cầu nối: hoá đơn của một học viên sẽ tự sinh gói buổi
-- tương ứng, và số buổi còn lại vẫn tính từ điểm danh như cũ.
-- =====================================================================

alter table public.invoices
  add column if not exists total_sessions    int,
  add column if not exists start_date        date,
  add column if not exists sessions_per_week numeric(4, 1),
  add column if not exists end_date          date,
  add column if not exists package_id        uuid
    references public.enrollment_packages (id) on delete set null;

comment on column public.invoices.total_sessions is
  'Số buổi đã bán trên tờ hoá đơn — dùng để sinh gói buổi cho học viên';
comment on column public.invoices.package_id is
  'Gói buổi sinh ra từ hoá đơn này (null với hoá đơn của khách chưa ghi danh)';

create index if not exists invoices_package_idx on public.invoices (package_id);
