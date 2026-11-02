"use client";

import Link from "next/link";
import {
  CalendarClock,
  CalendarX2,
  ClipboardX,
  FileClock,
  Package,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/loading";
import { EmptyRow, Pill, TD, Th } from "@/components/ui/table-kit";
import { cn } from "@/lib/utils";
import { GAP_DAYS, type GapSession } from "@/lib/db-dashboard";
import { SectionHead, dmy, hm, weekdayOf } from "./kit";

export interface ActionItem {
  key: string;
  label: string;
  hint: string;
  /** null = đang tải; undefined = vai trò không có quyền → ẩn ô. */
  count: number | null | undefined;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mức nghiêm trọng khi count > 0. */
  tone: "red" | "amber";
}

export const ACTION_ICONS = {
  gaps: CalendarX2,
  requests: FileClock,
  absences: UserX,
  makeup: CalendarClock,
  unmarked: ClipboardX,
  overLimit: Wallet,
  leads: UserPlus,
  supplies: Package,
};

/**
 * "Việc cần xử lý ngay": mỗi ô là một loại việc có số đếm và đường tắt tới
 * trang xử lý. Ô về 0 thì nhạt đi (vẫn để đó cho thấy đã kiểm tra), ô có việc
 * tô màu theo mức độ. Bên dưới liệt kê luôn các buổi sắp tới chưa có GV
 * vì đó là sự cố duy nhất có hạn chót cứng — học viên đến là phải có lớp.
 */
export function ActionItems({
  items,
  gaps,
  gapsLoading,
  gapsError,
}: {
  items: ActionItem[];
  gaps: GapSession[];
  gapsLoading: boolean;
  gapsError: string | null;
}) {
  const shown = items.filter((i) => i.count !== undefined);
  const open = shown.filter((i) => (i.count ?? 0) > 0).length;

  return (
    <Card className="overflow-hidden">
      <SectionHead
        title="Việc cần xử lý ngay"
        desc={open ? `${open} loại việc đang chờ — bấm vào ô để mở trang xử lý.` : "Mọi thứ đang ổn 🎉"}
      />
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {shown.map((i) => {
          const has = (i.count ?? 0) > 0;
          const Icon = i.icon;
          return (
            <Link
              key={i.key}
              href={i.href}
              className={cn(
                "flex items-start gap-3 bg-card p-4 transition-colors hover:bg-secondary/60",
                !has && i.count !== null && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  !has
                    ? "bg-muted text-muted-foreground"
                    : i.tone === "red"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-amber-100 text-amber-700",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-xl font-extrabold leading-none",
                    has && (i.tone === "red" ? "text-rose-600" : "text-amber-700"),
                  )}
                >
                  {i.count === null ? "…" : i.count}
                </div>
                <div className="mt-1 text-xs font-semibold leading-snug">{i.label}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{i.hint}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {gapsError && <ErrorNote message={gapsError} />}
      {!gapsLoading && gaps.length > 0 && (
        <div className="border-t">
          <div className="px-4 pt-3 text-xs font-semibold text-rose-600 sm:px-5">
            Buổi {GAP_DAYS} ngày tới chưa có giáo viên
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 z-10 border-b bg-card">
                <tr>
                  <Th>Ngày</Th>
                  <Th>Lớp</Th>
                  <Th>Giáo viên</Th>
                  <Th>Phòng</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {gaps.length === 0 ? (
                  <EmptyRow cols={4}>—</EmptyRow>
                ) : (
                  gaps.map((s) => (
                    <tr key={s.id} className="hover:bg-brand-50/40">
                      <td className={cn(TD, "whitespace-nowrap")}>
                        <div className="font-semibold">{dmy(s.date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {weekdayOf(s.date)} · {hm(s.start_time)} - {hm(s.end_time)}
                        </div>
                      </td>
                      <td className={TD}>
                        {s.class ? (
                          <Link href={`/admin/classes/${s.class.id}`} className="font-semibold text-brand-600 hover:underline">
                            {s.class.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">Buổi học bù</span>
                        )}
                      </td>
                      <td className={TD}>
                        <Pill tone="red">Chưa có GV</Pill>
                      </td>
                      <td className={TD}>{s.room?.name ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
