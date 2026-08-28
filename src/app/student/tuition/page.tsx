"use client";

import { AlertCircle, CheckCircle2, Receipt, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import {
  PAYMENT_METHOD_LABELS,
  fetchStudentPackages,
  fetchStudentPayments,
  fmtVND,
} from "@/lib/db-tuition";
import { cn, pct } from "@/lib/utils";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * HỌC PHÍ & HÓA ĐƠN (khu học viên) — chỉ đọc.
 *
 * Cùng nguồn số liệu với trang học phí của hành chính (view
 * `package_balances`, RLS lọc còn gói của chính mình): số buổi còn lại tính
 * ngược từ điểm danh, công nợ = giá sau ưu đãi trừ số đã đóng. Nhờ vậy con
 * số học viên thấy luôn khớp với con số ở quầy.
 */
export default function StudentTuitionPage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const packages = useLoad(
    () => (studentId ? fetchStudentPackages(studentId) : Promise.resolve([])),
    [studentId],
  );
  const payments = useLoad(
    () => (studentId ? fetchStudentPayments(studentId) : Promise.resolve([])),
    [studentId],
  );

  const list = packages.data ?? [];
  const remaining = list.reduce((s, p) => s + p.remaining_sessions, 0);
  const totalSessions = list.reduce((s, p) => s + p.total_sessions, 0);
  const debt = list.reduce((s, p) => s + Number(p.debt), 0);
  const paid = list.reduce((s, p) => s + Number(p.paid_amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Học phí & hóa đơn</h1>
        <p className="mt-1 text-muted-foreground">
          Gói buổi đang học, số buổi còn lại và các lần đã đóng tiền.
        </p>
      </div>

      {packages.error && <ErrorNote message={packages.error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Buổi còn lại"
          value={packages.loading ? "…" : `${remaining}/${totalSessions}`}
          icon={Wallet}
          accent={remaining <= 3 ? "gold" : "brand"}
        />
        <StatCard label="Đã đóng" value={fmtVND(paid)} icon={CheckCircle2} accent="jade" />
        <StatCard
          label="Còn phải đóng"
          value={fmtVND(debt)}
          icon={Receipt}
          accent={debt > 0 ? "gold" : "jade"}
        />
      </div>

      {!packages.loading && remaining <= 3 && list.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {remaining === 0
              ? "Gói buổi của bạn đã hết — liên hệ trung tâm để gia hạn trước buổi học tiếp theo nhé."
              : `Gói buổi chỉ còn ${remaining} buổi — nhớ gia hạn sớm để không gián đoạn việc học.`}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gói buổi của tôi</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {packages.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : list.length === 0 ? (
            <Empty
              icon={Wallet}
              title="Chưa có gói buổi nào"
              description="Khi trung tâm ghi nhận gói học của bạn, thông tin học phí sẽ hiện ở đây."
              className="p-8"
            />
          ) : (
            <div className="space-y-4">
              {list.map((p) => {
                const used = p.total_sessions - p.remaining_sessions;
                return (
                  <div key={p.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                          {p.name}
                          {p.course_name && <Badge variant="muted">{p.course_name}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Bắt đầu {new Date(p.start_date + "T00:00:00").toLocaleDateString("vi-VN")}
                          {p.discount_total > 0 && ` · đã trừ ưu đãi ${fmtVND(p.discount_total)}`}
                        </div>
                      </div>
                      <Badge variant={p.remaining_sessions <= 3 ? "gold" : "jade"}>
                        Còn {p.remaining_sessions}/{p.total_sessions} buổi
                      </Badge>
                    </div>

                    <Progress value={pct(used, p.total_sessions)} className="mt-3" />
                    <div className="mt-1 text-xs text-muted-foreground">
                      Đã học {used} buổi
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Học phí</div>
                        <div className="font-semibold">{fmtVND(p.final_price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Đã đóng</div>
                        <div className="font-semibold text-emerald-700">{fmtVND(p.paid_amount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Còn thiếu</div>
                        <div className={cn("font-semibold", Number(p.debt) > 0 && "text-gold-700")}>
                          {fmtVND(p.debt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử đóng tiền</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {payments.error && <ErrorNote message={payments.error} />}
          {payments.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : (payments.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có lần đóng tiền nào được ghi nhận.
            </p>
          ) : (
            <div className="divide-y">
              {(payments.data ?? []).map((pm) => (
                <div key={pm.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {fmtVND(pm.amount)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[pm.method]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {fmtDateTime(pm.paid_at)} · biên lai{" "}
                      <span className="font-mono">{pm.receipt_no}</span>
                      {pm.note ? ` · ${pm.note}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Cần bản in biên lai? Nhắn văn phòng kèm số biên lai ở trên, trung tâm in lại giúp bạn.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
