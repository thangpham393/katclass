"use client";

/**
 * TẠO HOÁ ĐƠN — một form duy nhất cho cả hai lối vào:
 *   • trang Học phí  → khách đã là học viên
 *   • trang Khách hàng tiềm năng → khách chưa ghi danh (gắn vào lead)
 *
 * Trước đây văn phòng phải làm hai thao tác rời: "bán gói buổi" ở trang
 * Học phí rồi lại "lập hoá đơn" ở trang Khách hàng — hai lần gõ cùng một
 * con số, và số buổi trên giấy có thể lệch với số buổi trong máy. Nay tờ
 * hoá đơn là mặt giấy, gói buổi là phần ruột: điền "Tổng số buổi" cho một
 * học viên thì hệ thống tự tạo gói tương ứng (`invoices.package_id`), tiền
 * "Đã thu" tự thành một biên lai in được.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Printer, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useBranch } from "@/components/shell/branch-provider";
import { cn } from "@/lib/utils";
import {
  dbErrorMessage,
  fetchCourses,
  fetchProfilesByRole,
  todayISO,
  LEVEL_LABELS,
  type CourseRow,
  type ProfileRow,
} from "@/lib/db";
import {
  createInvoice,
  fetchStudentParentName,
  invoiceTotal,
  lastBankInfo,
  lineTotal,
  nextInvoiceNo,
  type InvoiceItem,
} from "@/lib/db-invoices";
import { fetchTemplate, saveTemplate } from "@/lib/db-leads";
import { fetchSupplyItems, type SupplyItemRow } from "@/lib/db-supplies";
import {
  addPayment,
  createPackage,
  fmtVND,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/db-tuition";

const EMPTY_ITEM: InvoiceItem = { name: "", qty: 1, price: 0, course_id: null };

/** Khách của tờ hoá đơn: học viên đã ghi danh, hoặc một lead. */
export type InvoiceTarget =
  | { kind: "student"; student?: ProfileRow | null }
  | {
      kind: "lead";
      leadId: string;
      customerName: string;
      studentName: string | null;
      phone: string | null;
      studentId: string | null;
      branchId: string | null;
    };

