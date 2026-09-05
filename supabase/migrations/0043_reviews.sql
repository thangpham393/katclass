-- =====================================================================
-- NHẬN XÉT HỌC VIÊN — VÁ 4 LỖ HỔNG (chạy SAU 0042_teaching_log_undo.sql)
--
-- 1. GV DẠY THAY GHI ĐƯỢC NHẬN XÉT. Policy cũ chỉ cho sửa dòng do chính
--    mình viết (`teacher_id = my_profile_id()`), nên khi lớp đổi người
--    dạy — hoặc hai GV cùng đứng một buổi — người sau bấm lưu là dính
--    42501. Nay: ai đang thực dạy buổi đó (`teaches_session`) đều ghi và
--    sửa được, nhưng `teacher_id` luôn phải là chính người ghi để phụ
--    huynh biết ai nhận xét.
--
-- 2. THÔNG BÁO. Viết nhận xét xong mà không ai hay thì coi như không
--    viết. Trigger bắn cho học viên + phụ huynh, chống dội 6 giờ để GV
--    sửa lại câu chữ vài lần không làm nổ chuông.
--
-- 3. NHẬN XÉT TỔNG KẾT (`student_reviews`). Nhận xét từng buổi là ảnh
--    chụp một ngày; phụ huynh còn cần bản tổng kết tháng/khóa. Có nháp
--    và phát hành riêng (`published_at`) để GV soạn dần, chỉ khi bấm
--    "Phát hành" thì nhà mới thấy và mới có thông báo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. GV có dạy học viên này không? (dùng cho nhận xét tổng kết)
--    Tính cả lớp đang phụ trách lẫn buổi lẻ đã từng đứng — GV dạy bù
--    riêng vẫn tổng kết được cho học viên mình dạy.
-- ---------------------------------------------------------------------
create or replace function public.teaches_student(sid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = sid and c.teacher_id = public.my_profile_id()
  ) or exists (
    select 1 from public.attendance a
    join public.sessions s on s.id = a.session_id
    where a.student_id = sid and s.teacher_id = public.my_profile_id()
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Nhận xét từng buổi: mở cho người thực dạy buổi
-- ---------------------------------------------------------------------
drop policy if exists "teachers write session comments" on public.session_comments;
create policy "teachers write session comments" on public.session_comments
  for insert with check (
    teacher_id = public.my_profile_id() and public.teaches_session(session_id)
  );

drop policy if exists "teachers update own comments" on public.session_comments;
drop policy if exists "teachers update session comments" on public.session_comments;
create policy "teachers update session comments" on public.session_comments
  for update
  using (teacher_id = public.my_profile_id() or public.teaches_session(session_id))
  with check (
    teacher_id = public.my_profile_id() and public.teaches_session(session_id)
  );

-- Sửa lại thì đổi luôn chủ nhận xét sang người vừa sửa (khớp with check ở trên)
alter table public.session_comments
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 2. Bảng nhận xét tổng kết theo kỳ
-- ---------------------------------------------------------------------
create table if not exists public.student_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  teacher_id uuid not null references public.profiles (id),

  -- Kỳ nhận xét: tự do ngày đầu–ngày cuối để dùng được cho cả tháng,
  -- giữa khóa lẫn cuối khóa mà không phải đẻ thêm loại kỳ cứng.
  period_start date not null,
  period_end date not null,
  title text not null,

  rating smallint check (rating between 1 and 5),
  strengths text,        -- làm tốt
  improvements text,     -- cần cải thiện
  content text,          -- nhận xét chung / lời dặn

  -- Số liệu chốt tại thời điểm phát hành (có mặt/vắng/★/bài tập) để bản
  -- tổng kết cũ không đổi số khi dữ liệu buổi bị sửa về sau.
  stats jsonb not null default '{}'::jsonb,

  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists student_reviews_student_idx
  on public.student_reviews (student_id, period_end desc);
create index if not exists student_reviews_teacher_idx
  on public.student_reviews (teacher_id, created_at desc);

alter table public.student_reviews enable row level security;

-- Học viên/phụ huynh chỉ thấy bản ĐÃ phát hành; GV thấy cả nháp của mình
drop policy if exists "view student reviews" on public.student_reviews;
create policy "view student reviews" on public.student_reviews
  for select using (
    ((student_id = public.my_profile_id() or public.is_my_student(student_id))
      and published_at is not null)
    or teacher_id = public.my_profile_id()
    or public.has_perm('classroom.teach')
  );

drop policy if exists "teachers write student reviews" on public.student_reviews;
create policy "teachers write student reviews" on public.student_reviews
  for insert with check (
    teacher_id = public.my_profile_id()
    and (public.teaches_student(student_id) or public.has_perm('classroom.teach'))
  );

drop policy if exists "teachers update student reviews" on public.student_reviews;
create policy "teachers update student reviews" on public.student_reviews
  for update
  using (teacher_id = public.my_profile_id() or public.has_perm('classroom.teach'))
  with check (teacher_id = public.my_profile_id() or public.has_perm('classroom.teach'));

drop policy if exists "teachers delete student reviews" on public.student_reviews;
create policy "teachers delete student reviews" on public.student_reviews
  for delete using (
    (teacher_id = public.my_profile_id() and published_at is null)
    or public.has_perm('classroom.teach')
  );

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_student_review_touch on public.student_reviews;
create trigger on_student_review_touch
  before update on public.student_reviews
  for each row execute function public.touch_updated_at();

drop trigger if exists on_session_comment_touch on public.session_comments;
create trigger on_session_comment_touch
  before update on public.session_comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Thông báo
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'homework_new',
    'makeup_scheduled',
    'child_absent',
    'package_low',
    'schedule_change',
    'request_new',
    'request_resolved',
    'session_report',
    'homework_reminder',
    'comment_new',        -- GV nhận xét sau buổi học
    'review_new',         -- GV phát hành nhận xét tổng kết
    'generic'
  ));

