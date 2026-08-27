-- =====================================================================
-- 0027: Phân quyền theo ô tích — quyền chuyển từ CODE sang DỮ LIỆU
--
-- Trước: quyền viết cứng trong policy (is_staff(), can_view_pay()...),
--        muốn đổi phải sửa SQL + chạy migration.
-- Sau:   bảng role_permissions là nguồn duy nhất; has_perm() đọc bảng đó
--        ngay trong policy, nên tích/bỏ tích ở màn Cài đặt đổi quyền
--        THẬT ở database chứ không chỉ ẩn menu.
--
-- Hai tầng, cố ý tách bạch:
--   • is_staff()  — "có được vào khu quản trị không" (staff/accountant/admin).
--     Khung sườn lớp / buổi học vẫn đọc chung qua can_view_class() vì
--     mọi module (thời khóa biểu, học phí, chấm công) đều cần.
--   • has_perm()  — "vào rồi thì làm & thấy được module nào".
--
-- Admin luôn có mọi quyền (không đọc bảng) để không thể tự khóa mình.
-- Seed dưới đây tái lập ĐÚNG quyền hiện hành → chạy xong không đổi hành vi.
-- =====================================================================

-- 1. Bảng quyền -------------------------------------------------------
create table if not exists public.role_permissions (
  role        text not null check (role in ('student','parent','teacher','staff','accountant','admin')),
  permission  text not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

-- Ai đăng nhập cũng đọc được (giao diện cần biết quyền của chính mình;
-- danh sách quyền không phải dữ liệu nhạy cảm). Chỉ admin sửa được.
drop policy if exists "read role permissions" on public.role_permissions;
create policy "read role permissions" on public.role_permissions
  for select using (auth.uid() is not null);

drop policy if exists "admin manage role permissions" on public.role_permissions;
create policy "admin manage role permissions" on public.role_permissions
  for all using (public.is_admin()) with check (public.is_admin());

-- 2. Hàm kiểm tra quyền ----------------------------------------------
-- security definer: policy của bảng khác gọi vào đây, không phụ thuộc
-- việc người gọi có đọc được role_permissions hay không.
create or replace function public.has_perm(p_key text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.my_role() = 'admin'
      or exists (
           select 1 from public.role_permissions rp
            where rp.role = public.my_role()
              and rp.permission = p_key
         );
$$;

-- 3. Seed = quyền đang có hôm nay ------------------------------------
insert into public.role_permissions (role, permission)
select r.role, p.permission
  from (values ('staff'), ('accountant')) as r(role),
       (values
         ('classes.manage'), ('courses.manage'), ('attendance.manage'),
         ('makeup.manage'), ('requests.manage'), ('students.manage'),
         ('team.manage'), ('library.manage'), ('textbooks.manage'),
         ('homework.manage'), ('classroom.teach'), ('tuition.manage'),
         ('reports.view'), ('settings.manage')
       ) as p(permission)
on conflict do nothing;

-- Kế toán: thêm quyền xem tiền (trước là can_view_pay())
insert into public.role_permissions (role, permission)
values ('accountant', 'payroll.view')
on conflict do nothing;

-- Giáo viên: soạn bài học / từ vựng / ngân hàng câu hỏi
-- (giáo trình vẫn là việc của quản trị, đúng như policy cũ)
insert into public.role_permissions (role, permission)
values ('teacher', 'library.manage')
on conflict do nothing;

-- 4. Lớp / khóa học / lịch --------------------------------------------
drop policy if exists "staff manage classes" on public.classes;
create policy "staff manage classes" on public.classes
  for all using (public.has_perm('classes.manage'))
  with check (public.has_perm('classes.manage'));

drop policy if exists "staff manage class schedules" on public.class_schedules;
create policy "staff manage class schedules" on public.class_schedules
  for all using (public.has_perm('classes.manage'))
  with check (public.has_perm('classes.manage'));

drop policy if exists "staff manage class members" on public.class_students;
create policy "staff manage class members" on public.class_students
  for all using (public.has_perm('classes.manage'))
  with check (public.has_perm('classes.manage'));

drop policy if exists "staff manage sessions" on public.sessions;
create policy "staff manage sessions" on public.sessions
  for all using (public.has_perm('classes.manage'))
  with check (public.has_perm('classes.manage'));

drop policy if exists "staff manage courses" on public.courses;
create policy "staff manage courses" on public.courses
  for all using (public.has_perm('courses.manage'))
  with check (public.has_perm('courses.manage'));

-- 5. Điểm danh (+ báo cáo chuyên cần đọc chính bảng này) ---------------
drop policy if exists "view attendance" on public.attendance;
create policy "view attendance" on public.attendance
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('attendance.manage')
    or public.has_perm('reports.view')
    or public.teaches_session(session_id)
  );

drop policy if exists "teachers and staff mark attendance" on public.attendance;
create policy "teachers and staff mark attendance" on public.attendance
  for insert with check (
    public.has_perm('attendance.manage') or public.teaches_session(session_id)
  );

drop policy if exists "teachers and staff update attendance" on public.attendance;
create policy "teachers and staff update attendance" on public.attendance
  for update using (
    public.has_perm('attendance.manage') or public.teaches_session(session_id)
  );

drop policy if exists "staff delete attendance" on public.attendance;
create policy "staff delete attendance" on public.attendance
  for delete using (public.has_perm('attendance.manage'));

-- 6. Học bù ------------------------------------------------------------
drop policy if exists "staff manage makeup credits" on public.makeup_credits;
create policy "staff manage makeup credits" on public.makeup_credits
  for all using (public.has_perm('makeup.manage'))
  with check (public.has_perm('makeup.manage'));

drop policy if exists "view makeup credits" on public.makeup_credits;
create policy "view makeup credits" on public.makeup_credits
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('makeup.manage')
    or (makeup_session_id is not null and public.teaches_session(makeup_session_id))
  );

