"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { Select } from "@/components/ui/select";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_LABELS,
  MAKEUP_STATUS_LABELS,
  WEEKDAY_LABELS,
  type AttendanceStatus,
} from "@/lib/db";
import { fetchAttendanceHistory, type AttendanceHistoryRow } from "@/lib/db-student";

const STATUS_ORDER: AttendanceStatus[] = ["present", "makeup", "absent_excused", "absent_unexcused"];

const STATUS_BADGE: Record<AttendanceStatus, "jade" | "gold" | "destructive" | "default"> = {
  present: "jade",
  absent_excused: "gold",
  absent_unexcused: "destructive",
  makeup: "default",
};

const DOT_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  makeup: "bg-sky-500",
  absent_excused: "bg-gold-400",
  absent_unexcused: "bg-rose-500",
};

const PAGE = 30;

function dateOf(iso: string) {
  return new Date(iso + "T00:00:00");
}

function shortDate(iso: string) {
  const d = dateOf(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dòng phụ dưới buổi: buổi vắng đã bù chưa / buổi bù là bù cho ngày nào. */
function makeupNote(r: AttendanceHistoryRow): string | null {
  if (r.status === "absent_excused") {
    if (!r.makeup) return "Chưa có quyền học bù";
    const s = r.makeup.session;
    if ((r.makeup.status === "scheduled" || r.makeup.status === "attended") && s) {
      return `${MAKEUP_STATUS_LABELS[r.makeup.status]} · ${shortDate(s.date)} ${s.start_time.slice(0, 5)}`;
    }
    return MAKEUP_STATUS_LABELS[r.makeup.status];
  }
  if (r.status === "makeup" && r.makeupFor) {
    return `Bù cho buổi ${shortDate(r.makeupFor.date)}${r.makeupFor.className ? ` (${r.makeupFor.className})` : ""}`;
  }
  return null;
}

/**
 * Lịch sử điểm danh TỪNG BUỔI của một học viên (hồ sơ học viên phía admin):
 * lọc theo trạng thái / lớp, nhóm theo tháng, kèm tình trạng học bù.
 */
export function AttendanceHistory({ studentId }: { studentId: string }) {
  const history = useLoad(() => fetchAttendanceHistory(studentId), [studentId]);
  const [status, setStatus] = useState<AttendanceStatus | "all">("all");
  const [classId, setClassId] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => history.data ?? [], [history.data]);

  // Mở từ dãy chấm ở danh sách học viên (…#diem-danh): thẻ tải sau trang nên
  // trình duyệt không tự cuộn tới được — cuộn tay khi dữ liệu về.
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!history.loading && window.location.hash === "#diem-danh") {
      anchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [history.loading]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const c = r.session?.class;
      map.set(c?.id ?? "none", c?.name ?? "Buổi bù riêng");
    }
    return [...map.entries()];
  }, [rows]);

  const byClass = useMemo(
    () => (classId === "all" ? rows : rows.filter((r) => (r.session?.class?.id ?? "none") === classId)),
    [rows, classId],
  );

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0 };
    for (const r of byClass) c[r.status]++;
    return c;
  }, [byClass]);

  const filtered = useMemo(
    () => (status === "all" ? byClass : byClass.filter((r) => r.status === status)),
    [byClass, status],
  );

  // Nhóm theo tháng, giữ thứ tự mới nhất trước
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: AttendanceHistoryRow[] }[] = [];
    for (const r of filtered.slice(0, limit)) {
      const key = r.session?.date.slice(0, 7) ?? "";
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const [y, m] = key.split("-");
        g = { key, label: key ? `Tháng ${Number(m)}/${y}` : "Không rõ ngày", items: [] };
        out.push(g);
      }
      g.items.push(r);
    }
    return out;
  }, [filtered, limit]);

  return (
    <div id="diem-danh" ref={anchor} className="scroll-mt-20">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4 text-brand-600" /> Lịch sử điểm danh
            {rows.length > 0 && <span className="text-sm font-normal text-muted-foreground">({rows.length} buổi)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {history.error ? (
            <ErrorNote message={history.error} />
          ) : history.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có lượt điểm danh nào.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStatus("all"); setLimit(PAGE); }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    status === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  Tất cả · {byClass.length}
                </button>
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setStatus(s); setLimit(PAGE); }}
                    disabled={counts[s] === 0}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                      status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", DOT_CLASS[s])} />
                    {ATTENDANCE_LABELS[s]} · {counts[s]}
                  </button>
                ))}
                {classes.length > 1 && (
                  <Select
                    value={classId}
                    onChange={(e) => { setClassId(e.target.value); setLimit(PAGE); }}
                    wrapClassName="w-full sm:ml-auto sm:w-56"
                    className="h-8 text-xs"
                  >
                    <option value="all">Tất cả lớp</option>
                    {classes.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </Select>
                )}
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Không có buổi nào khớp bộ lọc.
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </div>
                      <div className="divide-y rounded-xl border">
                        {g.items.map((r) => {
                          const s = r.session;
                          const sub = makeupNote(r);
                          return (
                            <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                              <div className="w-16 shrink-0">
                                <div className="font-semibold tabular-nums">{s ? shortDate(s.date) : "—"}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {s ? `${WEEKDAY_LABELS[dateOf(s.date).getDay()]} ${s.start_time.slice(0, 5)}` : ""}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{s?.class?.name ?? "Buổi bù riêng"}</div>
                                {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
                                {r.note && <div className="text-xs italic text-muted-foreground">“{r.note}”</div>}
                              </div>
                              <Badge variant={STATUS_BADGE[r.status]} className="shrink-0">
                                {ATTENDANCE_LABELS[r.status]}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filtered.length > limit && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((n) => n + PAGE)}>
                      Xem thêm ({filtered.length - limit} buổi)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
