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
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { dbErrorMessage, fetchProfilesByRole, todayISO, type ProfileRow } from "@/lib/db";
import {
  addPayment,
  cancelPackage,
  createPackage,
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
          <h1 className="text-3xl font-extrabold tracking-tight">Học phí gói buổi</h1>
          <p className="mt-1 text-muted-foreground">
            Bán gói N buổi, thu tiền, xuất biên lai. Mỗi điểm danh (kể cả vắng) trừ 1 buổi — buổi học bù không trừ.
          </p>
        </div>
        <Button onClick={() => setSelling(true)}>
          <Plus className="h-4 w-4" /> Bán gói buổi
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Gói đang hoạt động" value={balances.loading ? "—" : rows.length} icon={Package} accent="brand" />
        <StatCard label="HV sắp hết buổi (≤3)" value={balances.loading ? "—" : lowStudents} icon={AlertTriangle} accent="gold" />
        <StatCard label="Tổng công nợ" value={balances.loading ? "—" : fmtVND(totalDebt)} icon={Wallet} accent="sky" />
        <StatCard label="Đã thu tháng này" value={monthTotal.data != null ? fmtVND(monthTotal.data) : "—"} icon={BadgeDollarSign} accent="jade" />
      </section>

      {balances.error && <ErrorNote message={balances.error} />}

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
            <div className="relative w-full max-w-xs">
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
        <CardContent className="p-5 pt-0">
          {balances.loading ? (
            <LoadingRows rows={5} className="p-0" />
          ) : visible.length === 0 ? (
            <Empty
              icon={Wallet}
              title={rows.length === 0 ? "Chưa bán gói buổi nào" : "Không có gói nào khớp bộ lọc"}
              description={
                rows.length === 0
                  ? "Bấm “Bán gói buổi” để tạo gói đầu tiên — số buổi còn lại sẽ tự trừ theo điểm danh."
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
                  <div className="w-32 shrink-0 text-sm">
                    <div className="font-semibold">
                      {r.used_sessions}/{r.total_sessions} buổi
                    </div>
                    <RemainingBadge remaining={r.remaining_sessions} />
                  </div>
                  <div className="w-40 shrink-0 text-sm">
                    <div className="font-semibold">{fmtVND(r.final_price)}</div>
                    {r.debt > 0 ? (
                      <span className="text-xs font-semibold text-rose-600">Còn nợ {fmtVND(r.debt)}</span>
                    ) : (
                      <span className="text-xs text-emerald-600">Đã đóng đủ</span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                    <Receipt className="h-3.5 w-3.5" /> Chi tiết
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selling && (
        <SellPackageModal
          onClose={() => setSelling(false)}
          onSaved={() => {
            setSelling(false);
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

/* ============ Bán gói mới (+ thu tiền ngay) ============ */

function SellPackageModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const students = useLoad(() => fetchProfilesByRole("student"));
  const [student, setStudent] = useState<ProfileRow | null>(null);
  const [q, setQ] = useState("");
  const [sessions, setSessions] = useState("12");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [startDate, setStartDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [collectNow, setCollectNow] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = students.data ?? [];
    if (!needle) return list.slice(0, 8);
    return list
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          (s.student_code ?? "").toLowerCase().includes(needle) ||
          (s.phone ?? "").includes(needle),
      )
      .slice(0, 8);
  }, [students.data, q]);

  const finalPrice = Math.max(0, (Number(price) || 0) - (Number(discount) || 0));

  async function handleSubmit() {
    if (!user) return;
    if (!student) return setError("Chọn học viên mua gói.");
    const n = Number(sessions);
    if (!Number.isInteger(n) || n <= 0) return setError("Số buổi phải là số nguyên dương.");
    if (!price || Number(price) < 0) return setError("Nhập giá gói.");
    if ((Number(discount) || 0) > Number(price)) return setError("Ưu đãi không được lớn hơn giá gói.");
    const collect = collectNow ? Number(amount || finalPrice) : 0;
    if (collectNow && (collect <= 0 || collect > finalPrice))
      return setError("Số tiền thu phải lớn hơn 0 và không vượt quá giá sau ưu đãi.");

    setBusy(true);
    setError(null);
    try {
      const packageId = await createPackage({
        student_id: student.id,
        name: `Gói ${n} buổi`,
        total_sessions: n,
        price: Number(price),
        discount: Number(discount) || 0,
        start_date: startDate,
        note: note.trim() || null,
        created_by: user.id,
      });
      if (collectNow && collect > 0) {
        const payment = await addPayment({
          package_id: packageId,
          student_id: student.id,
          amount: collect,
          method,
          note: null,
          received_by: user.id,
        });
        setReceiptId(payment.id);
      } else {
        onSaved();
      }
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Đã thu tiền xong → mời in biên lai
  if (receiptId) {
    return (
      <Modal open onClose={onSaved} title="Đã bán gói & thu tiền">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Gói buổi của <span className="font-semibold text-foreground">{student?.name}</span> đã được tạo
            và ghi nhận thanh toán. In biên lai cho phụ huynh/học viên?
          </p>
          <div className="flex justify-center gap-2">
            <Link href={`/admin/tuition/receipt/${receiptId}`}>
              <Button>
                <Printer className="h-4 w-4" /> In biên lai
              </Button>
            </Link>
            <Button variant="outline" onClick={onSaved}>Đóng</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Bán gói buổi" className="max-w-2xl">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}

        {student ? (
          <div className="flex items-center gap-3 rounded-lg border bg-brand-50/50 p-3">
            <Avatar name={student.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{student.name}</div>
              <div className="text-xs text-muted-foreground">
                {student.student_code} {student.phone && `· ${student.phone}`}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setStudent(null)}>Đổi</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm học viên theo tên, mã HV, SĐT..."
                className="pl-9"
                autoFocus
              />
            </div>
            {students.loading ? (
              <LoadingRows rows={3} className="p-0" />
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin">
                {candidates.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStudent(s)}
                    className="flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <Avatar name={s.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.student_code} {s.phone && `· ${s.phone}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Số buổi" required>
            <Input type="number" min={1} value={sessions} onChange={(e) => setSessions(e.target.value)} />
          </Field>
          <Field label="Giá gói (VND)" required>
            <Input type="number" min={0} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="vd: 3600000" />
          </Field>
          <Field label="Ưu đãi (VND)">
            <Input type="number" min={0} step={1000} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ngày kích hoạt" required hint="Điểm danh từ ngày này bắt đầu trừ buổi vào gói.">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: ưu đãi hè, học viên cũ..." />
          </Field>
        </div>

        <div className="rounded-lg border bg-secondary/40 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={collectNow}
              onChange={(e) => setCollectNow(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-brand-600"
            />
            Thu tiền ngay
          </label>
          {collectNow && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Số tiền thu (VND)" hint={`Giá sau ưu đãi: ${fmtVND(finalPrice)}`}>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(finalPrice || "")}
                />
              </Field>
              <Field label="Hình thức">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                </Select>
              </Field>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Đang lưu..." : collectNow ? "Bán gói & thu tiền" : "Bán gói (chưa thu)"}
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
            {Number(pkg.discount) > 0 && (
              <div className="text-xs text-muted-foreground">ưu đãi {fmtVND(pkg.discount)}</div>
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
