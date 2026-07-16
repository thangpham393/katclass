"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { Logo } from "@/components/brand/logo";
import { useLoad } from "@/lib/use-load";
import { fetchReceipt, fmtVND, PAYMENT_METHOD_LABELS } from "@/lib/db-tuition";

/** Biên lai thu học phí — bấm “In biên lai” để in / lưu PDF (sidebar + topbar tự ẩn khi in). */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const receipt = useLoad(() => fetchReceipt(id), [id]);

  if (receipt.loading) return <LoadingRows rows={5} />;
  if (receipt.error) return <ErrorNote message={receipt.error} />;
  if (!receipt.data) return <ErrorNote message="Không tìm thấy biên lai này." />;

  const r = receipt.data;
  const paidDate = new Date(r.paid_at);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/admin/tuition">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Học phí
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> In biên lai
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
            <div className="text-xl font-extrabold tracking-tight">BIÊN LAI THU HỌC PHÍ</div>
            <div className="mt-1 font-mono text-sm text-muted-foreground">Số: {r.receipt_no}</div>
            <div className="text-xs text-muted-foreground">
              Ngày {paidDate.getDate()} tháng {paidDate.getMonth() + 1} năm {paidDate.getFullYear()}
            </div>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Học viên</dt>
            <dd className="font-semibold">
              {r.student?.name ?? "?"}
              {r.student?.student_code && (
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                  {r.student.student_code}
                </span>
              )}
            </dd>
          </div>
          {r.student?.phone && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Số điện thoại</dt>
              <dd>{r.student.phone}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Nội dung</dt>
            <dd className="font-semibold">
              Học phí {r.package?.name ?? "gói buổi"}
              {r.package && (
                <span className="ml-1 font-normal text-muted-foreground">
                  (kích hoạt từ {new Date(r.package.start_date + "T00:00:00").toLocaleDateString("vi-VN")})
                </span>
              )}
            </dd>
          </div>
          {r.package && Number(r.package.discount) > 0 && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Giá gói / ưu đãi</dt>
              <dd>
                {fmtVND(r.package.price)} · ưu đãi {fmtVND(r.package.discount)}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Hình thức</dt>
            <dd>{PAYMENT_METHOD_LABELS[r.method]}</dd>
          </div>
          {r.note && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 text-muted-foreground">Ghi chú</dt>
              <dd>{r.note}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 rounded-xl border-2 border-brand-200 bg-brand-50/50 p-4 text-center print:border-black/20 print:bg-transparent">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Số tiền đã thu</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-brand-700 print:text-black">
            {fmtVND(r.amount)}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <div className="font-semibold">Người nộp tiền</div>
            <div className="text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div className="font-semibold">Người thu tiền</div>
            <div className="text-xs text-muted-foreground">(Ký, ghi rõ họ tên)</div>
            <div className="mt-14 font-medium">{r.received_by_profile?.name ?? ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
