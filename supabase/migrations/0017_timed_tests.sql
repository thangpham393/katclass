-- =====================================================================
-- GIAI ĐOẠN 2 (phần 3): BÀI KIỂM TRA ĐỊNH KỲ CÓ GIỚI HẠN THỜI GIAN.
-- Chạy SAU 0016_standalone_makeup.sql.
--
-- Dùng lại hạ tầng homeworks/questions/submissions, thêm:
--   - homeworks.kind = 'homework' (bài tập, như cũ) | 'test' (kiểm tra)
--   - Kiểm tra có time_limit_minutes (bắt buộc), open_at (giờ mở đề,
--     null = mở ngay), due_at dùng làm HẠN CHÓT vào làm.
--   - Bảng test_attempts: giờ bắt đầu làm của từng học viên — do RPC
--     start_test ghi (server giữ giờ, client chỉ hiển thị đếm ngược).
--   - submit_homework siết với kind='test': phải bắt đầu trước khi nộp,
--     CHỈ NỘP 1 LẦN (không làm lại), quá giờ (start + limit + 60s ân
--     hạn cho mạng chậm) thì từ chối.
--   - Chống lộ đề: RLS homework_questions — với bài kind='test', học
--     viên chỉ đọc được câu hỏi SAU khi đã bấm bắt đầu (có attempt).
--     Đáp án vẫn ở question_answers, HV không bao giờ đọc được.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột mới trên homeworks
-- ---------------------------------------------------------------------
alter table public.homeworks
  add column kind text not null default 'homework'
    check (kind in ('homework', 'test')),
  add column time_limit_minutes int check (time_limit_minutes > 0),
  add column open_at timestamptz,
  add constraint test_needs_time_limit
    check (kind <> 'test' or time_limit_minutes is not null);

-- ---------------------------------------------------------------------
-- 2. Lượt làm bài kiểm tra (giờ bắt đầu do server ghi)
-- ---------------------------------------------------------------------
create table public.test_attempts (
  homework_id uuid not null references public.homeworks (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (homework_id, student_id)
);

alter table public.test_attempts enable row level security;

-- HV xem lượt của mình, PH xem của con, GV lớp + staff xem hết
create policy "view test attempts" on public.test_attempts
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.is_staff()
    or exists (
      select 1 from public.homeworks h
      join public.classes c on c.id = h.class_id
      where h.id = homework_id and c.teacher_id = public.my_profile_id()
    )
  );
-- Không có policy insert/update/delete cho user thường:
-- ghi attempt CHỈ qua RPC start_test (security definer).
create policy "staff manage test attempts" on public.test_attempts
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- 3. RPC bắt đầu làm bài kiểm tra
--    Gọi lần 2 (vd. rớt mạng, mở lại trang) trả về lượt cũ —
--    giờ bắt đầu KHÔNG reset.
-- ---------------------------------------------------------------------
create or replace function public.start_test(hw_id uuid)
returns public.test_attempts
security definer
set search_path = public
language plpgsql
as $$
declare
  sid uuid := public.my_profile_id();
  hw record;
  attempt public.test_attempts;
