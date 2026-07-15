-- =====================================================================
-- GIAI ĐOẠN 1 (phần nội dung): thư viện từ vựng, bài học, ngân hàng
-- câu hỏi, bài tập về nhà tự chấm.
-- Chạy SAU 0002_core.sql.
--
-- Chống lộ đáp án: đáp án tách riêng bảng question_answers (chỉ
-- giáo viên/staff đọc được); học viên nộp bài qua RPC submit_homework
-- chấm điểm phía server nên đáp án không bao giờ xuống trình duyệt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Thư viện từ vựng (dùng chung toàn trung tâm)
-- ---------------------------------------------------------------------
create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  hanzi text not null,
  pinyin text not null,
  meaning text not null,
  example jsonb,   -- { "zh": ..., "pinyin": ..., "vi": ... }
  audio_url text,
  level text,
  tags text[] not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Bài học trong giáo trình (gắn với khóa học)
-- ---------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  unit int,
  title text not null,
  title_zh text,
  summary text,
  grammar text,          -- kiến thức ngữ pháp, markdown
  slide_embed_url text,  -- link nhúng slide (Canva/Google Slides) hoặc file Storage
  sort int not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.lesson_vocab (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  vocab_id uuid not null references public.vocab_items (id) on delete cascade,
  sort int not null default 0,
  primary key (lesson_id, vocab_id)
);

-- Gán nội dung ôn tập cho từng buổi học (GV set sau mỗi buổi)
create table public.session_lessons (
  session_id uuid not null references public.sessions (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  primary key (session_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- 3. Ngân hàng câu hỏi (đề bài) + đáp án (tách riêng, bảo mật)
-- ---------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'multiple_choice', -- trắc nghiệm
    'fill_blank',      -- điền từ
    'matching',        -- nối từ - nghĩa
    'reorder',         -- sắp xếp từ thành câu
    'listening',       -- nghe audio chọn đáp án
    'pinyin_choice'    -- chọn pinyin đúng cho chữ Hán
  )),
  content jsonb not null, -- đề bài + lựa chọn, KHÔNG chứa đáp án
  level text,
  tags text[] not null default '{}',
  lesson_id uuid references public.lessons (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.question_answers (
  question_id uuid primary key references public.questions (id) on delete cascade,
  answer jsonb not null -- dạng chuẩn hóa, so sánh bằng jsonb equality khi chấm
);

-- ---------------------------------------------------------------------
-- 4. Bài tập về nhà & bài nộp
-- ---------------------------------------------------------------------
create table public.homeworks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  title text not null,
  due_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.homework_questions (
  homework_id uuid not null references public.homeworks (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  sort int not null default 0,
  primary key (homework_id, question_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homeworks (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}', -- { "<question_id>": <câu trả lời> }
  auto_score numeric,  -- điểm hệ thống tự chấm (thang 10)
  score numeric,       -- điểm chốt (sau khi GV chấm tay nếu có)
  status text not null default 'submitted'
    check (status in ('submitted', 'graded')),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  graded_by uuid references public.profiles (id),
  unique (homework_id, student_id)
);

-- ---------------------------------------------------------------------
-- 5. RPC nộp bài + tự chấm phía server (đáp án không lộ ra client)
-- ---------------------------------------------------------------------
create function public.submit_homework(hw_id uuid, my_answers jsonb)
returns public.submissions
security definer
set search_path = public
language plpgsql
as $$
declare
  total int;
  correct int;
  result public.submissions;
begin
  -- Chỉ học viên trong lớp của bài tập này mới được nộp
  if not exists (
    select 1
    from public.homeworks h
    join public.class_students cs on cs.class_id = h.class_id
    where h.id = hw_id and cs.student_id = auth.uid()
  ) then
    raise exception 'Bạn không có quyền nộp bài tập này';
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
    auth.uid(),
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
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.vocab_items enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_vocab enable row level security;
alter table public.session_lessons enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.homeworks enable row level security;
alter table public.homework_questions enable row level security;
alter table public.submissions enable row level security;

-- Thư viện nội dung: ai đăng nhập cũng đọc; GV/staff/admin quản lý
create policy "read vocab" on public.vocab_items
  for select using (auth.uid() is not null);
create policy "teachers manage vocab" on public.vocab_items
  for all using (public.my_role() in ('teacher', 'staff', 'admin'))
  with check (public.my_role() in ('teacher', 'staff', 'admin'));

create policy "read lessons" on public.lessons
  for select using (auth.uid() is not null);
create policy "teachers manage lessons" on public.lessons
  for all using (public.my_role() in ('teacher', 'staff', 'admin'))
  with check (public.my_role() in ('teacher', 'staff', 'admin'));

create policy "read lesson vocab" on public.lesson_vocab
  for select using (auth.uid() is not null);
create policy "teachers manage lesson vocab" on public.lesson_vocab
  for all using (public.my_role() in ('teacher', 'staff', 'admin'))
  with check (public.my_role() in ('teacher', 'staff', 'admin'));

create policy "view session lessons" on public.session_lessons
  for select using (
    exists (select 1 from public.sessions s
            where s.id = session_id and public.can_view_class(s.class_id))
  );
create policy "teachers manage session lessons" on public.session_lessons
  for all using (public.is_staff() or public.teaches_session(session_id))
  with check (public.is_staff() or public.teaches_session(session_id));

-- Câu hỏi: đề bài đọc được (không chứa đáp án); đáp án chỉ GV/staff
create policy "read questions" on public.questions
  for select using (auth.uid() is not null);
create policy "teachers manage questions" on public.questions
  for all using (public.my_role() in ('teacher', 'staff', 'admin'))
  with check (public.my_role() in ('teacher', 'staff', 'admin'));

create policy "teachers read answers" on public.question_answers
  for select using (public.my_role() in ('teacher', 'staff', 'admin'));
create policy "teachers manage answers" on public.question_answers
  for all using (public.my_role() in ('teacher', 'staff', 'admin'))
  with check (public.my_role() in ('teacher', 'staff', 'admin'));

-- Bài tập: người trong lớp thấy; GV lớp hoặc staff giao bài
create policy "view homeworks" on public.homeworks
  for select using (public.can_view_class(class_id));
create policy "teachers assign homeworks" on public.homeworks
  for all using (
    public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = auth.uid())
  )
  with check (
    public.is_staff()
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy "view homework questions" on public.homework_questions
  for select using (
    exists (select 1 from public.homeworks h
            where h.id = homework_id and public.can_view_class(h.class_id))
  );
create policy "teachers manage homework questions" on public.homework_questions
  for all using (
    exists (select 1 from public.homeworks h
            join public.classes c on c.id = h.class_id
            where h.id = homework_id
              and (public.is_staff() or c.teacher_id = auth.uid()))
  );

-- Bài nộp: học viên xem của mình (nộp qua RPC), phụ huynh xem của con,
-- GV lớp xem + chấm tay
create policy "view submissions" on public.submissions
  for select using (
    student_id = auth.uid()
    or public.is_my_student(student_id)
    or public.is_staff()
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = auth.uid())
  );
create policy "teachers grade submissions" on public.submissions
  for update using (
    public.is_staff()
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = auth.uid())
  );
