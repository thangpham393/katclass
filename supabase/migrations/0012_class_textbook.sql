-- =====================================================================
-- 0012: GÁN GIÁO TRÌNH CHO LỚP HỌC
-- Mỗi lớp học theo một giáo trình chính trong thư viện. Khi gán nội
-- dung ôn tập cho buổi / giao bài tập, giáo viên mặc định chỉ thấy
-- bài học của giáo trình lớp đó — tránh loạn khi thư viện nhiều bộ.
-- Chạy SAU 0011_library.sql.
-- =====================================================================

alter table public.classes
  add column textbook_id uuid references public.textbooks (id) on delete set null;
