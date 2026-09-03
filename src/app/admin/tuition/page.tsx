"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  Package,
  Plus,
  Printer,
  Receipt,
  ScrollText,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { InvoiceFormModal } from "@/components/invoice-form";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import {
  dbErrorMessage,
  LEVEL_LABELS,
} from "@/lib/db";
import {
  fetchInvoices,
  invoiceDebt,
  invoiceStatus,
  invoiceTotal,
  INVOICE_STATUS_LABELS,
  type InvoiceRow,
} from "@/lib/db-invoices";
import {
  addPayment,
  cancelPackage,
  fetchPackageBalances,
  fetchPackagePayments,
  fetchPaymentsTotalSince,
  firstOfMonthISO,
  fmtVND,
  PAYMENT_METHOD_LABELS,
  type PackageBalanceRow,
  type PaymentMethod,
} from "@/lib/db-tuition";

type FilterTab = "all" | "low" | "debt";

function fmtDate(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");
}

/** Mô tả ưu đãi kép: "10% (360.000 ₫) + 100.000 ₫". */
function discountLabel(pkg: PackageBalanceRow): string {
  const parts: string[] = [];
  if (Number(pkg.discount_percent) > 0)
    parts.push(`${Number(pkg.discount_percent)}% (${fmtVND(pkg.discount_amount)})`);
  if (Number(pkg.discount) > 0) parts.push(fmtVND(pkg.discount));
  return parts.join(" + ") || fmtVND(0);
}

/** Badge số buổi còn lại: đỏ khi hết, vàng khi ≤ 3. */
function RemainingBadge({ remaining }: { remaining: number }) {
  if (remaining === 0) return <Badge variant="destructive">Hết buổi</Badge>;
  if (remaining <= 3) return <Badge variant="gold">Còn {remaining} buổi</Badge>;
  return <Badge variant="jade">Còn {remaining} buổi</Badge>;
}

