// Real invoice pages/forms with local fixtures only; no live database writes.
// Usage: node tools/invoices/test-browser.cjs <playwright module directory>
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(path.resolve(process.argv[2]));
const port = 3114;
const origin = `http://127.0.0.1:${port}`;
const root = path.resolve('src/app/invoice-verification');
assert(!fs.existsSync(root), 'Refuse to overwrite an existing route');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const invoices = [{
  id: id(6), invoice_no: 'INV0001', branch_id: id(3), lead_id: null, student_id: id(2),
  customer_name: 'Phụ huynh cũ', student_name: 'Học viên cũ', phone: '0900000000',
  issued_on: '2026-10-01', due_on: '2026-10-15', method: 'transfer',
  items: [{ name: 'HSK 2', qty: 1, price: 3000000, course_id: null }, { name: 'Giáo trình', qty: 1, price: 500000, course_id: null }],
  discount: 0, paid_amount: 1000000, note: 'Ghi chú cũ', bank_info: null, terms: null,
  total_sessions: 24, start_date: '2026-10-01', sessions_per_week: 2, end_date: '2026-12-23',
  package_id: id(5), created_at: '2026-10-01T00:00:00Z',
}];
const posts = [];
const calls = [];
const errors = [];
const logs = [];
let browser, server, rejectSave = false;
const net = item => item.qty * item.price - (item.discount_type === 'percent'
  ? Math.round(item.qty * item.price * (item.discount_value || 0) / 100) : item.discount_value || 0);
