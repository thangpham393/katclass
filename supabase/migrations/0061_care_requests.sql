-- =====================================================================
-- 0061: PHIẾU CHĂM SÓC HỌC VIÊN (YC0001, YC0002...).
-- Chạy SAU 0060_multi_branch_profiles.sql.
--
-- Trước đây "chăm sóc" chỉ là danh sách tính tại chỗ từ điểm danh (vắng
-- liên tiếp) + nhật ký liên hệ — không có ai nhận việc, không có hạn, giáo
-- viên muốn nhờ CSKH gọi phụ huynh thì phải nhắn ngoài.
--
-- 1. care_requests: mỗi phiếu = một việc cần làm với một học viên. Có mã
--    số tăng dần (hiển thị YC0001), nguồn phát sinh, người xử lý, hạn,
--    trạng thái Mới → Đang xử lý → Đã xong / Huỷ.
-- 2. Tự sinh phiếu nguồn "Điểm danh" khi học viên vắng từ 2 buổi liên tiếp
--    (trigger trên attendance). Buổi lớp nghỉ không tính.
-- 3. Ghi một lần liên hệ (student_contacts) → phiếu đang mở của em đó tự
--    chuyển Đang xử lý (người gọi thành người xử lý nếu chưa ai nhận);
--    kết quả "Đã xử lý xong" thì đóng phiếu.
-- 4. Giáo viên tạo được phiếu cho học viên mình dạy (nhờ CSKH), đọc được
--    phiếu của học viên mình dạy; sửa/đóng phiếu cần quyền students.manage.
-- =====================================================================

create sequence if not exists public.care_request_no_seq;

create table if not exists public.care_requests (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('public.care_request_no_seq'),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  branch_id uuid references public.branches (id),
  source text not null default 'other'
    check (source in ('attendance', 'test', 'homework', 'tuition', 'teacher', 'other')),
  issue text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'cancelled')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  note text,
  created_by uuid references public.profiles (id) on delete set null
    default public.my_profile_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter sequence public.care_request_no_seq owned by public.care_requests.no;

comment on table public.care_requests is
  'Phiếu chăm sóc học viên: vấn đề, người xử lý, hạn, trạng thái (mã hiển thị YC + no)';
comment on column public.care_requests.source is
  'attendance = tự sinh từ vắng liên tiếp; test/homework/tuition/teacher/other = tạo tay';

create index if not exists care_requests_open_idx
  on public.care_requests (status, due_date) where status in ('new', 'in_progress');
create index if not exists care_requests_student_idx on public.care_requests (student_id, created_at desc);
create index if not exists care_requests_branch_idx on public.care_requests (branch_id);

-- ---------------------------------------------------------------------
-- Chi nhánh lấy theo học viên; mốc đóng phiếu tự ghi khi đổi trạng thái
-- ---------------------------------------------------------------------
create or replace function public.care_request_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.branch_id is null then
      select branch_id into new.branch_id from public.profiles where id = new.student_id;
    end if;
  end if;
  if new.status in ('done', 'cancelled') then
    if tg_op = 'INSERT' or old.status not in ('done', 'cancelled') then
      new.resolved_at := coalesce(new.resolved_at, now());
    end if;
  else
    new.resolved_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists care_request_before_write on public.care_requests;
create trigger care_request_before_write
  before insert or update on public.care_requests
  for each row execute function public.care_request_before_write();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.care_requests enable row level security;

drop policy if exists "read care requests" on public.care_requests;
create policy "read care requests" on public.care_requests
  for select using (
    public.is_staff()
    or public.has_perm('students.manage')
    or created_by = public.my_profile_id()
    or assignee_id = public.my_profile_id()
    or (public.my_role() = 'teacher' and public.teaches_student(student_id))
  );

drop policy if exists "create care requests" on public.care_requests;
create policy "create care requests" on public.care_requests
  for insert with check (
    public.has_perm('students.manage')
    or (
      public.my_role() = 'teacher'
      and public.teaches_student(student_id)
      and created_by = public.my_profile_id()
      and status = 'new'
    )
  );

drop policy if exists "manage care requests" on public.care_requests;
create policy "manage care requests" on public.care_requests
  for update using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "delete care requests" on public.care_requests;
create policy "delete care requests" on public.care_requests
  for delete using (public.has_perm('students.manage'));

