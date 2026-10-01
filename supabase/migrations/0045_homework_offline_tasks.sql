-- Phần bài tập giao thủ công đi kèm (hoặc độc lập với) câu hỏi trên hệ thống.
alter table public.homeworks
  add column manual_tasks text[] not null default '{}',
  add column teacher_note text not null default '';
