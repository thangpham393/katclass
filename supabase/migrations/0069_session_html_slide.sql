-- =====================================================================
-- 0069: Slide HTML chọn sẵn cho buổi (trang Chuẩn bị buổi dạy)
--
-- Lớp học giờ chỉ chiếu slide HTML (0068), nên link Google ở
-- sessions.slide_url không còn dùng. Giáo viên chọn sẵn một slide trong kho
-- (hoặc tải file mới lên) cho buổi → vào lớp slide đó mở đầu tiên.
-- Thứ tự mở khi vào lớp: slide của buổi → slide đầu tiên của bài học.
--
-- Sửa cột này đi theo policy "teachers update own sessions" (0022).
--
-- Chạy SAU 0068_html_slides.sql.
-- =====================================================================

alter table public.sessions
  add column if not exists html_slide_id uuid references public.html_slides (id) on delete set null;

comment on column public.sessions.html_slide_id is
  'Slide HTML giáo viên chọn sẵn cho buổi (ưu tiên hơn slide của bài học)';