-- 7. Nghỉ / đổi buổi ---------------------------------------------------
drop policy if exists "staff manage change requests" on public.session_change_requests;
create policy "staff manage change requests" on public.session_change_requests
  for all using (public.has_perm('requests.manage'))
  with check (public.has_perm('requests.manage'));

drop policy if exists "read own change requests" on public.session_change_requests;
create policy "read own change requests" on public.session_change_requests
  for select using (
    teacher_id = public.my_profile_id()
    or substitute_teacher_id = public.my_profile_id()
    or public.has_perm('requests.manage')
  );

-- 8. Hồ sơ người: học viên/phụ huynh vs giáo viên/nhân viên ------------
drop policy if exists "staff insert profiles" on public.profiles;
create policy "staff insert profiles" on public.profiles
  for insert with check (
    public.is_admin()
    or (public.has_perm('students.manage') and role in ('student', 'parent'))
    or (public.has_perm('team.manage') and role in ('teacher', 'staff'))
  );

drop policy if exists "staff update non-admin profiles" on public.profiles;
create policy "staff update non-admin profiles" on public.profiles
  for update using (
    public.is_admin()
    or (public.has_perm('students.manage') and role in ('student', 'parent'))
    or (public.has_perm('team.manage') and role in ('teacher', 'staff'))
  )
  with check (
    public.is_admin()
    or (public.has_perm('students.manage') and role in ('student', 'parent'))
    or (public.has_perm('team.manage') and role in ('teacher', 'staff'))
  );

drop policy if exists "staff manage family links" on public.parent_students;
create policy "staff manage family links" on public.parent_students
  for all using (public.has_perm('students.manage'))
  with check (public.has_perm('students.manage'));

drop policy if exists "read own family links" on public.parent_students;
create policy "read own family links" on public.parent_students
  for select using (
    parent_id = public.my_profile_id()
    or student_id = public.my_profile_id()
    or public.has_perm('students.manage')
  );

-- 9. Kho học liệu ------------------------------------------------------
drop policy if exists "teachers manage lessons" on public.lessons;
create policy "teachers manage lessons" on public.lessons
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

drop policy if exists "read lessons" on public.lessons;
create policy "read lessons" on public.lessons
  for select using (
    public.has_perm('library.manage')
    or public.is_staff()
    or public.can_view_lesson(id)
  );

drop policy if exists "teachers manage lesson vocab" on public.lesson_vocab;
create policy "teachers manage lesson vocab" on public.lesson_vocab
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

