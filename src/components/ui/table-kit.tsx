"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bộ ghép bảng dữ liệu kiểu bảng điều khiển: tiêu đề cột bấm để sắp xếp
 * (tăng → giảm → bỏ), ô chuẩn, nhãn trạng thái có chấm màu, dòng trống.
 */

type SortValue = string | number | null;


export function useSort<T>(rows: T[], get: Record<string, (r: T) => SortValue>, initial?: [string, 1 | -1]) {
  const [sort, setSort] = useState<[string, 1 | -1] | null>(initial ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const [key, dir] = sort;
    const fn = get[key];
    if (!fn) return rows;
    return rows.slice().sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      if (va === vb) return 0;
      if (va === null) return 1; // ô trống luôn nằm cuối
      if (vb === null) return -1;
      const c = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "vi");
      return c * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort((cur) => (cur?.[0] === key ? (cur[1] === 1 ? [key, -1] : null) : [key, 1]));
  return { sorted, sort, toggle };
}

export function Th({
  children,
  k,
  sort,
  toggle,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  k?: string;
  sort?: [string, 1 | -1] | null;
  toggle?: (k: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = k && sort?.[0] === k;
  const Icon = !active ? ArrowUpDown : sort![1] === 1 ? ChevronUp : ChevronDown;
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {k && toggle ? (
        <button
          type="button"
          onClick={() => toggle(k)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {children}
          <Icon className="h-3 w-3 opacity-60" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export const TD = "px-4 py-3 align-middle";

export function Pill({
  tone,
  children,
  onClick,
}: {
  tone: "amber" | "red" | "green" | "blue" | "muted";
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls = {
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  const body = (
    <>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </>
  );
  const base = cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", cls);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, "hover:opacity-80")}>
      {body}
    </button>
  ) : (
    <span className={base}>{body}</span>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
