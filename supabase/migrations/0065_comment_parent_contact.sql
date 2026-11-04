-- 0065 — NHẬN XÉT BUỔI → NHỜ CSKH LIÊN HỆ PHỤ HUYNH
-- Chạy SAU 0064_teaching_log_progress.sql.
--
-- Khi viết nhận xét buổi cho một học viên, GV tích "Cần CSKH liên hệ phụ
-- huynh" và ghi nội dung cần trao đổi. Hệ thống mở một phiếu chăm sóc
-- (care_requests, nguồn 'teacher') gắn với đúng buổi + học viên đó:
--   * trang /admin/care nhận phiếu như mọi phiếu khác;
--   * bảng điều khiển gắn cờ "Cần liên hệ PH" ở mục Học viên cần chú ý
--     khi phiếu còn mở.
-- Sửa lại nhận xét = cập nhật nội dung phiếu (khi CSKH chưa nhận xử lý);
-- bỏ tích = huỷ phiếu nếu còn "Mới".

alter table public.care_requests
  add column if not exists session_id uuid references public.sessions (id) on delete set null;

create unique index if not exists care_requests_session_student_key
  on public.care_requests (session_id, student_id) where session_id is not null;

-- GV không có quyền update care_requests (0061) nên ghi qua RPC.
-- p_note rỗng = bỏ tích.
create or replace function public.flag_parent_contact(
  p_session uuid,
  p_student uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
  v_req public.care_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not (public.is_staff() or public.has_perm('students.manage') or public.teaches_session(p_session)) then
    raise exception 'Không có quyền với buổi học này' using errcode = '42501';
  end if;

  select class_id into v_class from public.sessions where id = p_session;
  select * into v_req from public.care_requests
   where session_id = p_session and student_id = p_student;

  if v_note is null then
    if v_req.id is not null and v_req.status = 'new' then
      update public.care_requests set status = 'cancelled' where id = v_req.id;
    end if;
    return;
  end if;

  if v_req.id is null then
    insert into public.care_requests
      (student_id, class_id, session_id, source, issue, due_date, created_by)
    values
      (p_student, v_class, p_session, 'teacher', v_note, current_date + 1, public.my_profile_id());
  elsif v_req.status in ('new', 'cancelled') then
    -- Tích lại sau khi đã bỏ tích → mở lại phiếu
    update public.care_requests
       set issue = v_note, status = 'new', due_date = greatest(coalesce(due_date, current_date + 1), current_date)
     where id = v_req.id;
  else
    -- CSKH đã nhận / đã xong: giữ nguyên trạng thái, chỉ cập nhật nội dung
    update public.care_requests set issue = v_note where id = v_req.id;
  end if;
end;
$$;

grant execute on function public.flag_parent_contact(uuid, uuid, text) to authenticated;
