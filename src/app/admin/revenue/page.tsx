"use client";

/**
 * DOANH THU — CHI PHÍ — LỢI NHUẬN.
 *
 * Ba tab nhưng chỉ MỘT lần tải dữ liệu: cả năm đang chọn và cả năm trước
 * (để so cùng kỳ) được nạp một lượt rồi lọc/cộng ở máy khách. Một năm của
 * trung tâm cỡ vài nghìn dòng tiền — nhẹ hơn nhiều so với việc mỗi lần đổi
 * tháng lại đi hỏi database, mà đổi bộ lọc thì hiện ra tức thì.
 *
 * Học phí KHÔNG nhập tay ở đây: nó chảy sang từ biên lai thu tiền (trang Hóa
 * đơn / gói buổi). Nhập tay chỉ dành cho khoản thu ngoài học phí và chi phí.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatTile } from "@/components/ui/stat-tile";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { BarChart, shortMoney } from "@/components/ui/bar-chart";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { dbErrorMessage, todayISO } from "@/lib/db";
import {
  fetchPackageBalances,
  fmtVND,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/db-tuition";
import {
  categoryLabel,
  categoryOptions,
  createFinanceEntry,
  deleteFinanceEntry,
  downloadCSV,
  fetchExpenseRows,
  fetchRevenueRows,
  periodRange,
  sumAmount,
  sumByCategory,
  sumByDay,
  sumByMonth,
  updateFinanceEntry,
  type FinanceKind,
  type MoneyRow,
} from "@/lib/db-finance";

/** Bảng màu đã chạy qua kiểm tra tương phản + mù màu. */
const COLOR = {
  tuition: "#2549ec", // xanh KAT — học phí
  other: "#0f9d70", // xanh ngọc — khoản thu khác
  expense: "#dc2626", // đỏ KAT — chi phí
};

type Tab = "revenue" | "expense" | "profit";

const MONTH_SHORT = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}