begin
  if sid is null then
    raise exception 'Không tìm thấy hồ sơ học viên';
  end if;

  select h.* into hw from homeworks h where h.id = hw_id;
  if hw.id is null or hw.kind <> 'test' then
    raise exception 'Bài này không phải bài kiểm tra';
  end if;

  if not exists (
    select 1 from class_students cs
    where cs.class_id = hw.class_id and cs.student_id = sid and cs.status = 'active'
  ) then
    raise exception 'Bạn không thuộc lớp được giao bài kiểm tra này';
  end if;

  if hw.open_at is not null and now() < hw.open_at then
    raise exception 'Bài kiểm tra chưa mở đề (mở lúc %)',
      to_char(hw.open_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY');
  end if;

  if hw.due_at is not null and now() > hw.due_at then
    raise exception 'Đã quá hạn vào làm bài kiểm tra này';
  end if;

  if exists (
    select 1 from submissions s
    where s.homework_id = hw_id and s.student_id = sid
  ) then
    raise exception 'Bạn đã nộp bài kiểm tra này rồi — không làm lại được';
  end if;

  insert into test_attempts (homework_id, student_id)
  values (hw_id, sid)
  on conflict (homework_id, student_id) do nothing;

  select * into attempt
  from test_attempts
  where homework_id = hw_id and student_id = sid;

  return attempt;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. submit_homework: siết luật cho bài kiểm tra
-- ---------------------------------------------------------------------
create or replace function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer
set search_path = public
language plpgsql
as $$
declare
  sid uuid := public.my_profile_id();
  hw record;
  att public.test_attempts;
  total int;
  correct int;
  result public.submissions;
begin
  if sid is null then
    raise exception 'Không tìm thấy hồ sơ học viên';
  end if;

  select h.* into hw from homeworks h where h.id = hw_id;

  if not exists (
    select 1
    from public.class_students cs
    where cs.class_id = hw.class_id and cs.student_id = sid
  ) then
    raise exception 'Bạn không có quyền nộp bài tập này';
  end if;

  -- Luật riêng cho bài kiểm tra có giờ
  if hw.kind = 'test' then
    select * into att
    from test_attempts
    where homework_id = hw_id and student_id = sid;

    if att.homework_id is null then
      raise exception 'Bạn chưa bắt đầu làm bài kiểm tra này';
    end if;

    if exists (
      select 1 from submissions s
      where s.homework_id = hw_id and s.student_id = sid
    ) then
      raise exception 'Bài kiểm tra chỉ được nộp một lần';
    end if;

    -- 60 giây ân hạn cho mạng chậm / auto-submit lúc hết giờ
    if now() > att.started_at + make_interval(mins => hw.time_limit_minutes) + interval '60 seconds' then
      raise exception 'Đã hết giờ làm bài — bài nộp không được ghi nhận';
    end if;
  end if;

  select count(*),
         count(*) filter (where qa.answer = my_answers -> hq.question_id::text)
    into total, correct
  from public.homework_questions hq
  join public.question_answers qa on qa.question_id = hq.question_id
  where hq.homework_id = hw_id;

  insert into public.submissions (homework_id, student_id, answers, auto_score, score, status)
  values (
    hw_id,
    sid,
    my_answers,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    case when total > 0 then round(correct::numeric * 10 / total, 1) else null end,
    'graded'
  )
  on conflict (homework_id, student_id) do update
    set answers = excluded.answers,
        auto_score = excluded.auto_score,
        score = excluded.score,
        submitted_at = now()
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Chống lộ đề: HV chỉ đọc câu hỏi bài kiểm tra SAU khi bắt đầu làm
-- ---------------------------------------------------------------------
drop policy "view homework questions" on public.homework_questions;
create policy "view homework questions" on public.homework_questions
  for select using (
    exists (
      select 1 from public.homeworks h
      where h.id = homework_id
        and public.can_view_class(h.class_id)
        and (
          h.kind = 'homework'
          or public.is_staff()
          or h.created_by = public.my_profile_id()
          or exists (select 1 from public.classes c
                     where c.id = h.class_id
                       and c.teacher_id = public.my_profile_id())
          or exists (select 1 from public.test_attempts ta
                     where ta.homework_id = h.id
                       and ta.student_id = public.my_profile_id())
        )
    )
  );

-- ---------------------------------------------------------------------
-- 6. Thông báo: bài kiểm tra mới có tiêu đề/nội dung riêng
-- ---------------------------------------------------------------------
create or replace function public.notify_homework_new()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into notifications (recipient_id, type, title, body, link)
  select cs.student_id, 'homework_new',
         case when new.kind = 'test'
           then 'Bài kiểm tra mới: ' || new.title
           else 'Bài tập mới: ' || new.title end,
         'Lớp ' || c.name
           || case when new.kind = 'test'
                then ' · thời gian làm ' || new.time_limit_minutes || ' phút' else '' end
           || case when new.kind = 'test' and new.open_at is not null
                then ' · mở đề ' || to_char(new.open_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY')
                else '' end
           || case when new.due_at is not null
                then ' · hạn ' || to_char(new.due_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY')
                else '' end,
         '/student/homework/' || new.id
  from class_students cs
  join classes c on c.id = new.class_id
  where cs.class_id = new.class_id and cs.status = 'active';
  return new;
end;
$$;
