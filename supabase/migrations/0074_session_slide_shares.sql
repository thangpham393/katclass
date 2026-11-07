-- =====================================================================
-- 0074: GỬI SLIDE PPT BÀI GIẢNG CHO HỌC VIÊN SAU BUỔI HỌC
--
-- Giáo viên TỰ TÍCH gửi (không tự động) lúc chấm công / Chốt buổi: chọn một
-- hoặc nhiều slide HTML trong kho (0068), mặc định là slide của buổi.
-- Học viên của lớp (kể cả HV vắng, HV học bù buổi đó) + phụ huynh xem lại
-- được ở mục ôn tập: trang bài học, trang lớp, báo cáo buổi.
--
-- Học viên KHÔNG đọc được cả kho slide — chỉ đọc qua RPC my_shared_slides
-- và chỉ tải được file của slide đã gửi cho buổi mình xem được.
--
-- Chạy SAU 0073_class_start_date_keep_held.sql.
-- =====================================================================

-- 1. Bảng gửi slide --------------------------------------------------
create table if not exists public.session_slide_shares (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  slide_id    uuid not null references public.html_slides (id) on delete cascade,
  shared_by   uuid references public.profiles (id) default public.my_profile_id(),
  shared_at   timestamptz not null default now(),
  primary key (session_id, slide_id)
);

create index if not exists session_slide_shares_slide_idx on public.session_slide_shares (slide_id);

comment on table public.session_slide_shares is
  'Slide HTML giáo viên gửi cho học viên sau buổi học (tích thủ công khi chấm công)';

-- 2. Ai xem được slide đã gửi của buổi --------------------------------
--    Người trong lớp (HV, PH, GV, hành chính) + HV học bù / điểm danh buổi đó
create or replace function public.can_see_session_slides(sess uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_staff()
    or public.teaches_session(sess)
    or exists (select 1 from public.sessions s
               where s.id = sess
                 and (s.teacher_id = public.my_profile_id()
                      or (s.class_id is not null and public.can_view_class(s.class_id))))
    or exists (select 1 from public.attendance a
               where a.session_id = sess
                 and (a.student_id = public.my_profile_id() or public.is_my_student(a.student_id)))
    or exists (select 1 from public.makeup_credits mc
               where mc.makeup_session_id = sess
                 and (mc.student_id = public.my_profile_id() or public.is_my_student(mc.student_id)));
$$;

alter table public.session_slide_shares enable row level security;

drop policy if exists "read slide shares" on public.session_slide_shares;
create policy "read slide shares" on public.session_slide_shares
  for select using (public.can_see_session_slides(session_id));

-- Gửi / thu hồi: GV đứng buổi, GV của lớp, hoặc hành chính chấm hộ
drop policy if exists "add slide shares" on public.session_slide_shares;
create policy "add slide shares" on public.session_slide_shares
  for insert with check (public.is_staff() or public.teaches_session(session_id));

drop policy if exists "remove slide shares" on public.session_slide_shares;
create policy "remove slide shares" on public.session_slide_shares
  for delete using (public.is_staff() or public.teaches_session(session_id));

-- 3. Học viên tải được FILE của slide đã gửi ------------------------------
create or replace function public.can_read_shared_slide_path(p text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.html_slides h
    join public.session_slide_shares sh on sh.slide_id = h.id
    where h.path = p and public.can_see_session_slides(sh.session_id)
  );
$$;

drop policy if exists "read shared html slides" on storage.objects;
create policy "read shared html slides" on storage.objects
  for select using (
    bucket_id = 'html-slides'
    and public.can_read_shared_slide_path(name)
  );

-- 4. Danh sách slide đã gửi cho tôi (HV / PH) ------------------------------
--    Lọc theo lớp, theo buổi, hoặc theo bài học (slide gắn bài đó HOẶC gửi ở
--    buổi có dạy bài đó).
create or replace function public.my_shared_slides(
  p_class_id   uuid default null,
  p_session_id uuid default null,
  p_lesson_id  uuid default null
)
returns table (
  slide_id     uuid,
  name         text,
  path         text,
  size_bytes   int,
  slide_lesson uuid,
  session_id   uuid,
  session_date date,
  session_no   int,
  class_id     uuid,
  class_name   text,
  lesson_ids   uuid[],
  shared_at    timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select h.id, h.name, h.path, h.size_bytes, h.lesson_id,
         s.id, s.date, s.session_no, s.class_id, c.name,
         coalesce((select array_agg(sl.lesson_id) from public.session_lessons sl where sl.session_id = s.id),
                  '{}'::uuid[]),
         sh.shared_at
  from public.session_slide_shares sh
  join public.html_slides h on h.id = sh.slide_id
  join public.sessions s on s.id = sh.session_id
  left join public.classes c on c.id = s.class_id
  where (p_class_id is null or s.class_id = p_class_id)
    and (p_session_id is null or s.id = p_session_id)
    and (p_lesson_id is null
         or h.lesson_id = p_lesson_id
         or exists (select 1 from public.session_lessons sl
                    where sl.session_id = s.id and sl.lesson_id = p_lesson_id))
    and public.can_see_session_slides(s.id)
  order by s.date desc, s.start_time desc, h.name;
$$;

grant execute on function public.my_shared_slides(uuid, uuid, uuid) to authenticated;

-- 5. Thông báo cho học viên ----------------------------------------------
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
    'comment_new',
    'review_new',
    'slide_shared',       -- GV gửi slide bài giảng sau buổi học
    'generic'
  ));

-- Gửi nhiều slide một lúc chỉ báo một lần / buổi / học viên (chống dội 30 phút)
create or replace function public.notify_slide_shared()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sess record;
  lnk  text;
begin
  select s.date, s.class_id, c.name as class_name into sess
  from sessions s
  left join classes c on c.id = s.class_id
  where s.id = new.session_id;

  lnk := case when sess.class_id is not null
              then '/student/classes/' || sess.class_id
              else '/student/sessions/' || new.session_id end;

  insert into notifications (recipient_id, type, title, body, link)
  select r.student_id, 'slide_shared', 'Giáo viên đã gửi slide bài giảng',
         coalesce('Lớp ' || sess.class_name || ' · ', '')
           || 'buổi ' || to_char(sess.date, 'DD/MM/YYYY') || ' — mở mục ôn tập để xem lại',
         lnk
  from (
    select cs.student_id
    from class_students cs
    where sess.class_id is not null and cs.class_id = sess.class_id and cs.status = 'active'
    union
    select a.student_id from attendance a where a.session_id = new.session_id
  ) r
  where not exists (
    select 1 from notifications n
    where n.recipient_id = r.student_id
      and n.type = 'slide_shared'
      and n.link = lnk
      and n.created_at > now() - interval '30 minutes'
  );
  return new;
end;
$$;

drop trigger if exists on_slide_shared on public.session_slide_shares;
create trigger on_slide_shared
  after insert on public.session_slide_shares
  for each row execute function public.notify_slide_shared();
