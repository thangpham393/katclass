-- =====================================================================
-- Buổi học bù ĐỘC LẬP (không gắn lớp nào): hành chính tạo buổi riêng
-- khi xếp học bù — chọn ngày giờ, phòng, giáo viên; học xong là xong.
-- Giáo viên đứng buổi vẫn được tính công như thường (buổi completed
-- có teacher_id = 1 công, trang /admin/payroll đếm từ sessions).
-- Chạy SAU 0015_change_requests.sql.
--
-- Thay đổi:
--   1. sessions.class_id cho phép NULL, nhưng CHỈ với type = 'makeup'.
--   2. teaches_session(): buổi không gắn lớp → xét giáo viên thực dạy
--      (trước đây inner join classes nên buổi độc lập không ai dạy được).
--   3. Policy "view sessions": GV thấy buổi mình được xếp dạy; phụ huynh
--      thấy buổi con được xếp học bù (trước đây chỉ học viên thấy).
--   4. Thông báo xếp học bù: ghi "buổi học bù riêng" khi không có lớp.
-- =====================================================================

-- 1. Cho phép buổi học bù không gắn lớp
alter table public.sessions alter column class_id drop not null;
alter table public.sessions add constraint sessions_standalone_makeup_only
  check (class_id is not null or type = 'makeup');

-- 2. Giáo viên đứng buổi này? — chịu được buổi không gắn lớp
create or replace function public.teaches_session(sess uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sessions s
    left join public.classes c on c.id = s.class_id
    where s.id = sess
      and (s.teacher_id = public.my_profile_id()
           or c.teacher_id = public.my_profile_id())
  );
$$;

-- 3. Ai xem được buổi học: người trong lớp; GV được xếp dạy buổi này;
--    học viên được xếp học bù + phụ huynh của học viên đó
drop policy "view sessions" on public.sessions;
create policy "view sessions" on public.sessions
  for select using (
    (class_id is not null and public.can_view_class(class_id))
    or teacher_id = public.my_profile_id()
    or exists (select 1 from public.makeup_credits mc
               where mc.makeup_session_id = sessions.id
                 and (mc.student_id = public.my_profile_id()
                      or public.is_my_student(mc.student_id)))
  );

-- 4. Thông báo xếp học bù: buổi không gắn lớp → "buổi học bù riêng"
create or replace function public.notify_makeup_scheduled()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  sess record;
  sname text;
begin
  if new.status = 'scheduled' and new.makeup_session_id is not null
     and (tg_op = 'INSERT'
          or old.makeup_session_id is distinct from new.makeup_session_id
          or old.status is distinct from new.status) then
    select s.date, s.start_time, c.name as class_name into sess
    from sessions s
    left join classes c on c.id = s.class_id
    where s.id = new.makeup_session_id;

    select name into sname from profiles where id = new.student_id;

    insert into notifications (recipient_id, type, title, body, link)
    select r.recipient_id, 'makeup_scheduled', r.title,
           'Buổi ' || to_char(sess.date, 'DD/MM/YYYY') || ' lúc '
             || to_char(sess.start_time, 'HH24:MI')
             || ' · ' || coalesce('lớp ' || sess.class_name, 'buổi học bù riêng tại trung tâm'),
           r.link
    from (
      select new.student_id as recipient_id,
             'Bạn được xếp lịch học bù'::text as title,
             '/student'::text as link
      union all
      select ps.parent_id,
             sname || ' được xếp lịch học bù',
             '/parent'
      from parent_students ps
      where ps.student_id = new.student_id
    ) r;
  end if;
  return new;
end;
$$;
