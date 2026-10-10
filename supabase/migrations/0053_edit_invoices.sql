-- Edit an invoice, its package and its single receipt in one transaction.
-- Keep customer links, package identity and receipt history. Safe to run twice.
begin;

create or replace function public.update_invoice(p_invoice_id uuid, changes jsonb)
returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  original public.invoices;
  edited public.invoices;
  linked_package uuid;
  subtotal numeric := 0;
  line_discounts numeric := 0;
  line_amount numeric;
  discount_value numeric;
  item jsonb;
  course uuid;
begin
  if not coalesce(public.has_perm('tuition.manage') or public.has_perm('students.manage'), false) then
    raise exception 'Bạn không có quyền sửa hoá đơn';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'object' then
    raise exception 'Thông tin hoá đơn không hợp lệ';
  end if;

  select * into original from public.invoices i where i.id = p_invoice_id for update;
  if not found then raise exception 'Không tìm thấy hoá đơn hoặc bạn không có quyền sửa'; end if;
  edited := jsonb_populate_record(original, changes);
  -- These links are never accepted from the browser.
  edited.student_id := original.student_id;
  edited.lead_id := original.lead_id;
  linked_package := original.package_id;

  if nullif(btrim(edited.invoice_no), '') is null or nullif(btrim(edited.customer_name), '') is null
    or edited.branch_id is null or edited.issued_on is null then
    raise exception 'Điền số hoá đơn, người đứng tên, trung tâm và ngày hoá đơn';
  end if;
  if edited.method is null or edited.method not in ('cash', 'transfer') then
    raise exception 'Hình thức thanh toán không hợp lệ';
  end if;
  if edited.items is null or jsonb_typeof(edited.items) <> 'array' then
    raise exception 'Thêm ít nhất một dòng nội dung hợp lệ';
  end if;
  if jsonb_array_length(edited.items) = 0 then
    raise exception 'Thêm ít nhất một dòng nội dung hợp lệ';
  end if;
  for item in select value from jsonb_array_elements(edited.items) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'qty') is distinct from 'number'
      or jsonb_typeof(item -> 'price') is distinct from 'number'
      or (item ->> 'qty')::numeric <= 0 or (item ->> 'price')::numeric < 0 then
      raise exception 'Số lượng phải lớn hơn 0 và đơn giá không được âm';
    end if;
    line_amount := (item ->> 'qty')::numeric * (item ->> 'price')::numeric;
    discount_value := coalesce((item ->> 'discount_value')::numeric, 0);
    if discount_value < 0 or coalesce(item ->> 'discount_type', 'cash') not in ('percent', 'cash')
      or (item ->> 'discount_type' = 'percent' and discount_value > 100)
      or (coalesce(item ->> 'discount_type', 'cash') = 'cash' and discount_value > line_amount) then
      raise exception 'Giảm giá từng dòng phải từ 0 đến 100%% hoặc không vượt thành tiền dòng đó';
    end if;
    line_discounts := line_discounts + case when item ->> 'discount_type' = 'percent'
      then round(line_amount * discount_value / 100) else discount_value end;
    subtotal := subtotal + line_amount;
    if course is null then course := nullif(item ->> 'course_id', '')::uuid; end if;
  end loop;
  if edited.discount is null or edited.discount < 0 or edited.discount > subtotal - line_discounts then
    raise exception 'Giảm giá phải từ 0 đến tổng học phí';
  end if;
  if edited.paid_amount is null or edited.paid_amount < 0 or edited.paid_amount > subtotal - line_discounts - edited.discount then
    raise exception 'Số tiền đã thu phải từ 0 đến tổng phải đóng';
  end if;
  if edited.total_sessions < 0 or edited.sessions_per_week < 0 then
    raise exception 'Số buổi không được âm';
  end if;

  if linked_package is not null or (original.student_id is not null and edited.total_sessions > 0) then
    if not coalesce(public.has_perm('tuition.manage'), false) then
      raise exception 'Bạn cần quyền quản lý học phí để cập nhật gói học và biên lai';
    end if;
    if coalesce(edited.total_sessions, 0) <= 0 then
      raise exception 'Hoá đơn đã có gói học cần ít nhất một buổi';
    end if;
    if linked_package is not null then
      update public.enrollment_packages set
        name = coalesce(nullif(btrim(edited.items -> 0 ->> 'name'), ''), 'Gói ' || edited.total_sessions || ' buổi'),
        course_id = course, total_sessions = edited.total_sessions,
        price = subtotal, discount_percent = 0, discount = edited.discount + line_discounts,
        start_date = coalesce(edited.start_date, edited.issued_on), note = edited.note
      where id = linked_package and student_id = original.student_id;
      if not found then raise exception 'Không tìm thấy gói học hoặc bạn không có quyền sửa'; end if;
    else
      insert into public.enrollment_packages(student_id, course_id, name, total_sessions, price,
        discount_percent, discount, start_date, note, created_by)
      values(original.student_id, course,
        coalesce(nullif(btrim(edited.items -> 0 ->> 'name'), ''), 'Gói ' || edited.total_sessions || ' buổi'),
        edited.total_sessions, subtotal, 0, edited.discount + line_discounts,
        coalesce(edited.start_date, edited.issued_on), edited.note, public.my_profile_id())
      returning id into linked_package;
    end if;

    if edited.paid_amount > 0 then
      insert into public.payments as p(package_id, student_id, invoice_id, amount, method, note, received_by)
      values(linked_package, original.student_id, original.id, edited.paid_amount,
        edited.method, 'Hoá đơn ' || btrim(edited.invoice_no), public.my_profile_id())
      on conflict (invoice_id) where invoice_id is not null do update
        set amount = excluded.amount, method = excluded.method, note = excluded.note;
    else
      delete from public.payments p where p.invoice_id = original.id;
    end if;
  end if;

  update public.invoices set
    invoice_no = btrim(edited.invoice_no), branch_id = edited.branch_id,
    customer_name = btrim(edited.customer_name), student_name = edited.student_name, phone = edited.phone,
    issued_on = edited.issued_on, due_on = edited.due_on, method = edited.method,
    items = edited.items, discount = edited.discount, paid_amount = edited.paid_amount,
    note = edited.note, bank_info = edited.bank_info, terms = edited.terms,
    total_sessions = edited.total_sessions, start_date = edited.start_date,
    sessions_per_week = edited.sessions_per_week, end_date = edited.end_date,
    package_id = linked_package, updated_at = now()
  where id = original.id;
  if not found then raise exception 'Bạn không có quyền sửa hoá đơn'; end if;
end;
$$;

revoke all on function public.update_invoice(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_invoice(uuid, jsonb) to authenticated;

commit;
