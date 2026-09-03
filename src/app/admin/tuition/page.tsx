"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Check,
  FileDown,
  Package,
  Pencil,
  Plus,
  Printer,
  Receipt,
  ScrollText,
  Search,
  Share2,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { InvoiceFormModal } from "@/components/invoice-form";
import { sendNotification } from "@/lib/db-notifications";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import {
  dbErrorMessage,
  LEVEL_LABELS,
} from "@/lib/db";
import {
  deleteInvoice,
  fetchInvoices,
  invoiceDebt,
  lineTotal,
  setInvoicePaid,
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

type FilterTab = "all" | "low";

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
  // Hoá đơn nạp ở đây (không nằm trong khối con) vì ô "Tổng công nợ" phía
  // trên cũng đọc từ nó — tiền chỉ được phép có MỘT nguồn duy nhất.
  const invoices = useLoad(() => fetchInvoices());
  const [tab, setTab] = useState<FilterTab>("all");
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState(false);
  const [detail, setDetail] = useState<PackageBalanceRow | null>(null);

  const rows = balances.data ?? [];
  const lowRows = rows.filter((r) => r.remaining_sessions <= 3);
  const lowStudents = new Set(lowRows.map((r) => r.student_id)).size;
  const totalDebt = (invoices.data ?? []).reduce((s, r) => s + Math.max(0, invoiceDebt(r)), 0);

  const visible = useMemo(() => {
    let list = tab === "low" ? lowRows : rows;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (r) =>
          r.student_name.toLowerCase().includes(needle) ||
          (r.student_code ?? "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [rows, lowRows, tab, q]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Tất cả gói", count: rows.length },
    { key: "low", label: "Sắp hết buổi", count: lowRows.length },
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
        <StatCard label="Công nợ hoá đơn" value={invoices.loading ? "—" : fmtVND(totalDebt)} icon={Wallet} accent="sky" />
        <StatCard label="Đã thu tháng này" value={monthTotal.data != null ? fmtVND(monthTotal.data) : "—"} icon={BadgeDollarSign} accent="jade" />
      </section>

      {balances.error && <ErrorNote message={balances.error} />}

      <InvoicesCard
        rows={invoices.data ?? []}
        loading={invoices.loading}
        error={invoices.error}
        reload={invoices.reload}
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Gói buổi đang chạy</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Theo dõi số buổi còn lại của từng học viên để nhắc tái tục. Tiền nong nằm ở khối Hoá
              đơn phía trên — ở đây chỉ đếm buổi.
            </p>
          </div>
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
              icon={Package}
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
            invoices.reload();
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
 * Bảng hoá đơn (bảng `invoices`, migration 0033) — mỗi dòng là một tờ đã
 * gửi khách, kể cả khách hàng tiềm năng CHƯA phải học viên, nên không gộp
 * chung danh sách với gói buổi ở trên mà đứng riêng một khối.
 *
 * Cột "Công nợ" có nút chuông: còn nợ thì nhắc được ngay tại dòng đó, khỏi
 * phải nhớ tên rồi đi tìm học viên ở trang khác.
 */
function InvoicesCard({
  rows,
  loading,
  error: loadError,
  reload,
}: {
  rows: InvoiceRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [removing, setRemoving] = useState<InvoiceRow | null>(null);
  /** Id của tờ vừa chép / vừa nhắc — dùng để đổi biểu tượng trong 2 giây. */
  const [copied, setCopied] = useState<string | null>(null);
  const [notified, setNotified] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      `${r.invoice_no} ${r.customer_name} ${r.student_name ?? ""} ${r.phone ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  const totalDebt = rows.reduce((sum, r) => sum + Math.max(0, invoiceDebt(r)), 0);

  /** Nội dung tờ hoá đơn dạng chữ — dán thẳng vào Zalo cho phụ huynh. */
  async function copyInvoice(inv: InvoiceRow) {
    const lines = [
      `HOÁ ĐƠN ${inv.invoice_no} — ${fmtDate(inv.issued_on)}`,
      `Phụ huynh: ${inv.customer_name}`,
      inv.student_name ? `Học viên: ${inv.student_name}` : null,
      "",
      ...inv.items.map((it) => `• ${it.name} × ${it.qty} = ${fmtVND(lineTotal(it))}`),
      Number(inv.discount) > 0 ? `Giảm giá: ${fmtVND(Number(inv.discount))}` : null,
      `Tổng phải đóng: ${fmtVND(invoiceTotal(inv.items, Number(inv.discount)))}`,
      `Đã thu: ${fmtVND(Number(inv.paid_amount))}`,
      `Còn phải đóng: ${fmtVND(Math.max(0, invoiceDebt(inv)))}`,
      inv.due_on ? `Hạn đóng: ${fmtDate(inv.due_on)}` : null,
      inv.bank_info ? `\n${inv.bank_info}` : null,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(inv.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Trình duyệt không cho chép tự động — mở tờ hoá đơn rồi copy tay giúp mình.");
    }
  }

  /** Nhắc đóng học phí: thông báo in-app cho học viên (và phụ huynh qua liên kết). */
  async function remind(inv: InvoiceRow) {
    if (!inv.student_id) return;
    try {
      await sendNotification({
        recipient_id: inv.student_id,
        type: "generic",
        title: `Nhắc đóng học phí — hoá đơn ${inv.invoice_no}`,
        body: `Còn phải đóng ${fmtVND(Math.max(0, invoiceDebt(inv)))}${inv.due_on ? `, hạn ${fmtDate(inv.due_on)}` : ""}.`,
        link: "/student/tuition",
      });
      setNotified(inv.id);
      setTimeout(() => setNotified(null), 2000);
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await deleteInvoice(removing.id);
      setRemoving(null);
      reload();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

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
        {(loadError || error) && <ErrorNote message={loadError ?? error ?? ""} />}
        {loading ? (
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
          <div className="scroll-x">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Ngày tạo</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Số HĐ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Học viên</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Phụ huynh</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">SĐT</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Cần đóng</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Đã thu</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Công nợ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((inv) => {
                  const total = invoiceTotal(inv.items, Number(inv.discount));
                  const debt = Math.max(0, invoiceDebt(inv));
                  const status = invoiceStatus(inv);
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-secondary/30">
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                        {fmtDate(inv.issued_on)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Link
                          href={`/admin/tuition/invoice/${inv.id}`}
                          className="font-mono font-bold hover:text-brand-600 hover:underline"
                        >
                          {inv.invoice_no}
                        </Link>
                        <div className="text-xs font-normal text-muted-foreground">
                          {INVOICE_STATUS_LABELS[status]}
                          {inv.due_on ? ` · hạn ${fmtDate(inv.due_on)}` : ""}
                        </div>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5 font-medium">
                        {inv.student_name ?? "—"}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2.5">{inv.customer_name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                        {inv.phone ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {fmtVND(total)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {fmtVND(Number(inv.paid_amount))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={cn(
                              "tabular-nums",
                              debt > 0 ? "font-semibold text-rose-600" : "text-emerald-600",
                            )}
                          >
                            {fmtVND(debt)}
                          </span>
                          {debt > 0 && inv.student_id && (
                            <IconButton
                              label="Nhắc đóng học phí"
                              onClick={() => remind(inv)}
                              className={notified === inv.id ? "text-emerald-600" : undefined}
                            >
                              {notified === inv.id ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Bell className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton label="Chép nội dung gửi Zalo" onClick={() => copyInvoice(inv)}>
                            {copied === inv.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </IconButton>
                          <Link
                            href={`/admin/tuition/invoice/${inv.id}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label="In / lưu PDF"
                            title="In / lưu PDF"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Link>
                          <IconButton label="Sửa số tiền đã thu" onClick={() => setEditing(inv)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label="Xoá hoá đơn" onClick={() => setRemoving(inv)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                          {inv.student_id ? (
                            <Link
                              href={`/admin/members/${inv.student_id}`}
                              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                              aria-label="Mở hồ sơ học viên"
                              title="Mở hồ sơ học viên"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span className="grid h-8 w-8 place-items-center text-muted-foreground/40">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editing && (
        <CollectModal
          invoice={editing}
          userId={user?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xoá hoá đơn?">
        <p className="text-sm text-muted-foreground">
          Xoá tờ <span className="font-semibold text-foreground">{removing?.invoice_no}</span>.
          {removing?.package_id
            ? " Gói buổi và biên lai đã tạo từ tờ này KHÔNG bị xoá — muốn bỏ gói thì hủy ở phần Chi tiết gói."
            : ""}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoving(null)}>
            Hủy
          </Button>
          <Button variant="destructive" onClick={remove}>
            Xoá
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

/** Nút biểu tượng vuông trong bảng — gom lại cho mọi nút bằng nhau. */
function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ============ Sửa số tiền đã thu của hoá đơn ============ */

/**
 * "Đã thu" là TỔNG số tiền của tờ này, nên ô này ghi đè chứ không cộng
 * dồn: gõ 2.500.000 nghĩa là tổng đã thu bằng 2.5 triệu. Hoá đơn có gói
 * buổi thì `setInvoicePaid` sửa luôn dòng biên lai tương ứng, doanh thu
 * đổi theo ngay chứ không sinh thêm một khoản thu mới.
 */
function CollectModal({
  invoice,
  userId,
  onClose,
  onSaved,
}: {
  invoice: InvoiceRow;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const total = invoiceTotal(invoice.items, Number(invoice.discount));
  const [paid, setPaid] = useState(String(Number(invoice.paid_amount) || 0));
  const [method, setMethod] = useState<PaymentMethod>(invoice.method);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidNum = Math.max(0, Number(paid) || 0);
  const debt = Math.max(0, total - paidNum);

  async function save() {
    if (paidNum > total) return setError("Đã thu không được lớn hơn tổng phải đóng.");
    setBusy(true);
    setError(null);
    try {
      await setInvoicePaid(invoice, paidNum, method, userId);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Thu tiền — hoá đơn ${invoice.invoice_no}`}>
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        <dl className="rounded-xl border bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tổng phải đóng</dt>
            <dd className="font-semibold tabular-nums">{fmtVND(total)}</dd>
          </div>
          <div className="mt-1.5 flex justify-between">
            <dt className="text-muted-foreground">Đang ghi nhận</dt>
            <dd className="tabular-nums">{fmtVND(Number(invoice.paid_amount))}</dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Đã thu (tổng, VND)" required hint="Ghi đè con số cũ, không cộng dồn.">
            <Input
              type="number"
              min={0}
              step={1000}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Hình thức">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Còn phải đóng</span>
          <span className={cn("font-bold tabular-nums", debt > 0 && "text-rose-600")}>
            {fmtVND(debt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {invoice.package_id
            ? "Hoá đơn này có gói buổi — số tiền trên sẽ ghi đè biên lai đã ghi và doanh thu đổi theo."
            : "Hoá đơn chưa gắn gói buổi: sửa con số này là doanh thu đổi theo ngay (tính theo ngày ghi trên hoá đơn), nhưng không có biên lai in."}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>
    </Modal>
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

        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Chỗ thu tiền chính là ô “Đã thu” của hoá đơn. Ô bên dưới dành cho khoản thu KHÔNG đi kèm
          hoá đơn (gói cũ, thu bù tại quầy) — nó cộng thêm một biên lai mới chứ không sửa tờ nào.
        </p>

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
