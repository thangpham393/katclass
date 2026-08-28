-- =====================================================================
-- HỌC VIÊN TỰ BÁO NGHỈ & CHỌN CA HỌC BÙ + GIÁO VIÊN XEM CÔNG CỦA MÌNH
-- Chạy SAU 0028_lesson_decks.sql.
--
-- 1. `student_absence_requests`: học viên (hoặc phụ huynh) báo trước sẽ
--    nghỉ một buổi sắp tới, kèm ca học bù mong muốn. Hành chính duyệt ở
--    /admin/makeup → trigger tự điểm danh 'absent_excused' cho buổi đó,
--    và trigger cũ `handle_excused_absence` sinh quyền học bù như thường.
--    Không cho học viên tự ghi thẳng vào attendance/makeup_credits —
--    mọi thứ vẫn phải qua tay hành chính, đây chỉ là cái đơn.
--
-- 2. `makeup_credits.preferred_session_id`: ca bù học viên MONG MUỐN.
--    Khác `makeup_session_id` (ca đã xếp thật, chỉ hành chính ghi được).
--    Học viên ghi qua hàm `propose_makeup_slot()` chứ không mở policy
--    update cả bảng — tránh việc tự đổi trạng thái lượt bù của mình.
--
-- 3. Giáo viên đọc được mức lương CỦA CHÍNH MÌNH (0019 trước đây chỉ
--    hành chính đọc) để trang "Chấm công của tôi" hiện được tiền công.
--    Vẫn không ai xem được lương của người khác.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Đơn xin nghỉ của học viên
-- ---------------------------------------------------------------------
create table public.student_absence_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  reason text,
  -- Ca học bù học viên tự chọn khi gửi đơn (gợi ý cho hành chính, không bắt buộc)
  preferred_session_id uuid references public.sessions (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

create index student_absence_requests_status_idx
  on public.student_absence_requests (status, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Ca bù mong muốn trên chính lượt học bù
-- ---------------------------------------------------------------------
alter table public.makeup_credits
  add column preferred_session_id uuid references public.sessions (id) on delete set null;

/**
 * Học viên đề xuất ca học bù cho lượt bù ĐANG CHỜ của chính mình.
 * Security definer + tự kiểm tra chủ sở hữu nên không cần mở policy
 * update `makeup_credits` cho học viên (mở là họ tự chuyển được trạng
 * thái lượt bù). Phụ huynh đề xuất hộ con cũng được.
 */
create or replace function public.propose_makeup_slot(credit uuid, sess uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  v_owner uuid;
  v_status text;
  v_date date;
begin
  select student_id, status into v_owner, v_status
  from makeup_credits where id = credit;

  if v_owner is null then
    raise exception 'Không tìm thấy lượt học bù.';
  end if;
  if not (v_owner = public.my_profile_id() or public.is_my_student(v_owner)) then
    raise exception 'Chỉ chọn ca bù cho lượt học bù của mình.';
  end if;
  if v_status <> 'pending' then
    raise exception 'Lượt học bù này đã được xếp lịch, liên hệ trung tâm nếu cần đổi.';
  end if;

  if sess is not null then
    select date into v_date from sessions
    where id = sess and status = 'scheduled';
    if v_date is null or v_date < current_date then
      raise exception 'Buổi học này không còn nhận đăng ký bù.';
    end if;
  end if;

  update makeup_credits set preferred_session_id = sess where id = credit;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Duyệt đơn → điểm danh 'absent_excused' → tự sinh quyền học bù
-- ---------------------------------------------------------------------
create or replace function public.handle_absence_request_resolved()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    -- Ghi vắng có phép cho buổi xin nghỉ. Trigger `handle_excused_absence`
    -- (0002) sẽ tự tạo lượt học bù cho học viên.
    insert into attendance (session_id, student_id, status, note, marked_by)
    values (
      new.session_id, new.student_id, 'absent_excused',
      nullif(trim(coalesce(new.reason, '')), ''), new.resolved_by
    )
    on conflict (session_id, student_id) do update
      set status = 'absent_excused', marked_by = excluded.marked_by;

    -- Chuyển ca bù mong muốn sang lượt học bù vừa sinh, để hành chính
    -- thấy ngay học viên muốn học bù vào buổi nào.
    if new.preferred_session_id is not null then
      update makeup_credits
         set preferred_session_id = new.preferred_session_id
       where student_id = new.student_id
         and missed_session_id = new.session_id
         and status = 'pending';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_absence_request_resolved
  after update of status on public.student_absence_requests
  for each row execute function public.handle_absence_request_resolved();

-- ---------------------------------------------------------------------
-- 4. Thông báo: HV gửi đơn → báo hành chính; chốt đơn → báo HV + PH
-- ---------------------------------------------------------------------
create or replace function public.notify_absence_request_events()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_sess record;
  v_student text;
  v_label text;
begin
  select s.date, s.start_time, c.name as class_name into v_sess
  from sessions s
  left join classes c on c.id = s.class_id
  where s.id = new.session_id;

  v_label := 'Buổi ' || to_char(v_sess.date, 'DD/MM/YYYY') || ' lúc '
    || to_char(v_sess.start_time, 'HH24:MI')
    || ' · lớp ' || coalesce(v_sess.class_name, '?');

  select name into v_student from profiles where id = new.student_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (recipient_id, type, title, body, link)
    select p.id, 'request_new',
           'Học viên xin nghỉ: ' || coalesce(v_student, '?'),
           v_label || coalesce(' — ' || nullif(trim(new.reason), ''), ''),
           '/admin/makeup'
    from profiles p
    where p.role in ('admin', 'staff');
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending'
     and new.status in ('approved', 'rejected') then
    insert into notifications (recipient_id, type, title, body, link)
    select r.pid, 'request_resolved',
           case when new.status = 'approved'
             then 'Đơn xin nghỉ đã được duyệt'
             else 'Đơn xin nghỉ không được duyệt' end,
           v_label || coalesce(' — ' || nullif(trim(new.resolution_note), ''), '')
             || case when new.status = 'approved'
                  then ' · Trung tâm sẽ xếp buổi học bù cho bạn.' else '' end,
           r.link
    from (
      select new.student_id as pid, '/student/makeup'::text as link
      union all
      select ps.parent_id, '/parent'
      from parent_students ps
      where ps.student_id = new.student_id
    ) r;
  end if;

  return new;
end;
$$;

create trigger on_absence_request_notify
  after insert or update on public.student_absence_requests
  for each row execute function public.notify_absence_request_events();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.student_absence_requests enable row level security;

-- Xem: đơn của mình, đơn của con, hành chính xem hết
create policy "read own absence requests" on public.student_absence_requests
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('makeup.manage')
  );

-- Gửi đơn: chỉ cho buổi của lớp mình đang học và buổi chưa diễn ra
create policy "students create absence requests" on public.student_absence_requests
  for insert with check (
    (student_id = public.my_profile_id() or public.is_my_student(student_id))
    and status = 'pending'
    and exists (
      select 1
      from sessions s
      join class_students cs on cs.class_id = s.class_id
      where s.id = student_absence_requests.session_id
        and s.status = 'scheduled'
        and s.date >= current_date
        and cs.student_id = student_absence_requests.student_id
        and cs.status = 'active'
    )
  );

-- Rút đơn khi còn chờ duyệt (không sửa được thành approved)
create policy "students cancel own absence requests" on public.student_absence_requests
  for update using (
    (student_id = public.my_profile_id() or public.is_my_student(student_id))
    and status = 'pending'
  )
  with check (
    (student_id = public.my_profile_id() or public.is_my_student(student_id))
    and status in ('pending', 'cancelled')
  );

-- Hành chính duyệt đơn — dùng đúng ô tích "Học bù" của bảng phân quyền (0027)
create policy "staff manage absence requests" on public.student_absence_requests
  for all using (public.has_perm('makeup.manage'))
  with check (public.has_perm('makeup.manage'));

-- ---------------------------------------------------------------------
-- 6. Giáo viên xem mức lương của chính mình (0019 mở thêm)
-- ---------------------------------------------------------------------
create policy "teachers read own pay profile" on public.teacher_pay_profiles
  for select using (teacher_id = public.my_profile_id());

create policy "teachers read own pay tiers" on public.teacher_pay_tiers
  for select using (teacher_id = public.my_profile_id());

-- ---------------------------------------------------------------------
-- 7. Danh sách ca học bù học viên được phép chọn
-- ---------------------------------------------------------------------
/**
 * Học viên chỉ "thấy" được buổi của lớp mình (policy view sessions), nên
 * muốn chọn ca bù thì phải có cửa sổ riêng: hàm security definer này trả
 * về các buổi SẮP TỚI cùng chi nhánh, kèm đúng những cột cần cho việc
 * chọn ca (không lộ ghi chú nội bộ, danh sách học viên...).
 *
 * `sid` phải là chính mình / con mình, nếu không hàm trả về rỗng.
 */
create or replace function public.available_makeup_sessions(sid uuid, days int default 30)
returns table (
  id uuid,
  date date,
  start_time time,
  end_time time,
  class_name text,
  course_name text,
  level text,
  teacher_name text,
  room_name text,
  class_size int
)
security definer
set search_path = public
language sql
stable
as $$
  select s.id, s.date, s.start_time, s.end_time,
         coalesce(c.name, 'Buổi học bù riêng') as class_name,
         co.name as course_name,
         co.level,
         t.name as teacher_name,
         r.name as room_name,
         (select count(*)::int from class_students cs
           where cs.class_id = s.class_id and cs.status = 'active') as class_size
  from sessions s
  left join classes c on c.id = s.class_id
  left join courses co on co.id = c.course_id
  left join profiles t on t.id = coalesce(s.teacher_id, c.teacher_id)
  left join rooms r on r.id = s.room_id
  where (sid = public.my_profile_id()
         or public.is_my_student(sid)
         or public.has_perm('makeup.manage'))
    and s.status = 'scheduled'
    and s.date >= current_date
    and s.date <= current_date + coalesce(days, 30)
    and (c.id is null or c.status in ('active', 'planned'))
    and s.branch_id is not distinct from (select p.branch_id from profiles p where p.id = sid)
  order by s.date, s.start_time
  limit 200;
$$;
