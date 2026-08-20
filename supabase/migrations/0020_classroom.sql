-- =====================================================================
-- CHẾ ĐỘ LỚP HỌC TRỰC TIẾP (P1) — giáo viên dạy trọn buổi trên 1 màn hình.
-- Chạy SAU 0019_teacher_pay.sql.
--
-- Bối cảnh: học viên KHÔNG dùng thiết bị trong giờ (chốt 20/08/2026) —
-- mọi thao tác do GV bấm trên máy nối máy chiếu. Vì vậy không có bảng
-- "phiên realtime", chỉ cần nơi lưu KẾT QUẢ tương tác để HV/PH xem lại.
--
-- Thêm:
--   1. class_points      — điểm ★ giáo viên cộng/trừ cho HV trong giờ
--   2. session_activities — nhật ký hoạt động đã chạy trong buổi
--   3. view student_points_summary — tổng sao cho HV/PH
--   4. thông báo "Báo cáo buổi học" khi GV chốt buổi (chấm công)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Điểm thưởng trong giờ
-- ---------------------------------------------------------------------
create table public.class_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  points smallint not null default 1,  -- âm = trừ điểm
  reason text not null default 'speak' check (reason in (
    'speak',     -- phát biểu
    'correct',   -- trả lời đúng
    'homework',  -- làm bài tốt
    'help',      -- giúp bạn
    'chinese',   -- chủ động nói tiếng Trung
    'prepare',   -- chuẩn bị bài
    'game',      -- thắng hoạt động/trò chơi
    'behavior',  -- trừ điểm: mất trật tự
    'bonus'
  )),
  team text,                                              -- tên đội nếu chơi theo đội
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index class_points_session_idx on public.class_points (session_id);
create index class_points_student_idx on public.class_points (student_id, created_at desc);

alter table public.class_points enable row level security;

-- GV đứng buổi toàn quyền trong buổi của mình; HV xem điểm mình; PH xem điểm con
create policy "view class points" on public.class_points
  for select using (
    public.is_staff()
    or public.teaches_session(session_id)
    or student_id = public.my_profile_id()
    or public.is_my_student(student_id)
  );
create policy "teachers give points" on public.class_points
  for insert with check (public.is_staff() or public.teaches_session(session_id));
create policy "teachers edit points" on public.class_points
  for update using (public.is_staff() or public.teaches_session(session_id))
  with check (public.is_staff() or public.teaches_session(session_id));
create policy "teachers delete points" on public.class_points
  for delete using (public.is_staff() or public.teaches_session(session_id));

-- ---------------------------------------------------------------------
-- 2. Nhật ký hoạt động trong buổi (để báo cáo cho PH + gợi ý buổi sau)
-- ---------------------------------------------------------------------
create table public.session_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  kind text not null check (kind in (
    'slide', 'vocab', 'game', 'quiz', 'whiteboard', 'stroke', 'random', 'timer', 'note'
  )),
  title text,                                  -- nhãn hiển thị: "Game lật thẻ", "Bài 5 - slide"
  ref_id uuid,                                 -- lesson_id / homework_id / vocab_id… (không ràng buộc FK)
  payload jsonb not null default '{}'::jsonb,  -- {duration:180, board_url:'...', winner:'Đội A'}
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index session_activities_session_idx on public.session_activities (session_id, created_at);

alter table public.session_activities enable row level security;

-- Ai xem được buổi thì xem được hoạt động của buổi (HV, PH, GV, staff)
create policy "view session activities" on public.session_activities
  for select using (
    public.is_staff()
    or public.teaches_session(session_id)
    or exists (select 1 from public.sessions s
               where s.id = session_id
                 and ((s.class_id is not null and public.can_view_class(s.class_id))
                      or exists (select 1 from public.makeup_credits mc
                                 where mc.makeup_session_id = s.id
                                   and (mc.student_id = public.my_profile_id()
                                        or public.is_my_student(mc.student_id)))))
  );
create policy "teachers log activities" on public.session_activities
  for insert with check (public.is_staff() or public.teaches_session(session_id));
create policy "teachers delete activities" on public.session_activities
  for delete using (public.is_staff() or public.teaches_session(session_id));

-- ---------------------------------------------------------------------
-- 3. Tổng sao của học viên (security_invoker → RLS của class_points áp dụng,
--    dùng chung cho khu HV, cổng phụ huynh và khu giáo viên)
-- ---------------------------------------------------------------------
create view public.student_points_summary
with (security_invoker = true) as
select
  cp.student_id,
  sum(cp.points)::int as total_points,
  sum(cp.points) filter (
    where cp.created_at >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')
  )::int as month_points,
  count(distinct cp.session_id)::int as sessions_with_points,
  max(cp.created_at) as last_point_at
from public.class_points cp
group by cp.student_id;

-- ---------------------------------------------------------------------
-- 4. Chốt buổi → báo cáo buổi học cho học viên + phụ huynh
--    (bấm "Hoàn tất buổi" trong lớp học trực tiếp = ghi teaching_logs)
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'homework_new',      -- bài tập mới được giao
    'makeup_scheduled',  -- được xếp lịch học bù
    'child_absent',      -- con vắng mặt (gửi phụ huynh)
    'package_low',       -- gói buổi sắp hết / đã hết
    'schedule_change',   -- buổi học đổi lịch / hủy / đổi GV (gửi HV + PH)
    'request_new',       -- GV gửi yêu cầu nghỉ/đổi buổi (gửi admin/staff)
    'request_resolved',  -- kết quả duyệt yêu cầu (gửi GV)
    'session_report',    -- báo cáo buổi học sau khi GV chốt buổi
    'generic'
  ));

create or replace function public.notify_session_report()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sess record;
begin
  select s.date, s.class_id, c.name as class_name into sess
  from sessions s
  left join classes c on c.id = s.class_id
  where s.id = new.session_id;

  -- Học viên có điểm danh buổi này (gồm cả học viên học bù) + phụ huynh của họ
  insert into notifications (recipient_id, type, title, body, link)
  select r.recipient_id, 'session_report', r.title,
         coalesce('Lớp ' || sess.class_name || ' · ', '')
           || to_char(sess.date, 'DD/MM/YYYY')
           || coalesce(' · ' || nullif(new.lesson_content, ''), ''),
         r.link
  from (
    select a.student_id as recipient_id,
           'Báo cáo buổi học hôm nay'::text as title,
           ('/student/sessions/' || new.session_id)::text as link
    from attendance a
    where a.session_id = new.session_id and a.status in ('present', 'makeup')
    union
    select ps.parent_id,
           p.name || ' vừa học xong buổi hôm nay',
           '/parent'
    from attendance a
    join parent_students ps on ps.student_id = a.student_id
    join profiles p on p.id = a.student_id
    where a.session_id = new.session_id and a.status in ('present', 'makeup')
  ) r;
  return new;
end;
$$;

-- Chỉ bắn 1 lần lúc chốt buổi (insert), sửa chấm công sau đó không bắn lại
create trigger on_teaching_log_report
  after insert on public.teaching_logs
  for each row execute function public.notify_session_report();
