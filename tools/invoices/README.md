# Sửa hoá đơn và giảm giá từng dòng

Chạy `supabase/migrations/0053_edit_invoices.sql` sau các migration hiện có để bật RPC sửa hoá đơn.
RPC giữ liên kết khách hàng, cập nhật gói học và biên lai trong một transaction, dùng quyền RLS hiện có.

Mỗi dòng `items` có thể lưu `discount_type` (`percent` hoặc `cash`) và `discount_value`.
Giảm giá tính trên `qty × price`; phần trăm làm tròn tới đồng. `invoices.discount` vẫn là mức giảm thêm toàn hoá đơn.
Gói học nhận giá gốc và tổng giảm giá của tất cả các dòng cộng mức giảm toàn hoá đơn.

Kiểm tra local, không ghi dữ liệu thật:

```sh
node --test tests/invoices.test.cjs
node tools/invoices/test-migrations.mjs /path/to/pglite/dist/index.js
node tools/invoices/test-browser.cjs /path/to/playwright
npm run build
```

Browser test tạo rồi dọn route tạm `invoice-verification`, dùng Chrome và cổng local 3114.
Ảnh kiểm tra desktop/mobile lưu tại `/tmp/invoice-edit-*.png` và `/tmp/invoice-print-mobile.png`.