export default function AdminTuitionPage() {
  const balances = useLoad(fetchPackageBalances);
  const monthTotal = useLoad(() => fetchPaymentsTotalSince(firstOfMonthISO()));
  const [tab, setTab] = useState<FilterTab>("all");
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState(false);
  // Danh sách hoá đơn tự nạp trong khối con — đổi key là nạp lại sau khi lập tờ mới.
  const [invoiceKey, setInvoiceKey] = useState(0);
  const [detail, setDetail] = useState<PackageBalanceRow | null>(null);

  const rows = balances.data ?? [];
  const lowRows = rows.filter((r) => r.remaining_sessions <= 3);
  const debtRows = rows.filter((r) => r.debt > 0);
  const lowStudents = new Set(lowRows.map((r) => r.student_id)).size;
  const totalDebt = debtRows.reduce((s, r) => s + Number(r.debt), 0);

  const visible = useMemo(() => {
    let list = tab === "low" ? lowRows : tab === "debt" ? debtRows : rows;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (r) =>
          r.student_name.toLowerCase().includes(needle) ||
          (r.student_code ?? "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [rows, lowRows, debtRows, tab, q]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Tất cả gói", count: rows.length },
    { key: "low", label: "Sắp hết buổi", count: lowRows.length },
    { key: "debt", label: "Công nợ", count: debtRows.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Hoá đơn & học phí</h1>
          <p className="mt-1 text-muted-foreground">
            Một tờ hoá đơn lo cả ba việc: báo giá cho phụ huynh, mở gói buổi cho học viên và ghi
            biên lai tiền đã thu. Mỗi điểm danh (kể cả vắng) trừ 1 buổi — buổi học bù không trừ.
          </p>
        </div>
        <Button onClick={() => setSelling(true)}>
          <Plus className="h-4 w-4" /> Tạo hoá đơn
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Gói đang hoạt động" value={balances.loading ? "—" : rows.length} icon={Package} accent="brand" />
        <StatCard label="HV sắp hết buổi (≤3)" value={balances.loading ? "—" : lowStudents} icon={AlertTriangle} accent="gold" />
        <StatCard label="Tổng công nợ" value={balances.loading ? "—" : fmtVND(totalDebt)} icon={Wallet} accent="sky" />
        <StatCard label="Đã thu tháng này" value={monthTotal.data != null ? fmtVND(monthTotal.data) : "—"} icon={BadgeDollarSign} accent="jade" />
      </section>

      {balances.error && <ErrorNote message={balances.error} />}

      <InvoicesCard key={invoiceKey} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    tab === t.key
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-input bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {t.label} <span className="ml-0.5 text-xs opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm học viên, mã HV..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {balances.loading ? (
            <LoadingRows rows={5} className="p-0" />
          ) : visible.length === 0 ? (
            <Empty
              icon={Wallet}
              title={rows.length === 0 ? "Chưa có gói buổi nào" : "Không có gói nào khớp bộ lọc"}
              description={
                rows.length === 0
                  ? "Bấm “Tạo hoá đơn” và điền tổng số buổi — gói sẽ tự mở, số buổi còn lại trừ theo điểm danh."
                  : undefined
              }
              className="p-10"
            />
          ) : (
            <div className="divide-y">
              {visible.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={r.student_name} size={38} />
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={`/admin/members/${r.student_id}`} className="truncate text-sm font-semibold hover:text-brand-600 hover:underline">
                      {r.student_name}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.student_code && <span className="font-mono">{r.student_code} · </span>}
                      {r.name} · kích hoạt {fmtDate(r.start_date)}
                    </div>
                  </div>
                  <div className="w-28 shrink-0 text-sm sm:w-32">
                    <div className="font-semibold">
                      {r.used_sessions}/{r.total_sessions} buổi
                    </div>
                    <RemainingBadge remaining={r.remaining_sessions} />
                  </div>
                  <div className="min-w-0 flex-1 basis-32 text-sm sm:w-40 sm:flex-none sm:basis-auto">
                    <div className="font-semibold">{fmtVND(r.final_price)}</div>
                    {r.debt > 0 ? (
                      <span className="text-xs font-semibold text-rose-600">Còn nợ {fmtVND(r.debt)}</span>
                    ) : (
                      <span className="text-xs text-emerald-600">Đã đóng đủ</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => setDetail(r)}>
                    <Receipt className="h-3.5 w-3.5" /> Chi tiết
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selling && (
        <InvoiceFormModal
          target={{ kind: "student" }}
          onClose={() => setSelling(false)}
          onCreated={() => {
            setSelling(false);
            setInvoiceKey((k) => k + 1);
            balances.reload();
            monthTotal.reload();
          }}
        />
      )}

      {detail && (
        <PackageDetailModal
          pkg={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {
            balances.reload();
            monthTotal.reload();
          }}
        />
      )}
    </div>
  );
}

/* ============ Hoá đơn đã lập ============ */

/**
 * Hoá đơn (bảng `invoices`, migration 0033) là tờ giấy báo gửi trước —
 * lập được cho cả khách hàng tiềm năng CHƯA phải học viên, nên không gộp
 * chung danh sách với gói buổi ở trên mà đứng riêng một khối.
 */
function InvoicesCard() {
  const invoices = useLoad(() => fetchInvoices());
  const [q, setQ] = useState("");

  const rows: InvoiceRow[] = invoices.data ?? [];
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.invoice_no} ${r.customer_name} ${r.student_name ?? ""} ${r.phone ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  const totalDebt = rows.reduce((s, r) => s + Math.max(0, invoiceDebt(r)), 0);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Hoá đơn</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Hoá đơn lập cho khách hàng tiềm năng và học viên — tổng công nợ {fmtVND(totalDebt)}.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm số hoá đơn, tên khách..."
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {invoices.error && <ErrorNote message={invoices.error} />}
        {invoices.loading ? (
          <LoadingRows rows={3} className="p-0" />
        ) : visible.length === 0 ? (
          <Empty
            icon={ScrollText}
            title={rows.length === 0 ? "Chưa lập hoá đơn nào" : "Không có hoá đơn nào khớp"}
            description={
              rows.length === 0
                ? "Bấm “Tạo hoá đơn” ở trên, hoặc lập từ thẻ khách hàng ở trang Khách hàng tiềm năng."
                : undefined
            }
            className="p-10"
          />
        ) : (
          <div className="divide-y">
            {visible.map((inv) => {
              const status = invoiceStatus(inv);
              const debt = invoiceDebt(inv);
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="truncate text-sm font-semibold">
                      <span className="font-mono">{inv.invoice_no}</span> · {inv.customer_name}
                      {inv.student_name ? ` — ${inv.student_name}` : ""}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {fmtDate(inv.issued_on)}
                      {inv.due_on ? ` · hạn ${fmtDate(inv.due_on)}` : ""}
                      {` · ${PAYMENT_METHOD_LABELS[inv.method]}`}
                      {inv.phone ? ` · ${inv.phone}` : ""}
                    </div>
                  </div>
                  <div className="w-40 shrink-0 text-sm">
                    <div className="font-semibold">
                      {fmtVND(invoiceTotal(inv.items, Number(inv.discount)))}
                    </div>
                    {debt > 0 ? (
                      <span className="text-xs font-semibold text-rose-600">
                        Còn nợ {fmtVND(debt)}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600">Đã đóng đủ</span>
                    )}
                  </div>
                  <Badge
                    className="ml-auto shrink-0"
                    variant={status === "paid" ? "jade" : status === "partial" ? "gold" : "muted"}
                  >
                    {INVOICE_STATUS_LABELS[status]}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ Chi tiết gói: thanh toán, thu thêm, hủy ============ */

function PackageDetailModal({
  pkg,
  onClose,
  onChanged,
}: {
  pkg: PackageBalanceRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const payments = useLoad(() => fetchPackagePayments(pkg.id), [pkg.id]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debt, setDebt] = useState(Number(pkg.debt));

  async function handleCollect() {
    if (!user) return;
    const v = Number(amount);
    if (!v || v <= 0) return setError("Nhập số tiền thu.");
    if (v > debt) return setError(`Số tiền vượt quá công nợ hiện tại (${fmtVND(debt)}).`);
    setBusy(true);
    setError(null);
    try {
      await addPayment({
        package_id: pkg.id,
        student_id: pkg.student_id,
        amount: v,
        method,
        note: null,
        received_by: user.id,
      });
      setAmount("");
      setDebt((d) => d - v);
      payments.reload();
      onChanged();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (
      !confirm(
        `Hủy gói "${pkg.name}" của ${pkg.student_name}? Gói sẽ ngừng trừ buổi nhưng lịch sử thanh toán vẫn được giữ.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await cancelPackage(pkg.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${pkg.name} — ${pkg.student_name}`} className="max-w-2xl">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        {pkg.course_name && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Khóa học:</span>
            <span className="font-semibold">{pkg.course_name}</span>
            {pkg.course_level && (
              <Badge variant="default">{LEVEL_LABELS[pkg.course_level] ?? pkg.course_level}</Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-secondary/40 p-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Đã học</div>
            <div className="font-bold">{pkg.used_sessions}/{pkg.total_sessions} buổi</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Còn lại</div>
            <div className="mt-0.5"><RemainingBadge remaining={pkg.remaining_sessions} /></div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Giá sau ưu đãi</div>
            <div className="font-bold">{fmtVND(pkg.final_price)}</div>
            {Number(pkg.discount_total) > 0 && (
              <div className="text-xs text-muted-foreground">
                {fmtVND(pkg.price)} · ưu đãi {discountLabel(pkg)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Công nợ</div>
            <div className={cn("font-bold", debt > 0 ? "text-rose-600" : "text-emerald-600")}>
              {debt > 0 ? fmtVND(debt) : "Đã đóng đủ"}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-bold">Lịch sử thanh toán</div>
          {payments.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : (payments.data?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Chưa ghi nhận thanh toán nào cho gói này.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {payments.data!.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{p.receipt_no}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{fmtVND(p.amount)}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[p.method]} · {new Date(p.paid_at).toLocaleDateString("vi-VN")}
                    </span>
                  </span>
                  <Link href={`/admin/tuition/receipt/${p.id}`}>
                    <Button size="sm" variant="outline">
                      <Printer className="h-3.5 w-3.5" /> Biên lai
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {debt > 0 && (
          <div className="rounded-lg border bg-secondary/40 p-3">
            <div className="mb-2 text-sm font-bold">Thu thêm</div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Tối đa ${fmtVND(debt)}`}
                />
              </div>
              <div className="w-36">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                </Select>
              </div>
              <Button onClick={handleCollect} disabled={busy}>
                {busy ? "..." : "Thu tiền"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleCancel} disabled={busy} className="text-rose-600 hover:text-rose-700">
            <XCircle className="h-4 w-4" /> Hủy gói
          </Button>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}
