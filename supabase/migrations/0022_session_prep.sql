-- =====================================================================
-- CHUẨN BỊ BUỔI HỌC: giáo viên soạn trước cho buổi dạy — chọn bài theo giáo
-- trình, đặt link slide riêng cho buổi và ghi chú chuẩn bị.
-- Chạy SAU 0021_points_reminders.sql.
--
-- Vì sao slide lưu ở sessions chứ không sửa lessons.slide_embed_url:
--   lessons dùng chung cho mọi lớp học cùng giáo trình — mỗi buổi giáo viên có
--   thể dùng bản slide riêng của mình mà không đụng vào bài học của người khác.
--   Thứ tự ưu tiên khi chiếu: link tạm dán trong giờ → slide của buổi →
--   slide của bài học.
-- =====================================================================

alter table public.sessions add column slide_url text;
alter table public.sessions add column prep_note text;

comment on column public.sessions.slide_url is
  'Link slide chuẩn bị riêng cho buổi này (ưu tiên hơn lessons.slide_embed_url)';
comment on column public.sessions.prep_note is
  'Ghi chú chuẩn bị của giáo viên: đồ dùng, hoạt động dự kiến…';

-- Giáo viên đứng buổi (kể cả GV dạy thay, GV phụ trách lớp) được sửa buổi mình
-- dạy. Trước đây chỉ khớp sessions.teacher_id nên GV phụ trách lớp không lưu
-- được phần chuẩn bị khi buổi chưa gán giáo viên.
drop policy "teachers update own sessions" on public.sessions;
create policy "teachers update own sessions" on public.sessions
  for update using (public.teaches_session(id))
  with check (public.teaches_session(id));