(async () => {
  fs.mkdirSync(path.join(root, '[id]'), { recursive: true });
  fs.writeFileSync(path.join(root, 'layout.tsx'), `"use client";
import { BranchProvider } from '@/components/shell/branch-provider';
const user = {id:'${id(1)}',name:'Kiểm thử',email:'fixture@example.test',role:'admin' as const,branchId:'${id(3)}',classIds:[]};
export default function Layout({children}:{children:React.ReactNode}) {return <BranchProvider user={user}><div className="min-w-0 p-4">{children}</div></BranchProvider>}`);
  fs.writeFileSync(path.join(root, 'page.tsx'), 'export {default} from "@/app/admin/tuition/page";');
  fs.writeFileSync(path.join(root, '[id]/page.tsx'), 'export {default} from "@/app/admin/tuition/invoice/[id]/page";');
  server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: origin + '/fixture', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', d => logs.push(String(d)));
  server.stderr.on('data', d => logs.push(String(d)));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(origin + '/invoice-verification')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  assert(ready, logs.join(''));
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const user = { id: id(1), email: 'fixture@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+86400 })).toString('base64url'), 'fixture'].join('.');
  const session = { access_token: token, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now()/1000)+86400, expires_in: 86400, token_type: 'bearer', user };
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }]);
  await page.route('**/fixture/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').at(-1);
    calls.push(name);
    let result;
    if (name === 'user') result = user;
    else if (name === 'profiles') result = url.searchParams.has('user_id')
      ? { id: id(1), name: 'Kiểm thử', email: user.email, role: 'admin', avatar: null, branch_id: id(3) }
      : [{ id: id(2), name: 'Học viên cũ', role: 'student', phone: '0900000000', branch_id: id(3) }];
    else if (name === 'role_permissions') result = [{ perm: 'tuition.manage' }, { perm: 'students.manage' }];
    else if (name === 'branches') result = [{ id: id(3), name: 'Chi nhánh kiểm thử', is_default: true }];
    else if (name === 'package_balances') result = [];
    else if (name === 'payments') result = [{ amount: invoices[0].paid_amount }];
    else if (name === 'courses' || name === 'supply_stock' || name === 'supply_items' || name === 'parent_students') result = [];
    else if (name === 'message_templates') result = { body: 'Nội quy mẫu mới' };
    else if (name === 'next_invoice_no') result = 'INV0002';
    else if (name === 'invoices') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); posts.push({ kind: 'create', body });
        invoices.push({ ...body, id: id(7), created_at: new Date().toISOString() }); result = { id: id(7) };
      } else if (url.searchParams.has('id')) result = invoices.find(i => i.id === url.searchParams.get('id').replace('eq.', ''));
      else if (url.searchParams.get('select') === 'bank_info') result = [{ bank_info: 'Tài khoản của tờ khác' }];
      else result = invoices;
    } else if (name === 'update_invoice') {
      const body = request.postDataJSON(); posts.push({ kind: 'edit', body });
      if (rejectSave) { await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Lỗi lưu kiểm thử' }) }); return; }
      Object.assign(invoices.find(i => i.id === body.p_invoice_id), body.changes); result = null;
    } else {
      errors.push(`Unmocked fixture request ${url.pathname}`);
      await route.fulfill({ status: 500, body: 'Unexpected fixture request' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto(origin + '/invoice-verification');
  await page.getByRole('button', { name: 'Sửa hoá đơn', exact: true }).click();
  let dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Số hoá đơn').inputValue(), 'INV0001');
  assert.equal(await dialog.getByLabel('Phụ huynh (người đứng tên)').inputValue(), 'Phụ huynh cũ');
  assert.equal(await dialog.getByLabel('Tổng số buổi').inputValue(), '24');
  assert.equal(await dialog.getByLabel('Ngày kết thúc dự kiến').inputValue(), '2026-12-23');
  assert.equal(await dialog.getByLabel('Thông tin chuyển khoản').inputValue(), '');
  assert(!calls.includes('next_invoice_no')); assert(!calls.includes('message_templates'));
  await dialog.getByLabel('Phụ huynh (người đứng tên)').fill('Bản nháp');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  assert.equal(posts.length, 0);
  await page.getByRole('button', { name: 'Sửa hoá đơn', exact: true }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Phụ huynh (người đứng tên)').inputValue(), 'Phụ huynh cũ');
  await dialog.getByLabel('Kiểu giảm giá dòng 1', { exact: true }).selectOption('percent');
  await dialog.getByLabel('Giảm giá dòng 1', { exact: true }).fill('10');
  await dialog.getByLabel('Kiểu giảm giá dòng 2', { exact: true }).selectOption('cash');
  await dialog.getByLabel('Giảm giá dòng 2', { exact: true }).fill('50000');
  assert.match(await dialog.textContent(), /3\.150\.000/);
  await dialog.getByLabel('Đã thu', { exact: true }).fill('4000000');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await dialog.getByText('Số tiền đã thu không được lớn hơn tổng phải đóng.').waitFor();
  assert.equal(posts.length, 0);
  await dialog.getByLabel('Đã thu', { exact: true }).fill('1500000');
  await dialog.getByLabel('Phụ huynh (người đứng tên)').fill('Phụ huynh mới');
  await dialog.getByLabel('Tổng số buổi').fill('30');
  await page.screenshot({ path: '/tmp/invoice-edit-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByLabel('Đơn giá', { exact: true }).first().scrollIntoViewIfNeeded();
  const priceBox = await dialog.getByLabel('Đơn giá', { exact: true }).first().boundingBox();
  const discountBox = await dialog.getByLabel('Giảm giá dòng 1', { exact: true }).boundingBox();
  assert(Math.abs(priceBox.y - discountBox.y) < 5, 'Discount stays beside price on mobile');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  await page.screenshot({ path: '/tmp/invoice-edit-mobile.png' });
  rejectSave = true;
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await dialog.getByText('Lỗi lưu kiểm thử').waitFor();
  assert.equal(await dialog.getByLabel('Giảm giá dòng 1', { exact: true }).inputValue(), '10');
  rejectSave = false;
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: 'Phụ huynh mới', exact: true }).waitFor();
  const saved = posts.at(-1).body;
  assert.equal(saved.p_invoice_id, id(6));
  assert.equal(saved.changes.total_sessions, 30); assert.equal(saved.changes.discount, 0);
  assert.equal(saved.changes.items[0].discount_type, 'percent'); assert.equal(saved.changes.items[0].discount_value, 10);
  assert.equal(saved.changes.items[1].discount_type, 'cash'); assert.equal(saved.changes.items[1].discount_value, 50000);
  assert(!('student_id' in saved.changes)); assert(!('package_id' in saved.changes));
  await page.goto(origin + `/invoice-verification/${id(6)}`);
  await page.getByText('Phụ huynh mới', { exact: true }).waitFor();
  await page.getByText('Giảm 10% · 300.000 ₫', { exact: true }).waitFor();
  await page.getByText('Giảm 50.000 ₫', { exact: true }).waitFor();
  assert.match(await page.locator('body').textContent(), /3\.150\.000/);
  await page.getByRole('button', { name: 'Sửa hoá đơn', exact: true }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Giảm giá dòng 1', { exact: true }).inputValue(), '10');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.screenshot({ path: '/tmp/invoice-print-mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Print page mobile overflow');
  await page.goto(origin + '/invoice-verification');
  await page.getByRole('button', { name: 'Tạo hoá đơn', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Học viên/).selectOption(id(2));
  await dialog.getByPlaceholder('Mô tả / khoản mục').fill('Học phí mới');
  await dialog.getByLabel('Đơn giá', { exact: true }).fill('2000000');
  await dialog.getByLabel('Kiểu giảm giá dòng 1', { exact: true }).selectOption('percent');
  await dialog.getByLabel('Giảm giá dòng 1', { exact: true }).fill('12.5');
  await dialog.getByRole('button', { name: 'Tạo hoá đơn', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const created = posts.at(-1);
  assert.equal(created.kind, 'create'); assert.equal(created.body.items[0].discount_value, 12.5);
  assert.equal(net(created.body.items[0]), 1750000);
  assert.deepEqual(errors, []);
  console.log('PASS: actual list/print edit, prefilled fields, cancel, failed save/retry, per-line percent/cash, totals, reload, mobile adjacency, creation persistence');
})().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) { server.kill('SIGTERM'); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve)); }
  fs.rmSync(root, { recursive: true, force: true });
});