drop policy if exists "teachers manage vocab" on public.vocab_items;
create policy "teachers manage vocab" on public.vocab_items
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

drop policy if exists "teachers manage questions" on public.questions;
create policy "teachers manage questions" on public.questions
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

-- Đáp án: học viên không bao giờ được đọc
drop policy if exists "teachers manage answers" on public.question_answers;
create policy "teachers manage answers" on public.question_answers
  for all using (public.has_perm('library.manage'))
  with check (public.has_perm('library.manage'));

drop policy if exists "teachers read answers" on public.question_answers;
create policy "teachers read answers" on public.question_answers
  for select using (
    public.has_perm('library.manage') or public.has_perm('homework.manage')
  );

drop policy if exists "staff manage textbooks" on public.textbooks;
create policy "staff manage textbooks" on public.textbooks
  for all using (public.has_perm('textbooks.manage'))
  with check (public.has_perm('textbooks.manage'));

-- 10. Bài tập & bài kiểm tra -------------------------------------------
drop policy if exists "teachers assign homeworks" on public.homeworks;
create policy "teachers assign homeworks" on public.homeworks
  for all using (
    public.has_perm('homework.manage')
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = public.my_profile_id())
  )
  with check (
    public.has_perm('homework.manage')
    or exists (select 1 from public.classes c
               where c.id = class_id and c.teacher_id = public.my_profile_id())
  );

drop policy if exists "teachers manage homework questions" on public.homework_questions;
create policy "teachers manage homework questions" on public.homework_questions
  for all using (
    exists (select 1 from public.homeworks h
            join public.classes c on c.id = h.class_id
            where h.id = homework_id
              and (public.has_perm('homework.manage')
                   or c.teacher_id = public.my_profile_id()))
  );

drop policy if exists "view homework questions" on public.homework_questions;
create policy "view homework questions" on public.homework_questions
  for select using (
    exists (
      select 1 from public.homeworks h
      where h.id = homework_id
        and public.can_view_class(h.class_id)
        and (
          h.kind = 'homework'
          or public.has_perm('homework.manage')
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

drop policy if exists "teachers grade submissions" on public.submissions;
create policy "teachers grade submissions" on public.submissions
  for update using (
    public.has_perm('homework.manage')
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = public.my_profile_id())
  );

drop policy if exists "view submissions" on public.submissions;
create policy "view submissions" on public.submissions
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('homework.manage')
    or exists (select 1 from public.homeworks h
               join public.classes c on c.id = h.class_id
               where h.id = homework_id and c.teacher_id = public.my_profile_id())
  );

drop policy if exists "staff manage test attempts" on public.test_attempts;
create policy "staff manage test attempts" on public.test_attempts
  for all using (public.has_perm('homework.manage'))
  with check (public.has_perm('homework.manage'));

drop policy if exists "view test attempts" on public.test_attempts;
create policy "view test attempts" on public.test_attempts
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('homework.manage')
    or exists (
      select 1 from public.homeworks h
      join public.classes c on c.id = h.class_id
      where h.id = homework_id and c.teacher_id = public.my_profile_id()
    )
  );

-- 11. Lớp học trực tiếp: sao thưởng, hoạt động, nhận xét, chấm công ----
drop policy if exists "teachers give points" on public.class_points;
create policy "teachers give points" on public.class_points
  for insert with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "teachers edit points" on public.class_points;
create policy "teachers edit points" on public.class_points
  for update using (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  )
  with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "teachers delete points" on public.class_points;
