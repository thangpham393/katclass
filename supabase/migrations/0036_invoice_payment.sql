-- =====================================================================
-- 0036: NỐI BIÊN LAI VỚI HOÁ ĐƠN (sửa "Đã thu" là GHI ĐÈ, không cộng dồn)
--
-- Ô "Đã thu" trên hoá đơn là MỘT CON SỐ, không phải một chuỗi lần nộp:
-- nhân viên gõ 2.000.000 rồi sửa lại thành 2.500.000 nghĩa là "tổng đã
-- thu của tờ này là 2.5 triệu", chứ không phải thu thêm 2.5 triệu nữa.
--
-- Vì vậy mỗi hoá đơn chỉ được có ĐÚNG MỘT dòng `payments` đi kèm — index
-- duy nhất bên dưới chặn ở tầng database, không phụ thuộc vào việc giao
-- diện có gọi đúng hàm hay không. Sửa số tiền = update dòng đó; xoá về 0
-- = xoá dòng đó. Doanh thu (cộng từ `payments`) nhờ vậy luôn khớp với
-- con số đang in trên tờ hoá đơn.
--
-- Thu tiền NHIỀU LẦN cho một gói vẫn làm được như cũ ở màn hình "Chi tiết
-- gói": những dòng đó có invoice_id = null nên không đụng gì tới đây.
-- =====================================================================

alter table public.payments
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

comment on column public.payments.invoice_id is
  'Biên lai sinh từ ô "Đã thu" của hoá đơn — mỗi hoá đơn tối đa một dòng';

create unique index if not exists payments_invoice_key
  on public.payments (invoice_id)
  where invoice_id is not null;
