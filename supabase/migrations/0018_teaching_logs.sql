-- =====================================================================
-- CHẤM CÔNG CA DẠY (Giai đoạn 2): giáo viên "điểm danh ca dạy" ngay khi
-- lên lớp — hệ thống ghi nhận giờ dạy THỰC TẾ, số giờ và nội dung bài học.
-- Chạy SAU 0017_timed_tests.sql.
--
-- Vì sao có bảng riêng mà không nhét vào sessions:
--   - sessions.start_time/end_time là giờ THEO LỊCH (hành chính xếp),
--     còn ca dạy thực tế có thể lệch (vào muộn, dạy bù thêm giờ).
--   - Cần biết ai bấm, bấm lúc nào (checked_in_at) để đối soát công.
-- 1 buổi = tối đa 1 bản ghi công (unique session_id) = 1 công.
-- =====================================================================

create table public.teaching_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id), -- GV được tính công
  checked_in_at timestamptz not null default now(),         -- lúc bấm chấm công
  actual_start time not null,
  actual_end time not null,
  lesson_content text,                                      -- nội dung bài học đã dạy
  note text,
  created_by uuid references public.profiles (id),          -- người bấm (GV hoặc hành chính chấm hộ)
  updated_at timestamptz not null default now(),
  constraint teaching_logs_time_order check (actual_end > actual_start)
);

create index teaching_logs_teacher_idx on public.teaching_logs (teacher_id);

alter table public.teaching_logs enable row level security;

-- GV đứng buổi xem/ghi công của buổi mình; hành chính toàn quyền (chấm hộ, sửa)
create policy "view teaching logs" on public.teaching_logs
  for select using (public.is_staff() or public.teaches_session(session_id));
create policy "teachers log teaching" on public.teaching_logs
  for insert with check (public.is_staff() or public.teaches_session(session_id));
create policy "teachers update teaching log" on public.teaching_logs
  for update using (public.is_staff() or public.teaches_session(session_id))
  with check (public.is_staff() or public.teaches_session(session_id));
create policy "staff delete teaching log" on public.teaching_logs
  for delete using (public.is_staff());

-- Chấm công xong thì buổi coi như đã diễn ra (trang /admin/payroll đếm
-- buổi completed). Chạy security definer để GV không cần quyền update sessions.
create or replace function public.complete_session_on_log()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  update public.sessions
     set status = 'completed'
   where id = new.session_id
     and status = 'scheduled';
  return new;
end;
$$;

create trigger trg_complete_session_on_log
  after insert on public.teaching_logs
  for each row execute function public.complete_session_on_log();

-- Giữ updated_at
create or replace function public.touch_teaching_log()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_teaching_log
  before update on public.teaching_logs
  for each row execute function public.touch_teaching_log();
