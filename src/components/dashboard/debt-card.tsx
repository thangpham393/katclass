"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th, useSort } from "@/components/ui/table-kit";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/db";
import { fmtVND, type PackageBalanceRow } from "@/lib/db-tuition";
import { SCROLL_10, SectionHead, daysBetween, dmy } from "./kit";

/** Gói bắt đầu quá chừng này ngày mà chưa đóng đủ thì tính là nợ quá hạn. */
export const DEBT_GRACE_DAYS = 14;

export interface OverdueDebt {
  id: string;
  studentId: string;
  name: string;
  code: string | null;
  pkg: string;
  start: string;
  paid: number;
  debt: number;
  days: number;
}

/** Gói còn nợ đã bắt đầu quá `DEBT_GRACE_DAYS` ngày. */
export function overdueDebts(balances: PackageBalanceRow[]): OverdueDebt[] {
  const today = todayISO();
  return balances
    .filter((b) => Number(b.debt) > 0 && daysBetween(b.start_date, today) > DEBT_GRACE_DAYS)
    .map((b) => ({
      id: b.id,
      studentId: b.student_id,
      name: b.student_name,
      code: b.student_code,
      pkg: b.name,
      start: b.start_date,
      paid: Number(b.paid_amount) || 0,
      debt: Number(b.debt) || 0,
      days: daysBetween(b.start_date, today),
    }));
}

export function DebtCard({
  rows,
  loading,
  error,
}: {
  rows: OverdueDebt[];
  loading: boolean;
  error: string | null;
}) {
  const sort = useSort(
    rows,
    {
      name: (r) => r.name,
      start: (r) => r.start,
      paid: (r) => r.paid,
      debt: (r) => r.debt,
    },
    ["debt", -1],
  );
  const total = useMemo(() => rows.reduce((s, r) => s + r.debt, 0), [rows]);

  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Công nợ quá hạn"
        desc={`Gói bắt đầu quá ${DEBT_GRACE_DAYS} ngày chưa đóng đủ — tổng ${fmtVND(total)}.`}
        action={
          <Link
            href="/admin/tuition"
            className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary"
          >
            Mở trang Học phí
          </Link>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading ? (
        <LoadingRows rows={2} />
      ) : (
        <div className={SCROLL_10}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10 border-b bg-card">
              <tr>
                <Th k="name" {...sort}>Học viên</Th>
                <Th k="start" {...sort}>Bắt đầu gói</Th>
                <Th k="paid" {...sort} align="right">Đã đóng</Th>
                <Th k="debt" {...sort} align="right">Còn nợ</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sort.sorted.length === 0 ? (
                <EmptyRow cols={4}>Không có khoản nợ quá hạn 🎉</EmptyRow>
              ) : (
                sort.sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className={TD}>
                      <Link href={`/admin/students/${r.studentId}`} className="font-semibold text-brand-600 hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.pkg}</div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap")}>
                      <div>{dmy(r.start)}</div>
                      <div className="mt-1">
                        <Pill tone={r.days > 30 ? "red" : "amber"}>{r.days} ngày</Pill>
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-right")}>{fmtVND(r.paid)}</td>
                    <td className={cn(TD, "whitespace-nowrap text-right font-semibold text-rose-600")}>
                      {fmtVND(r.debt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
