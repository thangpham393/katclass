// Local PostgreSQL integration checks. Usage: node tools/invoices/test-migrations.mjs <pglite/dist/index.js>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])));
const db = new PGlite();
const read = name => fs.readFileSync(`supabase/migrations/${name}`, 'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
await db.exec(`
  create role anon; create role authenticated;
  create table profiles(id uuid primary key);
  create table branches(id uuid primary key);
  create table leads(id uuid primary key);
  create table courses(id uuid primary key);
  create table message_templates(key text primary key,title text,body text);
  create function has_perm(p text) returns boolean language sql as $$
    select p = any(string_to_array(current_setting('app.perms',true), ',')) $$;
  create function is_staff() returns boolean language sql as $$ select coalesce(has_perm('tuition.manage') or has_perm('students.manage'),false) $$;
  create function my_profile_id() returns uuid language sql as $$ select '${id(1)}'::uuid $$;
`);
const tuition = read('0013_tuition_notifications.sql');
await db.exec(tuition.slice(tuition.indexOf('create table public.enrollment_packages'), tuition.indexOf('-- 3.'))
  .split('create or replace function')[0]);
const discounts = read('0023_package_course_discount.sql');
await db.exec(discounts.slice(0, discounts.indexOf('create or replace view')));
for (const file of ['0033_invoices.sql', '0035_invoice_plan.sql', '0036_invoice_payment.sql']) await db.exec(read(file));
await db.exec(`
  alter table enrollment_packages enable row level security;
  alter table payments enable row level security;
  create policy manage on enrollment_packages for all using(has_perm('tuition.manage')) with check(has_perm('tuition.manage'));
  create policy manage on payments for all using(has_perm('tuition.manage')) with check(has_perm('tuition.manage'));
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant usage on all sequences in schema public to authenticated;
  insert into profiles values('${id(1)}'),('${id(2)}');
  insert into branches values('${id(3)}');
  insert into leads values('${id(4)}');
  insert into enrollment_packages(id,student_id,name,total_sessions,price,start_date)
    values('${id(5)}','${id(2)}','Gói cũ',24,3000000,'2026-10-01');
  insert into invoices(id,invoice_no,branch_id,student_id,customer_name,items,paid_amount,total_sessions,package_id)
    values('${id(6)}','INV0001','${id(3)}','${id(2)}','Phụ huynh',
      '[{"name":"Gói cũ","qty":1,"price":3000000}]',1000000,24,'${id(5)}');
  insert into payments(package_id,student_id,invoice_id,amount,method,note,received_by,paid_at)
    values('${id(5)}','${id(2)}','${id(6)}',1000000,'transfer','Hoá đơn INV0001','${id(1)}','2026-10-01');
  insert into invoices(id,invoice_no,branch_id,lead_id,customer_name,items)
    values('${id(7)}','INV0002','${id(3)}','${id(4)}','Khách tiềm năng','[{"name":"Khoá học","qty":1,"price":3000000}]');
`);
await db.exec(read('0053_edit_invoices.sql'));
await db.exec(read('0053_edit_invoices.sql'));
await db.exec(`set role authenticated; select set_config('app.perms','tuition.manage',false);`);
const row = async (table, key, value) => (await db.query(`select * from ${table} where ${key}=$1`, [value])).rows[0];
const edit = (inv, changes) => db.query('select update_invoice($1,$2)', [inv, JSON.stringify(changes)]);
const receipt = await row('payments', 'invoice_id', id(6));
const changes = {
  invoice_no: 'INV0001A', customer_name: 'Phụ huynh mới', student_name: 'Tên in mới', phone: '0900000000',
  items: [
    { name: 'Gói mới', qty: 2, price: 2000000, discount_type: 'percent', discount_value: 10 },
    { name: 'Giáo trình', qty: 1, price: 500000, discount_type: 'cash', discount_value: 50000 },
  ], discount: 200000, paid_amount: 1500000,
  method: 'cash', total_sessions: 30, start_date: '2026-10-05', sessions_per_week: 3, end_date: '2026-12-14',
  note: 'Ghi chú mới', bank_info: '', terms: '',
  // Forged identity/link changes must have no effect.
  id: id(7), student_id: id(1), lead_id: id(4), package_id: id(8), created_by: id(2),
};
await edit(id(6), changes);
let inv = await row('invoices', 'id', id(6));
assert.equal(inv.invoice_no, 'INV0001A'); assert.equal(inv.customer_name, changes.customer_name);
assert.equal(inv.student_id, id(2)); assert.equal(inv.package_id, id(5)); assert.equal(inv.lead_id, null);
assert.equal(inv.bank_info, ''); assert.equal(inv.end_date.toISOString().slice(0, 10), changes.end_date);
let pkg = await row('enrollment_packages', 'id', id(5));
assert.equal(pkg.name, 'Gói mới'); assert.equal(pkg.total_sessions, 30);
assert.equal(Number(pkg.price), 4500000); assert.equal(Number(pkg.discount), 650000);
assert.equal(pkg.start_date.toISOString().slice(0, 10), '2026-10-05');
let payment = await row('payments', 'invoice_id', id(6));
assert.equal(payment.id, receipt.id); assert.equal(payment.receipt_no, receipt.receipt_no);
assert.equal(payment.paid_at.getTime(), receipt.paid_at.getTime());
assert.equal(payment.received_by, receipt.received_by); assert.equal(Number(payment.amount), 1500000);
assert.equal(payment.method, 'cash');
await edit(id(6), changes);
assert.equal((await db.query('select count(*)::int as n from enrollment_packages')).rows[0].n, 1);
assert.equal((await db.query('select count(*)::int as n from payments')).rows[0].n, 1);
console.log('PASS: migration rerun, full edit, stable package/receipt IDs and history, no duplicates, protected links');

// Invoice uniqueness fails after package/receipt writes: all writes must roll back.
const beforeInv = await row('invoices', 'id', id(6));
const beforePkg = await row('enrollment_packages', 'id', id(5));
const beforePayment = await row('payments', 'invoice_id', id(6));
await assert.rejects(() => edit(id(6), { ...changes, invoice_no: 'INV0002', paid_amount: 2000000, total_sessions: 99 }), /unique/);
assert.deepEqual(await row('invoices', 'id', id(6)), beforeInv);
assert.deepEqual(await row('enrollment_packages', 'id', id(5)), beforePkg);
assert.deepEqual(await row('payments', 'invoice_id', id(6)), beforePayment);
for (const invalid of [{ paid_amount: -1 }, { paid_amount: 5000000 }, { discount: 5000000 }, { total_sessions: 0 },
  { total_sessions: null }, { items: [] }, { items: {} }, { items: [{ name: 'X', qty: -1, price: 1 }] }, { method: 'other' }]) {
  await assert.rejects(() => edit(id(6), invalid));
}
for (const [type, value] of [['percent', 101], ['cash', 3000000], ['cash', -1], ['other', 10]]) {
  await assert.rejects(() => edit(id(6), { items: [{ name: 'X', qty: 1, price: 2000000, discount_type: type, discount_value: value }] }), /Giảm giá từng dòng/);
}
assert.deepEqual(await row('invoices', 'id', id(6)), beforeInv);
await edit(id(6), { paid_amount: 0 });
assert.equal(await row('payments', 'invoice_id', id(6)), undefined);
assert.equal((await row('invoices', 'id', id(6))).package_id, id(5));
await edit(id(6), { paid_amount: 500000 });
assert.equal(Number((await row('payments', 'invoice_id', id(6))).amount), 500000);
console.log('PASS: transaction rollback, invalid financial input rejected, zero removes receipt, recollection creates one receipt');
await edit(id(6), { items: [{ name: 'Tròn tiền', qty: 1, price: 1001, discount_type: 'percent', discount_value: 33.3 }], discount: 0, paid_amount: 0 });
assert.equal(Number((await row('enrollment_packages', 'id', id(5))).discount), 333);
await edit(id(6), { items: [{ name: 'Miễn học phí', qty: 1, price: 1000, discount_type: 'percent', discount_value: 100 }] });
assert.equal(Number((await row('enrollment_packages', 'id', id(5))).discount), 1000);
console.log('PASS: mixed percent/cash line discounts, rounding to VND and 100% discount');

await db.exec(`select set_config('app.perms','students.manage',false)`);
await edit(id(7), { note: 'Sửa báo giá', total_sessions: 12, paid_amount: 100000 });
assert.equal((await row('invoices', 'id', id(7))).package_id, null);
await assert.rejects(() => edit(id(6), { note: 'Không được phép' }), /quyền quản lý học phí/);
await db.exec(`select set_config('app.perms','',false)`);
await assert.rejects(() => edit(id(7), { note: 'Không được phép' }), /quyền sửa hoá đơn/);
await db.exec(`reset role; insert into invoices(id,invoice_no,branch_id,student_id,customer_name,items)
  values('${id(9)}','INV0003','${id(3)}','${id(2)}','Học viên','[{"name":"Khoá mới","qty":1,"price":2000000}]');
  set role authenticated; select set_config('app.perms','tuition.manage',false);`);
await edit(id(9), { total_sessions: 10, paid_amount: 500000 });
inv = await row('invoices', 'id', id(9));
assert(inv.package_id); assert.equal((await row('enrollment_packages', 'id', inv.package_id)).student_id, id(2));
await edit(id(9), { total_sessions: 12 });
assert.equal((await row('invoices', 'id', id(9))).package_id, inv.package_id);
await db.exec('set role anon');
await assert.rejects(() => edit(id(6), {}), /permission denied/);
console.log('PASS: lead edit without package, permission checks, new package when sessions added, anonymous RPC denied');
await db.close();
