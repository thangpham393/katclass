"use client";

/**
 * TỜ HOÁ ĐƠN IN ĐƯỢC — bấm In để lưu PDF gửi phụ huynh.
 *
 * Khác biên lai (giấy xác nhận đã nhận tiền), hoá đơn là giấy BÁO TRƯỚC:
 * phải có hạn đóng, thông tin chuyển khoản và nội quy khoá học thì phụ
 * huynh mới đủ cơ sở chuyển tiền — đó cũng là lý do ba trường này nằm
 * sẵn trong bảng `invoices` từ đầu.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { Logo } from "@/components/brand/logo";
import { useLoad } from "@/lib/use-load";
import { fmtVND, PAYMENT_METHOD_LABELS } from "@/lib/db-tuition";
import { fetchInvoice, invoiceDebt, invoiceTotal, lineTotal } from "@/lib/db-invoices";

function fmtDate(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");
}

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const inv = useLoad(() => fetchInvoice(id), [id]);

  if (inv.loading) return <LoadingRows rows={5} />;
  if (inv.error) return <ErrorNote message={inv.error} />;
  if (!inv.data) return <ErrorNote message="Không tìm thấy hoá đơn này." />;

  const r = inv.data;
  const subtotal = r.items.reduce((s, i) => s + lineTotal(i), 0);
  const total = invoiceTotal(r.items, Number(r.discount));
  const debt = invoiceDebt(r);
  const issued = new Date(r.issued_on + "T00:00:00");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/admin/tuition">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Hoá đơn
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> In hoá đơn
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b pb-5">
          <div>
            <Logo />
            <div className="mt-2 text-xs text-muted-foreground">
              Trung tâm tiếng Trung KAT Education
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold tracking-tight">HOÁ ĐƠN HỌC PHÍ</div>
            <div className="mt-1 font-mono text-sm text-muted-foreground">Số: {r.invoice_no}</div>
            <div className="text-xs text-muted-foreground">
              Ngày {issued.getDate()} tháng {issued.getMonth() + 1} năm {issued.getFullYear()}
            </div>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Phụ huynh</dt>
            <dd className="font-semibold">{r.customer_name}</dd>
          </div>
          {r.student_name && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Học viên</dt>
              <dd className="font-semibold">{r.student_name}</dd>
            </div>
          )}
          {r.phone && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Số điện thoại</dt>
              <dd>{r.phone}</dd>
            </div>
          )}
          {r.due_on && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Hạn thanh toán</dt>
              <dd className="font-semibold">{fmtDate(r.due_on)}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Hình thức</dt>
            <dd>{PAYMENT_METHOD_LABELS[r.method]}</dd>
          </div>
        </dl>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-y text-left text-xs uppercase tracking-[0.04em] text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Nội dung</th>
              <th className="py-2 pr-3 text-right font-semibold">SL</th>
              <th className="py-2 pr-3 text-right font-semibold">Đơn giá</th>
              <th className="py-2 text-right font-semibold">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-2 pr-3">{it.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{it.qty}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmtVND(it.price)}</td>
                <td className="py-2 text-right tabular-nums">{fmtVND(lineTotal(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {(r.total_sessions || r.start_date) && (
          <p className="mt-3 text-sm text-muted-foreground">
            Kế hoạch học:{" "}
            {[
              r.total_sessions ? `${r.total_sessions} buổi` : null,
              r.sessions_per_week ? `${r.sessions_per_week} buổi/tuần` : null,
              r.start_date ? `bắt đầu ${fmtDate(r.start_date)}` : null,
              r.end_date ? `dự kiến kết thúc ${fmtDate(r.end_date)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <dl className="mt-5 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tổng học phí</dt>
            <dd className="tabular-nums">{fmtVND(subtotal)}</dd>
          </div>
          {Number(r.discount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Giảm giá</dt>
              <dd className="tabular-nums">− {fmtVND(Number(r.discount))}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-extrabold">
            <dt>Tổng phải đóng</dt>
            <dd className="tabular-nums">{fmtVND(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Đã thu</dt>
            <dd className="tabular-nums">{fmtVND(Number(r.paid_amount))}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <dt>Còn phải đóng</dt>
            <dd className="tabular-nums">{fmtVND(Math.max(0, debt))}</dd>
          </div>
        </dl>

        {r.note && <p className="mt-5 text-sm">Ghi chú: {r.note}</p>}

        {r.bank_info && (
          <div className="mt-5 rounded-xl border bg-secondary/40 p-4 text-sm print:bg-transparent">
            <div className="font-semibold">Thông tin chuyển khoản</div>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground print:text-black">
              {r.bank_info}
            </p>
          </div>
        )}

        {r.terms && (
          <div className="mt-5 border-t pt-4 text-xs text-muted-foreground print:text-black">
            <div className="font-semibold">Nội quy khoá học</div>
            <p className="mt-1 whitespace-pre-wrap">{r.terms}</p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="font-semibold">Phụ huynh / Học viên</div>
            <div className="text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div className="font-semibold">Trung tâm</div>
            <div className="text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
