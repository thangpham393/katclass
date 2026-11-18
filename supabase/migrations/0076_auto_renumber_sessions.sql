-- =====================================================================
-- 0076 — Số buổi luôn liền mạch theo ngày giờ
--
-- Lỗi: session_no chỉ được gán 1 lần lúc sinh buổi (= số lớn nhất + 1).
--  • Xoá buổi chưa học (delete_unheld_sessions, lớp kết thúc…) để lại lỗ:
--    1,2,3,4 → xoá 5..9 → sinh lại thành 10,11… (vd lớp K3Y0C02001).
--  • Thêm khung giờ tuần rồi sinh tiếp → buổi ngày sớm hơn lại mang số lớn
--    hơn (1,5,2,6,3,7…).
-- Sửa: trigger tự đánh lại 1,2,3… theo (ngày, giờ) cho khóa hiện tại của lớp
-- mỗi khi buổi được thêm / xoá / đổi ngày giờ / đổi trạng thái.
--  • Buổi đã huỷ không chiếm số (giữ nguyên số cũ, như 0073).
--  • Lớp đã lên khóa mới (course_started_on) chỉ đánh lại buổi từ ngày đó;
--    buổi của khóa cũ giữ nguyên.
--  • Sửa tay session_no ở modal buổi vẫn giữ được (trigger không chạy khi chỉ
--    đổi session_no) cho tới lần thêm/xoá/dời buổi kế tiếp.
-- =====================================================================

create or replace function public.renumber_class_sessions(p_class_id uuid)
returns int
security definer
set search_path = public
language plpgsql
as $$
declare
  v_from date;
  v_n int;
begin
  if p_class_id is null then return 0; end if;
  select course_started_on into v_from from classes where id = p_class_id;

  with numbered as (
    select s.id, row_number() over (order by s.date, s.start_time, s.id) as rn
      from sessions s
     where s.class_id = p_class_id
       and s.status <> 'cancelled'
       and (v_from is null or s.date >= v_from)
  )
  update sessions s
     set session_no = n.rn
    from numbered n
   where s.id = n.id and s.session_no is distinct from n.rn;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.renumber_class_sessions(uuid) from public;

create or replace function public.trg_renumber_class_sessions()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.renumber_class_sessions(old.class_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.class_id is distinct from old.class_id) then
    perform public.renumber_class_sessions(new.class_id);
  end if;
  return null;
end;
$$;

drop trigger if exists renumber_class_sessions on public.sessions;
create trigger renumber_class_sessions
  after insert or delete or update of date, start_time, status, class_id
  on public.sessions
  for each row
  execute function public.trg_renumber_class_sessions();

-- Sửa dữ liệu cũ: đánh lại số cho mọi lớp (không gửi thông báo đổi lịch vì
-- chỉ đổi session_no)
do $$
declare r record;
begin
  for r in select id from public.classes loop
    perform public.renumber_class_sessions(r.id);
  end loop;
end;
$$;