/** Chênh lệch so với kỳ đối chiếu, dạng “+18%”. Null khi kỳ trước bằng 0. */
function deltaPct(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

export default function RevenuePage() {
  const { user, can } = useAuth();
  const editable = can("tuition.manage");
  const thisYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>("revenue");
  const [year, setYear] = useState(thisYear);
  /** 0 = cả năm. */
  const [month, setMonth] = useState(0);
  const [category, setCategory] = useState("");
  const [dialog, setDialog] = useState<{ kind: FinanceKind; row: MoneyRow | null } | null>(null);
  const [removing, setRemoving] = useState<MoneyRow | null>(null);

  const money = useLoad(async () => {
    const cur = periodRange(year, 0);
    const prev = periodRange(year - 1, 0);
    const [revenue, expense, revenuePrev, expensePrev] = await Promise.all([
      fetchRevenueRows(cur.from, cur.to),
      fetchExpenseRows(cur.from, cur.to),
      fetchRevenueRows(prev.from, prev.to),
      fetchExpenseRows(prev.from, prev.to),
    ]);
    return { revenue, expense, revenuePrev, expensePrev };
  }, [year]);

  // Công nợ là ảnh chụp tại thời điểm hiện tại (tiền còn thiếu của mọi gói
  // đang chạy), không thuộc về tháng nào nên đứng ngoài bộ lọc kỳ.
  const debt = useLoad(async () => {
    const rows = await fetchPackageBalances();
    return rows.reduce((s, r) => s + (Number(r.debt) || 0), 0);
  }, []);

  const inPeriod = useMemo(() => {
    const { from, to } = periodRange(year, month);
    const pick = (rows: MoneyRow[]) => rows.filter((r) => r.date >= from && r.date <= to);
    const prevRange = periodRange(year - 1, month);
    const pickPrev = (rows: MoneyRow[]) =>
      rows.filter((r) => r.date >= prevRange.from && r.date <= prevRange.to);
    const d = money.data;
    return {
      revenue: pick(d?.revenue ?? []),
      expense: pick(d?.expense ?? []),
      revenuePrev: pickPrev(d?.revenuePrev ?? []),
      expensePrev: pickPrev(d?.expensePrev ?? []),
    };
  }, [money.data, year, month]);

  const revenueTotal = sumAmount(inPeriod.revenue);
  const expenseTotal = sumAmount(inPeriod.expense);
  const profit = revenueTotal - expenseTotal;
  const tuitionTotal = sumAmount(inPeriod.revenue.filter((r) => r.category === "tuition"));
  const otherRevenue = revenueTotal - tuitionTotal;

  const revenueDelta = deltaPct(revenueTotal, sumAmount(inPeriod.revenuePrev));
  const expenseDelta = deltaPct(expenseTotal, sumAmount(inPeriod.expensePrev));

  /* ---- Bảng đang xem: lọc thêm theo nhóm ---- */
  const listRows = useMemo(() => {
    const base = tab === "expense" ? inPeriod.expense : inPeriod.revenue;
    const rows = category ? base.filter((r) => r.category === category) : base;
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [tab, category, inPeriod]);

  /* ---- Dữ liệu biểu đồ: cả năm → theo tháng, chọn tháng → theo ngày ---- */
  const chart = useMemo(() => {
    const byBucket = (rows: MoneyRow[]) =>
      month ? sumByDay(rows, year, month) : sumByMonth(rows, year);
    const labels = month
      ? Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => String(i + 1))
      : MONTH_SHORT;
    return {
      labels,
      tuition: byBucket(inPeriod.revenue.filter((r) => r.category === "tuition")),
      otherRevenue: byBucket(inPeriod.revenue.filter((r) => r.category !== "tuition")),
      revenue: byBucket(inPeriod.revenue),
      expense: byBucket(inPeriod.expense),
    };
  }, [inPeriod, year, month]);

  /** Bảng lợi nhuận từng tháng của năm — thứ kế toán cần nhìn một lượt. */
  const monthlyProfit = useMemo(() => {
    const rev = sumByMonth(money.data?.revenue ?? [], year);
    const exp = sumByMonth(money.data?.expense ?? [], year);
    return rev.map((r, i) => ({ month: i + 1, revenue: r, expense: exp[i], profit: r - exp[i] }));
  }, [money.data, year]);

  const periodLabel = month ? `tháng ${month}/${year}` : `năm ${year}`;

  function exportCSV() {
    if (tab === "profit") {
      downloadCSV(
        `loi-nhuan-${year}.csv`,
        ["Tháng", "Doanh thu", "Chi phí", "Lợi nhuận"],
        monthlyProfit.map((m) => [`${m.month}/${year}`, m.revenue, m.expense, m.profit]),
      );
      return;
    }
    downloadCSV(
      `${tab === "expense" ? "chi-phi" : "doanh-thu"}-${month ? `${month}-` : ""}${year}.csv`,
      ["Ngày", "Nhóm", "Diễn giải", "Phương thức", "Số tiền"],
      listRows.map((r) => [
        fmtDate(r.date),
        categoryLabel(r.kind, r.category),
        [r.title, r.subtitle].filter(Boolean).join(" — "),
        PAYMENT_METHOD_LABELS[r.method],
        r.amount,
      ]),
    );
  }

  async function remove() {
    if (!removing) return;
    await deleteFinanceEntry(removing.id);
    setRemoving(null);
    money.reload();
  }

  const loading = money.loading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Doanh thu</h1>
        <p className="mt-1 text-muted-foreground">
          Tiền vào — tiền ra — còn lại bao nhiêu. Học phí tự chảy sang từ biên lai thu tiền; ở đây
          chỉ nhập tay khoản thu ngoài học phí và chi phí.
        </p>
      </div>

      {/* Mobile: dải tab tự cuộn ngang thay vì tràn ra ngoài màn hình */}
      <div className="scroll-x">
        <div className="flex w-fit rounded-lg border bg-secondary/40 p-0.5">
          {(
            [
              { key: "revenue", label: "Doanh thu" },
              { key: "expense", label: "Chi phí" },
              { key: "profit", label: "Lợi nhuận" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setCategory("");
              }}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-semibold transition-colors sm:px-4 sm:py-1.5 sm:text-sm",
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bộ lọc kỳ — một hàng, nằm trên mọi biểu đồ và bảng */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:flex sm:flex-wrap sm:items-end sm:p-5">
          <Field label="Năm">
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              wrapClassName="sm:w-32"
            >
              {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tháng">
            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              wrapClassName="sm:w-36"
            >
              <option value={0}>Cả năm</option>
              {MONTH_SHORT.map((_, i) => (
                <option key={i} value={i + 1}>
                  Tháng {i + 1}
                </option>
              ))}
            </Select>
          </Field>
          {tab !== "profit" && (
            <Field label="Nhóm">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                wrapClassName="sm:w-48"
              >
                <option value="">Tất cả</option>
                {tab === "revenue" && <option value="tuition">Học phí</option>}
                {categoryOptions(tab === "expense" ? "expense" : "revenue").map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="col-span-2 flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" onClick={exportCSV} disabled={loading}>
              <Download className="h-4 w-4" /> Xuất Excel
            </Button>
            {editable && tab !== "profit" && (
              <Button
                onClick={() => setDialog({ kind: tab === "expense" ? "expense" : "revenue", row: null })}
              >
                <Plus className="h-4 w-4" />
                {tab === "expense" ? "Thêm chi phí" : "Thêm khoản thu"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {money.error && <ErrorNote message={money.error} />}

      {/* ---- Ô số liệu ---- */}
      {tab === "revenue" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={`Doanh thu ${periodLabel}`}
            value={loading ? "…" : fmtVND(revenueTotal)}
            valueClassName="text-xl sm:text-2xl"
            hint={`Học phí ${shortMoney(tuitionTotal)} · Khác ${shortMoney(otherRevenue)}`}
            icon={Wallet}
            tone="brand"
          />
          <StatTile
            label={`So với ${month ? `tháng ${month}/` : ""}${year - 1}`}
            value={loading ? "…" : revenueDelta === null ? "—" : `${revenueDelta > 0 ? "+" : ""}${revenueDelta}%`}
            hint={`Kỳ trước ${shortMoney(sumAmount(inPeriod.revenuePrev))}`}
            icon={revenueDelta !== null && revenueDelta < 0 ? TrendingDown : TrendingUp}
            tone={revenueDelta !== null && revenueDelta < 0 ? "gold" : "jade"}
          />
          <StatTile
            label="Số lần thu"
            value={loading ? "…" : String(inPeriod.revenue.length)}
            hint={`Học phí ${inPeriod.revenue.filter((r) => r.category === "tuition").length} lần`}
            icon={Receipt}
          />
          <StatTile
            label="Công nợ còn lại"
            value={debt.loading ? "…" : fmtVND(debt.data ?? 0)}
            valueClassName="text-xl sm:text-2xl"
            hint="Tiền học phí chưa thu, tính đến hôm nay"
            icon={TrendingDown}
            tone="gold"
          />
        </div>
      )}

      {tab === "expense" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={`Chi phí ${periodLabel}`}
            value={loading ? "…" : fmtVND(expenseTotal)}
            valueClassName="text-xl sm:text-2xl"
            icon={TrendingDown}
            tone="gold"
          />
          <StatTile
            label={`So với ${month ? `tháng ${month}/` : ""}${year - 1}`}
            value={loading ? "…" : expenseDelta === null ? "—" : `${expenseDelta > 0 ? "+" : ""}${expenseDelta}%`}
            hint={`Kỳ trước ${shortMoney(sumAmount(inPeriod.expensePrev))}`}
            icon={expenseDelta !== null && expenseDelta > 0 ? TrendingUp : TrendingDown}
            tone={expenseDelta !== null && expenseDelta > 0 ? "gold" : "jade"}
          />
          <StatTile
            label="Nhóm chi lớn nhất"
            value={
              loading
                ? "…"
                : sumByCategory(inPeriod.expense)[0]
                  ? categoryLabel("expense", sumByCategory(inPeriod.expense)[0].category)
                  : "—"
            }
            valueClassName="text-lg sm:text-xl"
            hint={
              sumByCategory(inPeriod.expense)[0]
                ? shortMoney(sumByCategory(inPeriod.expense)[0].amount)
                : undefined
            }
          />
          <StatTile
            label="Số khoản chi"
            value={loading ? "…" : String(inPeriod.expense.length)}
            icon={Receipt}
          />
        </div>
      )}

      {tab === "profit" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={`Doanh thu ${periodLabel}`}
            value={loading ? "…" : fmtVND(revenueTotal)}
            valueClassName="text-xl sm:text-2xl"
            icon={TrendingUp}
            tone="brand"
          />
          <StatTile
            label={`Chi phí ${periodLabel}`}
            value={loading ? "…" : fmtVND(expenseTotal)}
            valueClassName="text-xl sm:text-2xl"
            icon={TrendingDown}
            tone="gold"
          />
          <StatTile
            label="Lợi nhuận"
            value={loading ? "…" : fmtVND(profit)}
            valueClassName={cn("text-xl sm:text-2xl", profit < 0 && "text-gold-600")}
            icon={Wallet}
            tone={profit < 0 ? "gold" : "jade"}
          />
          <StatTile
            label="Biên lợi nhuận"
            value={loading ? "…" : revenueTotal ? `${Math.round((profit / revenueTotal) * 100)}%` : "—"}
            hint="Lợi nhuận / doanh thu"
            tone={profit < 0 ? "gold" : "jade"}
          />
        </div>
      )}

      {/* ---- Biểu đồ ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            {tab === "expense" ? "Chi phí" : tab === "profit" ? "Doanh thu và chi phí" : "Doanh thu"}{" "}
            {month ? `theo ngày (tháng ${month}/${year})` : `theo tháng (${year})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <LoadingRows rows={4} />
          ) : (
            <BarChart
              labels={chart.labels}
              stacked={tab === "revenue"}
              format={fmtVND}
              series={
                tab === "revenue"
                  ? [
                      { label: "Học phí", color: COLOR.tuition, values: chart.tuition },
                      { label: "Khoản thu khác", color: COLOR.other, values: chart.otherRevenue },
                    ]
                  : tab === "expense"
                    ? [{ label: "Chi phí", color: COLOR.expense, values: chart.expense }]
                    : [
                        { label: "Doanh thu", color: COLOR.tuition, values: chart.revenue },
                        { label: "Chi phí", color: COLOR.expense, values: chart.expense },
                      ]
              }
            />
          )}
        </CardContent>
      </Card>

      {/* ---- Cơ cấu theo nhóm ---- */}
      {tab !== "profit" && !loading && (
        <CategoryBreakdown
          kind={tab === "expense" ? "expense" : "revenue"}
          rows={tab === "expense" ? inPeriod.expense : inPeriod.revenue}
          onPick={setCategory}
          active={category}
        />
      )}

      {/* ---- Bảng chi tiết ---- */}
      {tab === "profit" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Lợi nhuận từng tháng ({year})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <LoadingRows rows={5} />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.04em] text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Tháng</th>
                      <th className="py-2 pr-3 text-right font-semibold">Doanh thu</th>
                      <th className="py-2 pr-3 text-right font-semibold">Chi phí</th>
                      <th className="py-2 pr-3 text-right font-semibold">Lợi nhuận</th>
                      <th className="py-2 text-right font-semibold">Biên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyProfit.map((m) => (
                      <tr key={m.month} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">Tháng {m.month}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtVND(m.revenue)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtVND(m.expense)}</td>
                        <td
                          className={cn(
                            "py-2 pr-3 text-right font-semibold tabular-nums",
                            m.profit < 0 ? "text-gold-600" : "text-jade-600",
                          )}
                        >
                          {fmtVND(m.profit)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {m.revenue ? `${Math.round((m.profit / m.revenue) * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2">
                      <td className="py-2 pr-3 font-bold">Cả năm</td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums">
                        {fmtVND(sumAmount(money.data?.revenue ?? []))}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums">
                        {fmtVND(sumAmount(money.data?.expense ?? []))}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold tabular-nums">
                        {fmtVND(
                          sumAmount(money.data?.revenue ?? []) - sumAmount(money.data?.expense ?? []),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              {tab === "expense" ? "Các khoản chi" : "Các khoản thu"} · {listRows.length} dòng
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <LoadingRows rows={5} />
            ) : listRows.length === 0 ? (
              <Empty
                icon={Receipt}
                title={tab === "expense" ? "Chưa có khoản chi nào" : "Chưa có khoản thu nào"}
                description={
                  tab === "expense"
                    ? `Chưa ghi chi phí nào trong ${periodLabel}.`
                    : `Chưa có tiền vào trong ${periodLabel}. Học phí thu ở trang Hóa đơn sẽ tự hiện ở đây.`
                }
                action={
                  tab === "revenue" ? (
                    <Link
                      href="/admin/tuition"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600"
                    >
                      Sang trang Hóa đơn <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.04em] text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Ngày</th>
                      <th className="py-2 pr-3 font-semibold">Diễn giải</th>
                      <th className="py-2 pr-3 font-semibold">Nhóm</th>
                      <th className="py-2 pr-3 font-semibold">Phương thức</th>
                      <th className="py-2 pr-3 text-right font-semibold">Số tiền</th>
                      <th className="w-20 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {listRows.map((r) => (
                      <tr key={r.source + r.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">
                          {fmtDate(r.date)}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.title}</div>
                          {r.subtitle && (
                            <div className="text-xs text-muted-foreground">{r.subtitle}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
                              r.category === "tuition"
                                ? "bg-brand-50 text-brand-700"
                                : "bg-secondary text-muted-foreground",
                            )}
                          >
                            {categoryLabel(r.kind, r.category)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[r.method]}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap py-2 pr-3 text-right font-semibold tabular-nums",
                            r.kind === "expense" ? "text-gold-600" : "text-foreground",
                          )}
                        >
                          {r.kind === "expense" ? "−" : ""}
                          {fmtVND(r.amount)}
                        </td>
                        <td className="py-2 text-right">
                          {/* Biên lai học phí sửa ở trang Hóa đơn — ở đây chỉ đọc */}
                          {editable && r.source === "entry" && (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setDialog({ kind: r.kind, row: r })}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setRemoving(r)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                                aria-label="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {dialog && (
        <EntryForm
          kind={dialog.kind}
          row={dialog.row}
          userId={user?.id ?? null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            money.reload();
          }}
        />
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Xóa khoản này?">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{removing?.title}</span> —{" "}
            {removing ? fmtVND(removing.amount) : ""}. Xóa rồi không lấy lại được.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={remove}>
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Cơ cấu theo nhóm ---------------- */

function CategoryBreakdown({
  kind,
  rows,
  onPick,
  active,
}: {
  kind: FinanceKind;
  rows: MoneyRow[];
  onPick: (c: string) => void;
  active: string;
}) {
  const groups = sumByCategory(rows);
  const total = sumAmount(rows);
  if (!groups.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{kind === "expense" ? "Chi theo nhóm" : "Thu theo nhóm"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2.5 pt-0 sm:grid-cols-2">
        {groups.map((g) => {
          const share = total ? Math.round((g.amount / total) * 100) : 0;
          const color =
            kind === "expense" ? COLOR.expense : g.category === "tuition" ? COLOR.tuition : COLOR.other;
          return (
            <button
              key={g.category}
              onClick={() => onPick(active === g.category ? "" : g.category)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-secondary/60",
                active === g.category && "border-brand-300 bg-secondary/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{categoryLabel(kind, g.category)}</span>
                <span className="text-sm font-semibold tabular-nums">{fmtVND(g.amount)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {share}%
                </span>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---------------- Nhập / sửa một khoản ---------------- */

function EntryForm({
  kind,
  row,
  userId,
  onClose,
  onSaved,
}: {
  kind: FinanceKind;
  row: MoneyRow | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const options = categoryOptions(kind);
  const [title, setTitle] = useState(row?.title ?? "");
  const [category, setCategory] = useState(row?.category ?? options[0].key);
  const [amount, setAmount] = useState(row ? String(row.amount) : "");
  const [date, setDate] = useState(row?.date ?? todayISO());
  const [method, setMethod] = useState<PaymentMethod>(row?.method ?? "cash");
  const [note, setNote] = useState(row?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Math.round(Number(amount.replace(/[^\d]/g, "")) || 0);
  const valid = title.trim().length > 0 && value > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        kind,
        category,
        amount: value,
        occurred_on: date,
        method,
        title,
        note,
      };
      if (row) await updateFinanceEntry(row.id, input);
      else await createFinanceEntry(input, userId);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        row
          ? "Sửa khoản " + (kind === "expense" ? "chi" : "thu")
          : kind === "expense"
            ? "Thêm chi phí"
            : "Thêm khoản thu"
      }
    >
      <div className="space-y-4">
        {kind === "revenue" && (
          <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            Chỉ nhập khoản thu NGOÀI học phí (bán sách, học cụ, lệ phí thi…). Học phí thu ở trang
            Hóa đơn sẽ tự hiện trong doanh thu.
          </p>
        )}
        <Field label="Diễn giải" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "expense" ? "Tiền thuê mặt bằng tháng 9" : "Bán 5 bộ giáo trình HSK 3"}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhóm" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Số tiền (₫)" required hint={value > 0 ? fmtVND(value) : undefined}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
          </Field>
          <Field label="Ngày" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Phương thức">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-gold-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} disabled={!valid || saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