-- 3a. Nhận xét sau buổi → học viên + phụ huynh.
--     Chống dội: cùng một buổi/học viên chỉ báo lại sau 6 giờ.
create or replace function public.notify_session_comment()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sname text;
  sdate date;
  tname text;
begin
  if tg_op = 'UPDATE'
     and new.content is not distinct from old.content
     and new.rating is not distinct from old.rating then
    return new;
  end if;

  select p.name into sname from profiles p where p.id = new.student_id;
  select p.name into tname from profiles p where p.id = new.teacher_id;
  select s.date into sdate from sessions s where s.id = new.session_id;

  insert into notifications (recipient_id, type, title, body, link)
  select r.recipient_id, 'comment_new', r.title,
         coalesce(tname || ': ', '') || left(new.content, 140), r.link
  from (
    select new.student_id as recipient_id,
           'Nhận xét buổi ' || to_char(sdate, 'DD/MM')::text as title,
           ('/student/sessions/' || new.session_id)::text as link
    union all
    select ps.parent_id,
           sname || ' — nhận xét buổi ' || to_char(sdate, 'DD/MM'),
           '/parent'
    from parent_students ps
    where ps.student_id = new.student_id
  ) r
  where not exists (
    select 1 from notifications n
    where n.recipient_id = r.recipient_id
      and n.type = 'comment_new'
      and n.link = r.link
      and n.created_at > now() - interval '6 hours'
  );
  return new;
end;
$$;

drop trigger if exists on_session_comment_notify on public.session_comments;
create trigger on_session_comment_notify
  after insert or update on public.session_comments
  for each row execute function public.notify_session_comment();

-- 3b. Nhận xét tổng kết → chỉ bắn khi PHÁT HÀNH (nháp thì im)
create or replace function public.notify_student_review()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sname text;
begin
  if new.published_at is null
     or (tg_op = 'UPDATE' and old.published_at is not null) then
    return new;
  end if;

  select p.name into sname from profiles p where p.id = new.student_id;

  insert into notifications (recipient_id, type, title, body, link)
  select new.student_id, 'review_new', 'Nhận xét tổng kết: ' || new.title,
         left(coalesce(new.content, new.strengths, ''), 140), '/student'
  union all
  select ps.parent_id, 'review_new', sname || ' — ' || new.title,
         left(coalesce(new.content, new.strengths, ''), 140), '/parent'
  from parent_students ps
  where ps.student_id = new.student_id;
  return new;
end;
$$;

drop trigger if exists on_student_review_notify on public.student_reviews;
create trigger on_student_review_notify
  after insert or update on public.student_reviews
  for each row execute function public.notify_student_review();

comment on table public.student_reviews is
  'Nhận xét tổng kết theo kỳ (tháng/giữa khóa/cuối khóa). Nháp cho tới khi published_at có giá trị.';
comment on column public.student_reviews.stats is
  'Số liệu chốt lúc phát hành: {present, absent, sessions, stars, avg_rating} — giữ nguyên dù dữ liệu buổi đổi về sau.';
