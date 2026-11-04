-- 0064 — NHẬT KÝ BUỔI HỌC: GV chốt buổi ghi thêm tiến độ, BTVN, dự kiến buổi sau
--
-- Khi chấm công ca dạy (kết thúc buổi), ngoài nội dung đã dạy giáo viên tích:
--   * progress      — tiến độ so với kế hoạch: đúng / chậm hơn / nhanh hơn
--   * homework_note — bài tập về nhà đã giao (ghi tay, kể cả bài giao ngoài hệ thống)
--   * next_plan     — nội dung dự kiến dạy buổi sau (GV dạy thay đọc là nắm)
-- Trang /admin/sessions và /teacher/sessions liệt kê mọi buổi đã chấm công
-- kèm các cột này để ban quản lý kiểm soát nội dung từng buổi.
-- RLS của teaching_logs giữ nguyên (0018, 0059).

alter table public.teaching_logs
  add column if not exists progress text
    check (progress in ('on_track', 'behind', 'ahead')),
  add column if not exists homework_note text,
  add column if not exists next_plan text;

create index if not exists teaching_logs_progress_idx
  on public.teaching_logs (progress) where progress is not null;
