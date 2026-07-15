"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { fetchSessionsInRange, WEEKDAY_LABELS, type SessionRow } from "@/lib/db";
import { useLoad } from "@/lib/use-load";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tuần bắt đầu thứ 2; offset = số tuần lệch so với tuần hiện tại. */
function weekOf(offset: number): { days: Date[]; from: string; to: string } {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { days, from: isoDate(days[0]), to: isoDate(days[6]) };
}

export default function AdminTimetablePage() {
  const [offset, setOffset] = useState(0);
  const { days, from, to } = useMemo(() => weekOf(offset), [offset]);
  const sessions = useLoad(() => fetchSessionsInRange(from, to), [from, to]);

  const [roomId, setRoomId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const rooms = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions.data ?? []) if (s.room) map.set(s.room.id, s.room.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions.data]);
  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions.data ?? []) if (s.teacher) map.set(s.teacher.id, s.teacher.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions.data]);

  const filtered = useMemo(
    () =>
      (sessions.data ?? []).filter(
        (s) =>
          (!roomId || s.room?.id === roomId) &&
          (!teacherId || s.teacher?.id === teacherId),
      ),
    [sessions.data, roomId, teacherId],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    for (const s of filtered) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [filtered]);

  const todayIso = isoDate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Thời khóa biểu</h1>
          <p className="mt-1 text-muted-foreground">
            {sessions.loading
              ? "Đang tải..."
              : `Tuần ${days[0].toLocaleDateString("vi-VN")} – ${days[6].toLocaleDateString("vi-VN")} · ${filtered.length} buổi học.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)} title="Tuần trước">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={offset === 0 ? "secondary" : "outline"} onClick={() => setOffset(0)}>
            Tuần này
          </Button>
          <Button variant="outline" size="icon" onClick={() => setOffset((o) => o + 1)} title="Tuần sau">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sessions.error && <ErrorNote message={sessions.error} />}

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select className="w-44" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Mọi phòng</option>
            {rooms.map(([id, name]) => (
              <option key={id} value={id}>Phòng {name}</option>
            ))}
          </Select>
          <Select className="w-52" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Mọi giáo viên</option>
            {teachers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Sắp diễn ra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đã hoàn thành
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Đã hủy
            </span>
          </div>
        </div>
      </Card>

      {sessions.loading ? (
        <Card><LoadingRows rows={6} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={CalendarDays}
          title="Tuần này chưa có buổi học nào"
          description="Xác nhận lịch tuần cho các lớp rồi bấm “Sinh buổi học” trong trang chi tiết lớp — buổi học sẽ hiện lên đây."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {days.map((d) => {
            const iso = isoDate(d);
            const list = byDate.get(iso) ?? [];
            const isToday = iso === todayIso;
            return (
              <div key={iso} className="min-w-0">
                <div
                  className={cn(
                    "mb-2 rounded-lg px-3 py-1.5 text-center text-sm font-bold",
                    isToday ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {WEEKDAY_LABELS[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                      Trống
                    </div>
                  ) : (
                    list.map((s) => (
                      <Link
                        key={s.id}
                        href={`/admin/classes/${s.class?.id ?? s.class_id}`}
                        className={cn(
                          "block rounded-lg border-l-4 bg-card p-2.5 shadow-sm transition-shadow hover:shadow-soft",
                          s.status === "completed"
                            ? "border-l-emerald-500"
                            : s.status === "cancelled"
                              ? "border-l-muted-foreground/40 opacity-60"
                              : "border-l-brand-500",
                        )}
                      >
                        <div className="text-xs font-bold text-brand-700">
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 truncate text-sm font-semibold",
                            s.status === "cancelled" && "line-through",
                          )}
                          title={s.class?.name}
                        >
                          {s.class?.name ?? "?"}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {s.room ? `P.${s.room.name}` : "Chưa xếp phòng"}
                          {s.teacher ? ` · ${s.teacher.name}` : ""}
                        </div>
                        {s.type === "makeup" && (
                          <Badge variant="gold" className="mt-1">Buổi bù</Badge>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
