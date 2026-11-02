"use client";

import Link from "next/link";
import { Cake, LogOut, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { Pill } from "@/components/ui/table-kit";
import { LEAVE_REASON_LABELS, type LeaveReason } from "@/lib/db-alumni";
import { todayISO } from "@/lib/db";
import { BIRTHDAY_DAYS, RETURN_SOON_DAYS, type RetentionData } from "@/lib/db-dashboard";
import { SCROLL_10, SectionHead, daysBetween, dmy } from "./kit";

function Group({
  icon: Icon,
  title,
  empty,
  children,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
        <span className="text-foreground">{count}</span>
      </div>
      {count === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <ul className="space-y-1.5">{children}</ul>}
    </div>
  );
}

/** Giữ chân học viên: ai vừa nghỉ, ai bảo lưu sắp quay lại, sinh nhật tuần này. */
export function RetentionCard({
  data,
  loading,
  error,
}: {
  data: RetentionData | null;
  loading: boolean;
  error: string | null;
}) {
  const today = todayISO();
  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Giữ chân học viên"
        desc="Ai vừa nghỉ (vì sao), ai bảo lưu sắp đến hẹn quay lại, sinh nhật để chúc."
        action={
          <Link
            href="/admin/alumni"
            className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-secondary"
          >
            Học viên đã nghỉ
          </Link>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading || !data ? (
        <LoadingRows rows={3} />
      ) : (
        <div className={`${SCROLL_10} divide-y`}>
          <Group icon={LogOut} title="Nghỉ học tháng này" empty="Chưa em nào nghỉ trong tháng 🎉" count={data.leftThisMonth.length}>
            {data.leftThisMonth.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/admin/students/${r.id}`} className="truncate font-semibold text-brand-600 hover:underline">
                  {r.name}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dmy(r.left_at)} ·{" "}
                  {r.left_reason ? LEAVE_REASON_LABELS[r.left_reason as LeaveReason] ?? r.left_reason : "Chưa ghi lý do"}
                </span>
              </li>
            ))}
          </Group>
          <Group
            icon={RotateCcw}
            title={`Bảo lưu hẹn quay lại trong ${RETURN_SOON_DAYS} ngày`}
            empty="Không có em bảo lưu nào sắp đến hẹn."
            count={data.returningSoon.length}
          >
            {data.returningSoon.map((r) => {
              const d = daysBetween(today, r.return_at);
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/students/${r.id}`} className="truncate font-semibold text-brand-600 hover:underline">
                    {r.name}
                  </Link>
                  <span className="shrink-0">
                    <Pill tone={d < 0 ? "red" : "blue"}>
                      {dmy(r.return_at)} · {d < 0 ? `quá hẹn ${-d} ngày` : d === 0 ? "hôm nay" : `còn ${d} ngày`}
                    </Pill>
                  </span>
                </li>
              );
            })}
          </Group>
          <Group icon={Cake} title={`Sinh nhật ${BIRTHDAY_DAYS} ngày tới`} empty="Không có sinh nhật nào." count={data.birthdays.length}>
            {data.birthdays.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/admin/students/${r.id}`} className="truncate font-semibold text-brand-600 hover:underline">
                  {r.name}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {r.nextDate === today ? "🎂 Hôm nay" : dmy(r.nextDate)} · {r.age} tuổi
                </span>
              </li>
            ))}
          </Group>
        </div>
      )}
    </Card>
  );
}
