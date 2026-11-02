-- =====================================================================
-- 0060: MỘT TÀI KHOẢN DẠY NHIỀU CHI NHÁNH + GỘP TÀI KHOẢN TRÙNG.
-- Chạy SAU 0059_class_lesson_log.sql.
--
-- Trước đây mỗi hồ sơ chỉ thuộc một chi nhánh (profiles.branch_id) nên GV
-- dạy ở 2 cơ sở phải có 2 tài khoản → hành chính xếp buổi cho tài khoản này,
-- GV lại đăng nhập tài khoản kia, không thấy lịch.
--
-- 1. profile_branches: các chi nhánh THÊM của một hồ sơ (ngoài chi nhánh
--    chính profiles.branch_id). Hồ sơ hiện trong danh sách GV của mọi chi
--    nhánh nó thuộc về; app phía GV nhiều chi nhánh không lọc theo cơ sở.
-- 2. merge_profiles(giữ, bỏ): chuyển mọi dữ liệu trỏ tới hồ sơ "bỏ" (buổi
--    dạy, chấm công, lớp, nhận xét, thông báo...) sang hồ sơ "giữ", thêm chi
--    nhánh của hồ sơ "bỏ" vào profile_branches, rồi xoá hồ sơ + tài khoản
--    đăng nhập của hồ sơ "bỏ". Chỉ admin.
-- =====================================================================

create table if not exists public.profile_branches (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, branch_id)
);

create index if not exists profile_branches_branch_idx on public.profile_branches (branch_id);

alter table public.profile_branches enable row level security;

drop policy if exists "read profile branches" on public.profile_branches;
create policy "read profile branches" on public.profile_branches
  for select using (auth.uid() is not null);

drop policy if exists "team manage profile branches" on public.profile_branches;
create policy "team manage profile branches" on public.profile_branches
  for all using (public.has_perm('team.manage'))
  with check (public.has_perm('team.manage'));

-- ---------------------------------------------------------------------
-- Gộp hồ sơ trùng. Trả về số dòng đã chuyển.
-- Dòng trùng khoá (vd cả 2 hồ sơ cùng được gán một lớp) thì bỏ dòng của
-- hồ sơ "bỏ"; trùng lịch dạy (2 hồ sơ có buổi cùng giờ) thì dừng, báo lỗi.
-- ---------------------------------------------------------------------
create or replace function public.merge_profiles(p_keep uuid, p_drop uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep public.profiles;
  v_drop public.profiles;
  v_fk record;
  v_row record;
  v_moved int := 0;
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản lý (admin) mới gộp được tài khoản.' using errcode = '42501';
  end if;
  if p_keep = p_drop then
    raise exception 'Hai hồ sơ phải khác nhau.';
  end if;

  select * into v_keep from public.profiles where id = p_keep;
  select * into v_drop from public.profiles where id = p_drop;
  if v_keep.id is null or v_drop.id is null then
    raise exception 'Không tìm thấy hồ sơ.';
  end if;
  if v_keep.role <> v_drop.role then
    raise exception 'Chỉ gộp được hai hồ sơ cùng vai trò.';
  end if;

  -- Đổi GV của buổi không phải đổi lịch → không báo học viên
  perform set_config('classhub.bulk_reschedule', 'on', true);

  -- Mọi cột khoá ngoại (1 cột) trỏ tới profiles.id
  for v_fk in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.profiles'::regclass
       and array_length(c.conkey, 1) = 1
  loop
    for v_row in execute format('select ctid from %s where %I = $1', v_fk.tbl, v_fk.col) using p_drop
    loop
      begin
        execute format('update %s set %I = $1 where ctid = $2', v_fk.tbl, v_fk.col)
          using p_keep, v_row.ctid;
        v_moved := v_moved + 1;
      exception
        when unique_violation then
          execute format('delete from %s where ctid = $1', v_fk.tbl) using v_row.ctid;
        when exclusion_violation then
          raise exception 'Không gộp được: % và % có buổi dạy trùng giờ (bảng %). Đổi GV một trong hai buổi rồi thử lại.',
            v_keep.name, v_drop.name, v_fk.tbl;
      end;
    end loop;
  end loop;

  -- Chi nhánh của hồ sơ bỏ thành chi nhánh thêm của hồ sơ giữ
  if v_drop.branch_id is not null and v_drop.branch_id is distinct from v_keep.branch_id then
    insert into public.profile_branches (profile_id, branch_id)
    values (p_keep, v_drop.branch_id)
    on conflict do nothing;
  end if;
  delete from public.profile_branches where profile_id = p_keep and branch_id = v_keep.branch_id;

  -- Giữ lại thông tin liên hệ hồ sơ giữ đang để trống
  update public.profiles
     set phone = coalesce(phone, v_drop.phone),
         email = coalesce(email, v_drop.email),
         avatar = coalesce(avatar, v_drop.avatar),
         note = coalesce(note, v_drop.note)
   where id = p_keep;

  delete from public.profiles where id = p_drop;
  if v_drop.user_id is not null then
    delete from auth.users where id = v_drop.user_id;
  end if;

  return v_moved;
end;
$$;

revoke all on function public.merge_profiles(uuid, uuid) from public;
grant execute on function public.merge_profiles(uuid, uuid) to authenticated;
