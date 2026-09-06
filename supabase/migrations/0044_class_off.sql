-- =====================================================================
-- 0044: BÁO LỚP NGHỈ ngay ở chỗ check-in ca dạy.
-- Chạy SAU 0043_reviews.sql.
--
-- Trước 0044, buổi không dạy được chỉ có hai đường vòng: hành chính vào
-- Sửa lớp đổi status, rồi ai đó nhớ mà điểm danh tay "vắng có phép" cho
-- từng học viên — quên là học viên mất buổi mà không có quyền học bù.
--
-- Nay giáo viên (hoặc hành chính) bấm MỘT nút "Lớp nghỉ" ở màn chấm công:
--   • buổi chuyển 'cancelled' + ghi lý do (sessions.cancel_reason)
--   • TOÀN BỘ học viên đang học của lớp → điểm danh 'absent_excused'
--     → trigger 0002 sinh quyền học bù 'pending' = vào hàng "Chờ xếp bù"
--   • học viên đang được xếp bù VÀO buổi này thì trả quyền về 'pending'
--   • xoá công đã chấm (nếu lỡ chấm) — lớp nghỉ thì không tính công
--   • trigger 0015 tự báo cho học viên + phụ huynh
--
-- Giáo viên vẫn RẢNH ở khung giờ đó: constraint sessions_no_teacher_overlap
-- (0002) bỏ qua buổi 'cancelled', nên hành chính xếp GV này dạy thay lớp
-- khác cùng giờ vẫn được — cố ý giữ nguyên, không chặn thêm.
--
-- Bỏ đánh dấu nhầm: restore_class_session() xoá đúng những dòng điểm danh
-- do nút này sinh ra (nhận diện bằng tiền tố ghi chú) rồi trả buổi về
-- 'scheduled'; trigger 0040 tự thu hồi quyền học bù 'pending' theo sau.
-- =====================================================================

alter table public.sessions add column if not exists cancel_reason text;

-- Dấu nhận biết dòng điểm danh do "Lớp nghỉ" sinh ra, để bỏ đánh dấu thì
-- gỡ đúng chúng, không đụng vào điểm danh giáo viên tự ghi trước đó.
-- (giữ nguyên chuỗi này ở cả hai hàm dưới)

create or replace function public.cancel_class_session(
  p_session_id uuid,
  p_reason text default null
)
returns int -- số học viên chuyển sang vắng có phép
security definer
set search_path = public
language plpgsql
as $$
declare
  v_sess record;
  v_me uuid := public.my_profile_id();
  v_note text := '[Lớp nghỉ]' || coalesce(' ' || nullif(btrim(p_reason), ''), '');
  v_count int := 0;
begin
  select id, class_id, status into v_sess from sessions where id = p_session_id;
  if not found then
    raise exception 'Không tìm thấy buổi học.';
  end if;
  if not (public.teaches_session(p_session_id)
          or public.has_perm('attendance.manage')
          or public.has_perm('classes.manage')) then
    raise exception 'Bạn không có quyền báo nghỉ buổi này.';
  end if;
  if v_sess.status = 'cancelled' then
    return 0; -- đã nghỉ rồi, bấm lại không làm gì thêm
  end if;

  -- Lớp không dạy thì không có công. Xoá TRƯỚC khi đổi status vì trigger
  -- 0042 kéo buổi về 'scheduled' sau mỗi lần xoá công.
  delete from teaching_logs where session_id = p_session_id;

  -- Học viên đang học của lớp → vắng có phép (trigger 0002 sinh quyền bù)
  if v_sess.class_id is not null then
    insert into attendance (session_id, student_id, status, note, marked_by, marked_at)
    select p_session_id, cs.student_id, 'absent_excused', v_note, v_me, now()
      from class_students cs
     where cs.class_id = v_sess.class_id
       and cs.status = 'active'
    on conflict (session_id, student_id) do update
      set status = 'absent_excused',
          note = excluded.note,
          marked_by = excluded.marked_by,
          marked_at = excluded.marked_at;
    get diagnostics v_count = row_count;
  end if;

  -- Học viên được xếp bù vào chính buổi này → trả về hàng chờ xếp bù
  update makeup_credits
     set status = 'pending', makeup_session_id = null
   where makeup_session_id = p_session_id
     and status = 'scheduled';

  update sessions
     set status = 'cancelled',
         cancel_reason = nullif(btrim(p_reason), '')
   where id = p_session_id;

  return v_count;
end;
$$;

-- Bỏ đánh dấu nghỉ (bấm nhầm buổi / lớp học lại bình thường).
create or replace function public.restore_class_session(p_session_id uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if not (public.teaches_session(p_session_id)
          or public.has_perm('attendance.manage')
          or public.has_perm('classes.manage')) then
    raise exception 'Bạn không có quyền bỏ đánh dấu nghỉ buổi này.';
  end if;

  -- Chỉ gỡ điểm danh do nút "Lớp nghỉ" tạo; trigger 0040 thu hồi quyền
  -- học bù 'pending' tương ứng (quyền đã xếp lịch thì giữ, admin tự gỡ).
  delete from attendance
   where session_id = p_session_id
     and status = 'absent_excused'
     and note like '[Lớp nghỉ]%';

  update sessions
     set status = 'scheduled', cancel_reason = null
   where id = p_session_id
     and status = 'cancelled';
end;
$$;

grant execute on function public.cancel_class_session(uuid, text) to authenticated;
grant execute on function public.restore_class_session(uuid) to authenticated;