-- ---------------------------------------------------------------------
-- Tự sinh / cập nhật phiếu "Điểm danh" cho một học viên.
-- Đếm chuỗi vắng tính từ buổi gần nhất (bỏ buổi lớp nghỉ). Từ 2 buổi:
--   - đang có phiếu điểm danh mở do hệ thống tạo, còn "Mới" → cập nhật
--     lại số buổi + hạn;
--   - đã có phiếu điểm danh đóng SAU buổi vắng gần nhất → thôi (đã xử lý);
--   - còn lại → mở phiếu mới, hạn 2 ngày sau buổi vắng gần nhất.
-- ---------------------------------------------------------------------
create or replace function public.refresh_absence_care(p_student uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_streak int := 0;
  v_unexc int := 0;
  v_last date;
  v_class uuid;
  v_issue text;
  v_open uuid;
begin
  if exists (select 1 from public.profiles where id = p_student and study_status = 'left') then
    return;
  end if;

  for r in
    select a.status, s.date, s.class_id
      from public.attendance a
      join public.sessions s on s.id = a.session_id
     where a.student_id = p_student
       and s.status <> 'cancelled'
     order by s.date desc, s.start_time desc
     limit 60
  loop
    exit when r.status not in ('absent_excused', 'absent_unexcused');
    v_streak := v_streak + 1;
    if r.status = 'absent_unexcused' then v_unexc := v_unexc + 1; end if;
    if v_last is null then v_last := r.date; end if;
    v_class := coalesce(v_class, r.class_id);
  end loop;

  if v_streak < 2 then
    return;
  end if;

  v_issue := format(
    'Vắng %s buổi liên tiếp%s.',
    v_streak,
    case when v_unexc > 0 then format(' (%s buổi không phép)', v_unexc) else '' end
  );

  select id into v_open
    from public.care_requests
   where student_id = p_student and source = 'attendance' and status in ('new', 'in_progress')
   order by created_at desc
   limit 1;

  if v_open is not null then
    update public.care_requests
       set issue = v_issue, due_date = v_last + 2
     where id = v_open and status = 'new' and created_by is null;
    return;
  end if;

  if exists (
    select 1 from public.care_requests
     where student_id = p_student and source = 'attendance'
       and status in ('done', 'cancelled') and resolved_at::date >= v_last
  ) then
    return;
  end if;

  insert into public.care_requests (student_id, class_id, source, issue, due_date, created_by)
  values (p_student, v_class, 'attendance', v_issue, v_last + 2, null);
end;
$$;

revoke all on function public.refresh_absence_care(uuid) from public;

create or replace function public.attendance_care_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('absent_excused', 'absent_unexcused') then
    perform public.refresh_absence_care(new.student_id);
  end if;
  return null;
end;
$$;

drop trigger if exists attendance_care on public.attendance;
create trigger attendance_care
  after insert or update of status on public.attendance
  for each row execute function public.attendance_care_trigger();

-- ---------------------------------------------------------------------
-- Ghi liên hệ → đẩy trạng thái phiếu đang mở của học viên
-- ---------------------------------------------------------------------
create or replace function public.contact_updates_care()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.care_requests
     set assignee_id = coalesce(assignee_id, new.contacted_by),
         status = case when new.outcome = 'handled' then 'done' else 'in_progress' end,
         note = coalesce(nullif(trim(new.note), ''), note)
   where student_id = new.student_id
     and status in ('new', 'in_progress');
  return null;
end;
$$;

drop trigger if exists contact_updates_care on public.student_contacts;
create trigger contact_updates_care
  after insert on public.student_contacts
  for each row execute function public.contact_updates_care();

-- ---------------------------------------------------------------------
-- Sinh phiếu cho các chuỗi vắng hiện có (vắng gần nhất trong 30 ngày),
-- rồi áp lần liên hệ đã ghi sau buổi vắng đó.
-- ---------------------------------------------------------------------
do $$
declare
  v_sid uuid;
  v_req record;
  v_c record;
begin
  for v_sid in
    select distinct a.student_id
      from public.attendance a
      join public.sessions s on s.id = a.session_id
     where s.date >= current_date - 30
       and a.status in ('absent_excused', 'absent_unexcused')
  loop
    perform public.refresh_absence_care(v_sid);
  end loop;

  for v_req in
    select id, student_id, due_date from public.care_requests
     where source = 'attendance' and status = 'new' and created_by is null
  loop
    select contacted_by, outcome, note, contacted_at into v_c
      from public.student_contacts
     where student_id = v_req.student_id
       and contacted_at::date >= v_req.due_date - 2
     order by contacted_at desc
     limit 1;
    if found then
      update public.care_requests
         set assignee_id = v_c.contacted_by,
             status = case when v_c.outcome = 'handled' then 'done' else 'in_progress' end,
             note = v_c.note,
             resolved_at = case when v_c.outcome = 'handled' then v_c.contacted_at end
       where id = v_req.id;
    end if;
  end loop;
end;
$$;