create policy "teachers delete points" on public.class_points
  for delete using (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "view class points" on public.class_points;
create policy "view class points" on public.class_points
  for select using (
    public.has_perm('classroom.teach')
    or public.teaches_session(session_id)
    or student_id = public.my_profile_id()
    or public.is_my_student(student_id)
  );

drop policy if exists "teachers log activities" on public.session_activities;
create policy "teachers log activities" on public.session_activities
  for insert with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "teachers delete activities" on public.session_activities;
create policy "teachers delete activities" on public.session_activities
  for delete using (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "view session activities" on public.session_activities;
create policy "view session activities" on public.session_activities
  for select using (
    public.has_perm('classroom.teach')
    or public.teaches_session(session_id)
    or exists (select 1 from public.sessions s
               where s.id = session_id
                 and ((s.class_id is not null and public.can_view_class(s.class_id))
                      or exists (select 1 from public.makeup_credits mc
                                 where mc.makeup_session_id = s.id
                                   and (mc.student_id = public.my_profile_id()
                                        or public.is_my_student(mc.student_id)))))
  );

drop policy if exists "staff manage session comments" on public.session_comments;
create policy "staff manage session comments" on public.session_comments
  for all using (public.has_perm('classroom.teach'))
  with check (public.has_perm('classroom.teach'));

drop policy if exists "view session comments" on public.session_comments;
create policy "view session comments" on public.session_comments
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('classroom.teach')
    or teacher_id = public.my_profile_id()
  );

drop policy if exists "teachers manage session lessons" on public.session_lessons;
create policy "teachers manage session lessons" on public.session_lessons
  for all using (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  )
  with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

-- Chấm công ca dạy: bảng công & tiền lương cũng đọc bảng này
drop policy if exists "teachers log teaching" on public.teaching_logs;
create policy "teachers log teaching" on public.teaching_logs
  for insert with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "teachers update teaching log" on public.teaching_logs;
create policy "teachers update teaching log" on public.teaching_logs
  for update using (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  )
  with check (
    public.has_perm('classroom.teach') or public.teaches_session(session_id)
  );

drop policy if exists "staff delete teaching log" on public.teaching_logs;
create policy "staff delete teaching log" on public.teaching_logs
  for delete using (public.has_perm('classroom.teach'));

drop policy if exists "view teaching logs" on public.teaching_logs;
create policy "view teaching logs" on public.teaching_logs
  for select using (
    public.has_perm('classroom.teach')
    or public.has_perm('payroll.view')
    or public.teaches_session(session_id)
  );

-- 12. Học phí ----------------------------------------------------------
drop policy if exists "staff manage packages" on public.enrollment_packages;
create policy "staff manage packages" on public.enrollment_packages
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));

drop policy if exists "view own packages" on public.enrollment_packages;
create policy "view own packages" on public.enrollment_packages
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('tuition.manage')
  );

drop policy if exists "staff manage payments" on public.payments;
create policy "staff manage payments" on public.payments
  for all using (public.has_perm('tuition.manage'))
  with check (public.has_perm('tuition.manage'));

drop policy if exists "view own payments" on public.payments;
create policy "view own payments" on public.payments
  for select using (
    student_id = public.my_profile_id()
    or public.is_my_student(student_id)
    or public.has_perm('tuition.manage')
  );

-- 13. Lương giáo viên (thay can_view_pay) ------------------------------
drop policy if exists "accounting manage pay profiles" on public.teacher_pay_profiles;
create policy "accounting manage pay profiles" on public.teacher_pay_profiles
  for all using (public.has_perm('payroll.view'))
  with check (public.has_perm('payroll.view'));

drop policy if exists "accounting manage pay tiers" on public.teacher_pay_tiers;
create policy "accounting manage pay tiers" on public.teacher_pay_tiers
  for all using (public.has_perm('payroll.view'))
  with check (public.has_perm('payroll.view'));

-- can_view_pay() giữ lại cho code cũ, nay đọc từ bảng quyền
create or replace function public.can_view_pay()
returns boolean
language sql stable
as $$
  select public.has_perm('payroll.view');
$$;

-- 14. Cài đặt: chi nhánh & phòng học -----------------------------------
drop policy if exists "staff manage branches" on public.branches;
create policy "staff manage branches" on public.branches
  for all using (public.has_perm('settings.manage'))
  with check (public.has_perm('settings.manage'));

drop policy if exists "staff manage rooms" on public.rooms;
create policy "staff manage rooms" on public.rooms
  for all using (public.has_perm('settings.manage'))
  with check (public.has_perm('settings.manage'));

comment on table public.role_permissions is
  'Ma trận quyền theo vai trò — nguồn duy nhất cho has_perm(), sửa ở màn Cài đặt > Phân quyền. Admin luôn toàn quyền, không cần dòng nào ở đây.';