/** Ngày kết thúc dự kiến = ngày bắt đầu + số tuần cần để học hết số buổi. */
function estimateEnd(start: string, sessions: number, perWeek: number): string {
  if (!start || sessions <= 0 || perWeek <= 0) return "";
  const days = Math.ceil((sessions / perWeek) * 7) - 1;
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InvoiceFormModal({
  target,
  onClose,
  onCreated,
}: {
  target: InvoiceTarget;
  onClose: () => void;
  /** Gọi sau khi tạo xong (đã đóng phần in biên lai). */
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const { branches, branchId: currentBranch } = useBranch();

  const [branchId, setBranchId] = useState(
    (target.kind === "lead" ? target.branchId : null) ?? currentBranch ?? "",
  );
  const [invoiceNo, setInvoiceNo] = useState("");
  const [student, setStudent] = useState<ProfileRow | null>(
    target.kind === "student" ? (target.student ?? null) : null,
  );
  const [students, setStudents] = useState<ProfileRow[]>([]);
  /** Người đứng tên tờ hoá đơn — điền sẵn từ liên kết gia đình, sửa được. */
  const [parentName, setParentName] = useState("");
  const [courses, setCourses] = useState<CourseRow[]>([]);
  /** Học cụ còn bán — chọn một dòng là điền sẵn tên và giá bán. */
  const [supplies, setSupplies] = useState<SupplyItemRow[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [issuedOn, setIssuedOn] = useState(todayISO());
  const [dueOn, setDueOn] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ ...EMPTY_ITEM }]);

  const [sessions, setSessions] = useState("");
  const [startDate, setStartDate] = useState("");
  const [perWeek, setPerWeek] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTouched, setEndTouched] = useState(false);

  const [note, setNote] = useState("");
  const [terms, setTerms] = useState("");
  const [termsSaved, setTermsSaved] = useState(false);
  const [bankInfo, setBankInfo] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  /* Số hoá đơn, nội quy, khoá học, danh sách học viên: nạp một lượt lúc mở. */
  useEffect(() => {
    let cancelled = false;
    const needStudents = target.kind === "student";
    Promise.all([
      nextInvoiceNo(),
      fetchTemplate("invoice_terms"),
      fetchCourses(),
      needStudents ? fetchProfilesByRole("student") : Promise.resolve([] as ProfileRow[]),
      fetchSupplyItems().catch(() => [] as SupplyItemRow[]),
    ])
      .then(([no, tpl, courseList, studentList, supplyList]) => {
        if (cancelled) return;
        setInvoiceNo(no);
        setTerms(tpl.body);
        setCourses(courseList);
        setStudents(studentList);
        setSupplies(supplyList.filter((s) => s.is_active));
      })
      .catch((err) => !cancelled && setError(dbErrorMessage(err)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Chọn học viên → điền sẵn tên phụ huynh từ liên kết gia đình. */
  useEffect(() => {
    if (target.kind !== "student" || !student) return;
    let cancelled = false;
    fetchStudentParentName(student.id)
      .then((name) => !cancelled && name && setParentName((cur) => cur || name))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [student, target.kind]);

  /* Thông tin chuyển khoản của tờ gần nhất — chỉ điền khi người dùng chưa gõ. */
  useEffect(() => {
    let cancelled = false;
    lastBankInfo(branchId || null)
      .then((info) => {
        if (!cancelled && info) setBankInfo((cur) => cur || info);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  /* Ngày kết thúc tự suy ra, trừ khi người dùng đã tự sửa. */
  useEffect(() => {
    if (endTouched) return;
    setEndDate(estimateEnd(startDate, Number(sessions) || 0, Number(perWeek) || 0));
  }, [startDate, sessions, perWeek, endTouched]);

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const discountNum = Number(discount) || 0;
  const total = invoiceTotal(items, discountNum);
  const paidNum = Number(paid) || 0;
  const debt = Math.max(0, total - paidNum);
  const sessionsNum = Number(sessions) || 0;

  const studentId = target.kind === "lead" ? target.studentId : (student?.id ?? null);
  /** Chỉ học viên đã có hồ sơ mới sinh được gói buổi. */
  const makesPackage = !!studentId && sessionsNum > 0;

  const candidates = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [students],
  );

  function patchItem(i: number, patch: Partial<InvoiceItem>) {
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  /**
   * Chọn khoá học hoặc học cụ → điền sẵn tên (và giá bán với học cụ, số
   * buổi chuẩn với khoá học). Mọi ô vẫn sửa tay được sau đó.
   *
   * Lựa chọn không được lưu riêng: khoá học nằm ở `course_id`, còn học cụ
   * nhận ra bằng tên dòng. Gõ đè lên tên thì ô chọn tự trả về trống —
   * đúng với sự thật là dòng đó không còn là mặt hàng trong kho nữa.
   */
  function pickLine(i: number, value: string) {
    const [type, id] = value.split(":");
    if (type === "supply") {
      const s = supplies.find((x) => x.id === id);
      if (!s) return;
      patchItem(i, { course_id: null, name: s.name, price: s.sale_price });
      return;
    }
    const c = courses.find((x) => x.id === id) ?? null;
    patchItem(i, { course_id: c?.id ?? null, name: c ? c.name : items[i].name });
    if (c && c.total_sessions > 0 && !sessions) setSessions(String(c.total_sessions));
  }

  function lineValue(it: InvoiceItem): string {
    if (it.course_id) return `course:${it.course_id}`;
    const s = supplies.find((x) => x.name === it.name.trim());
    return s ? `supply:${s.id}` : "";
  }

  async function handleSaveTerms() {
    try {
      await saveTemplate("invoice_terms", terms, user?.id ?? null);
      setTermsSaved(true);
      setTimeout(() => setTermsSaved(false), 2000);
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const filled = items.filter((i) => i.name.trim() || lineTotal(i) > 0);
    if (!branchId) return setError("Chọn trung tâm.");
    if (!invoiceNo.trim()) return setError("Nhập số hoá đơn.");
    if (target.kind === "student" && !student) return setError("Chọn học viên.");
    if (filled.length === 0) return setError("Thêm ít nhất một dòng nội dung.");
    if (discountNum > subtotal) return setError("Giảm giá không được lớn hơn tổng học phí.");
    if (paidNum > total) return setError("Số tiền đã thu không được lớn hơn tổng phải đóng.");

    setSaving(true);
    setError(null);
    try {
      /* 1. Gói buổi: chỉ khi khách đã là học viên và có số buổi */
      let packageId: string | null = null;
      if (makesPackage && studentId) {
        packageId = await createPackage({
          student_id: studentId,
          course_id: filled.find((i) => i.course_id)?.course_id ?? null,
          name: filled[0].name.trim() || `Gói ${sessionsNum} buổi`,
          total_sessions: sessionsNum,
          price: subtotal,
          discount_percent: 0,
          discount: discountNum,
          start_date: startDate || issuedOn,
          note: note.trim() || null,
          created_by: user.id,
        });
      }

      /* 2. Tờ hoá đơn */
      const customerName =
        target.kind === "lead"
          ? target.customerName
          : parentName.trim() || student?.name || "Khách hàng";
      const invoiceId = await createInvoice(
        {
          invoice_no: invoiceNo,
          branch_id: branchId,
          lead_id: target.kind === "lead" ? target.leadId : null,
          student_id: studentId,
          customer_name: customerName,
          student_name: target.kind === "lead" ? target.studentName : (student?.name ?? null),
          phone: target.kind === "lead" ? target.phone : (student?.phone ?? null),
          issued_on: issuedOn,
          due_on: dueOn || null,
          method,
          items: filled,
          discount: discountNum,
          paid_amount: paidNum,
          note,
          bank_info: bankInfo,
          terms,
          total_sessions: sessionsNum || null,
          start_date: startDate || null,
          sessions_per_week: Number(perWeek) || null,
          end_date: endDate || null,
          package_id: packageId,
        },
        user.id,
      );

      /* 3. Tiền đã thu → biên lai (chỉ ghi được khi có gói buổi) */
      if (packageId && paidNum > 0 && studentId) {
        const payment = await addPayment({
          package_id: packageId,
          student_id: studentId,
          invoice_id: invoiceId,
          amount: paidNum,
          method,
          note: `Hoá đơn ${invoiceNo}`,
          received_by: user.id,
        });
        setReceiptId(payment.id);
        setSaving(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  /* Đã thu tiền → mời in biên lai */
  if (receiptId) {
    return (
      <Modal open onClose={onCreated} title="Đã tạo hoá đơn & thu tiền">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Hoá đơn <span className="font-semibold text-foreground">{invoiceNo}</span> đã lập, gói
            buổi và biên lai thu tiền đã ghi nhận. In biên lai cho phụ huynh?
          </p>
          <div className="flex justify-center gap-2">
            <Link href={`/admin/tuition/receipt/${receiptId}`}>
              <Button>
                <Printer className="h-4 w-4" /> In biên lai
              </Button>
            </Link>
            <Button variant="outline" onClick={onCreated}>
              Đóng
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Tạo hoá đơn" className="sm:max-w-3xl">
      <form onSubmit={submit} className="space-y-5">
        {error && <ErrorNote message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trung tâm" required>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">—</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Số hoá đơn" required>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} required />
          </Field>

          {target.kind === "student" ? (
            <Field label="Học viên" required>
              <Select
                value={student?.id ?? ""}
                onChange={(e) =>
                  setStudent(candidates.find((s) => s.id === e.target.value) ?? null)
                }
                required
              >
                <option value="">Chọn học viên</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.student_code ? ` · ${s.student_code}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Khách hàng">
              <div className="flex items-center gap-2.5 rounded-lg border bg-secondary/40 px-3 py-2">
                <Avatar name={target.customerName} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{target.customerName}</div>
                  {target.studentName && (
                    <div className="truncate text-xs text-muted-foreground">
                      Học viên: {target.studentName}
                    </div>
                  )}
                </div>
              </div>
            </Field>
          )}
          {target.kind === "student" && (
            <Field label="Phụ huynh (người đứng tên)" hint="Để trống thì tờ hoá đơn đứng tên học viên.">
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Họ tên phụ huynh"
              />
            </Field>
          )}
          <Field label="Hình thức thanh toán">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ngày">
            <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
          </Field>
          <Field label="Hạn thanh toán">
            <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </Field>
        </div>

        {/* ---- Nội dung hoá đơn ---- */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">Thông tin học phí</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((cur) => [...cur, { ...EMPTY_ITEM }])}
            >
              <Plus className="h-3.5 w-3.5" /> Thêm dòng
            </Button>
          </div>

          <div className="mt-2 space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border bg-secondary/30 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    wrapClassName="min-w-0 flex-1 basis-56"
                    value={lineValue(it)}
                    onChange={(e) => pickLine(i, e.target.value)}
                  >
                    <option value="">Chọn khoá học / học cụ (tuỳ chọn)</option>
                    <optgroup label="Khoá học">
                      {courses.map((c) => (
                        <option key={c.id} value={`course:${c.id}`}>
                          {c.name}
                          {c.level ? ` — ${LEVEL_LABELS[c.level] ?? c.level}` : ""}
                        </option>
                      ))}
                    </optgroup>
                    {supplies.length > 0 && (
                      <optgroup label="Học cụ">
                        {supplies.map((s) => (
                          <option key={s.id} value={`supply:${s.id}`}>
                            {s.name} — {fmtVND(s.sale_price)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                  <Input
                    className="w-16"
                    type="number"
                    min={0}
                    value={it.qty}
                    onChange={(e) => patchItem(i, { qty: Number(e.target.value) })}
                    aria-label="Số lượng"
                  />
                  <Input
                    className="w-32"
                    type="number"
                    min={0}
                    step={1000}
                    value={it.price}
                    onChange={(e) => patchItem(i, { price: Number(e.target.value) })}
                    aria-label="Đơn giá"
                  />
                  <div className="ml-auto whitespace-nowrap text-sm font-semibold tabular-nums">
                    {fmtVND(lineTotal(it))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur))
                    }
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-destructive"
                    aria-label="Xoá dòng"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  className="mt-2"
                  placeholder="Mô tả / khoản mục"
                  value={it.name}
                  onChange={(e) => patchItem(i, { name: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ---- Kế hoạch học ---- */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Tổng số buổi"
            hint={
              target.kind === "student" && !makesPackage
                ? "Điền để tự tạo gói buổi cho học viên."
                : undefined
            }
          >
            <Input
              type="number"
              min={0}
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </Field>
          <Field label="Ngày bắt đầu">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Buổi/tuần">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={perWeek}
              onChange={(e) => setPerWeek(e.target.value)}
            />
          </Field>
          <Field label="Ngày kết thúc dự kiến" hint={endTouched ? undefined : "Tự tính"}>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndTouched(true);
                setEndDate(e.target.value);
              }}
            />
          </Field>
        </div>

        {/* ---- Ghi chú / mẫu in ---- và ---- Tổng tiền ---- */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Ghi chú">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Nội quy khoá học</span>
                <Button type="button" variant="outline" size="sm" onClick={handleSaveTerms}>
                  {termsSaved ? "Đã lưu" : "Lưu"}
                </Button>
              </div>
              <Textarea
                className="mt-1.5"
                rows={4}
                placeholder="Nội quy của trung tâm (tuỳ chọn) — sẽ hiển thị cuối hoá đơn"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Bấm “Lưu” để dùng lại nội quy này cho những hoá đơn sau.
              </p>
            </div>

            <Field label="Thông tin chuyển khoản" hint="Điền sẵn theo hoá đơn gần nhất của trung tâm.">
              <Textarea
                rows={3}
                placeholder={"Số tài khoản: ...\nTên tài khoản: ...\nNgân hàng: ..."}
                value={bankInfo}
                onChange={(e) => setBankInfo(e.target.value)}
              />
            </Field>
          </div>

          <div className="h-fit rounded-xl border bg-secondary/30 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Tổng học phí</span>
              <span className="font-semibold tabular-nums">{fmtVND(subtotal)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Giảm giá</span>
              <Input
                className="w-36 text-right"
                type="number"
                min={0}
                step={1000}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-base font-bold">
              <span>Tổng phải đóng</span>
              <span className="tabular-nums">{fmtVND(total)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Đã thu</span>
              <Input
                className="w-36 text-right"
                type="number"
                min={0}
                step={1000}
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div
              className={cn(
                "mt-3 flex items-center justify-between gap-3 border-t pt-3 font-bold",
                debt > 0 && "text-destructive",
              )}
            >
              <span>Công nợ</span>
              <span className="tabular-nums">{fmtVND(debt)}</span>
            </div>

            {makesPackage ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Hoá đơn này sẽ tạo gói {sessionsNum} buổi cho học viên — điểm danh trừ buổi từ ngày
                bắt đầu, tiền “Đã thu” ghi thành biên lai in được.
              </p>
            ) : (
              paidNum > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Chưa có “Tổng số buổi” nên tờ này không mở gói buổi và không có biên lai in — tiền
                  đã thu vẫn được tính vào doanh thu theo ngày ghi trên hoá đơn.
                </p>
              )
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang tạo..." : "Tạo hoá đơn"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
