"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  GraduationCap,
  School,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { fetchSessionsInRange, LEVEL_LABELS, WEEKDAY_LABELS, type SessionRow } from "@/lib/db";
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

/** "HH:MM[:SS]" → số phút từ 0h. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Buổi trong ngày: Sáng < 12h ≤ Chiều < 17h30 ≤ Tối. */
function daypartOf(t: string): "morning" | "afternoon" | "evening" {
  const m = toMinutes(t);
  if (m < 12 * 60) return "morning";
  if (m < 17 * 60 + 30) return "afternoon";
  return "evening";
}

const DAYPART_LABELS = { morning: "Sáng", afternoon: "Chiều", evening: "Tối" } as const;

/** Màu khối buổi học theo trạng thái (viền trái + nền nhạt). */
function sessionTone(s: SessionRow): string {
  if (s.status === "cancelled") return "border-l-ink-300 bg-muted/60 opacity-60";
  if (s.status === "completed") return "border-l-emerald-500 bg-emerald-50/70";
  if (s.type === "makeup") return "border-l-gold-500 bg-gold-50/70";
  return "border-l-brand-500 bg-brand-50/60";
}

export default function AdminTimetablePage() {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"week" | "day">("week");
  const { days, from, to } = useMemo(() => weekOf(offset), [offset]);
  const sessions = useLoad(() => fetchSessionsInRange(from, to), [from, to]);
  const todayIso = isoDate(new Date());
  const [selectedIso, setSelectedIso] = useState(todayIso);

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
    for (const list of map.values())
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const classIds = new Set<string>();
    const teacherIds = new Set<string>();
    const roomIds = new Set<string>();
    for (const s of filtered) {
      if (s.status === "cancelled") continue;
      classIds.add(s.class?.id ?? s.class_id);
      if (s.teacher) teacherIds.add(s.teacher.id);
      if (s.room) roomIds.add(s.room.id);
    }
    return { classes: classIds.size, teachers: teacherIds.size, rooms: roomIds.size };
  }, [filtered]);

  // Chọn ngày để xem chi tiết: nhảy tuần nếu ngày nằm ngoài tuần đang xem
  function gotoDay(iso: string) {
    setSelectedIso(iso);
    setView("day");
    if (iso < from) setOffset((o) => o - 1);
    else if (iso > to) setOffset((o) => o + 1);
  }
  function shiftDay(delta: number) {
    const d = new Date(selectedIso + "T00:00:00");
    d.setDate(d.getDate() + delta);
    gotoDay(isoDate(d));
  }

  const activeCount = filtered.filter((s) => s.status !== "cancelled").length;

  return (
    <div className="space-y-5">
      {/* ===== Tiêu đề + điều hướng ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Thời khóa biểu</h1>
          <p className="mt-1 text-muted-foreground">
            {sessions.loading ? (
              "Đang tải..."
            ) : (
              <>
                Tuần {days[0].toLocaleDateString("vi-VN")} – {days[6].toLocaleDateString("vi-VN")}
                <span className="mx-1.5 text-border">·</span>
                <span className="font-semibold text-foreground">{activeCount}</span> buổi,{" "}
                <span className="font-semibold text-foreground">{stats.classes}</span> lớp,{" "}
                <span className="font-semibold text-foreground">{stats.teachers}</span> GV,{" "}
                <span className="font-semibold text-foreground">{stats.rooms}</span> phòng
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Đổi chế độ xem */}
          <div className="flex rounded-lg border bg-card p-0.5">
            {(["week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => (v === "day" ? gotoDay(selectedIso >= from && selectedIso <= to ? selectedIso : todayIso >= from && todayIso <= to ? todayIso : from) : setView("week"))}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  view === v ? "bg-brand-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "week" ? "Tuần" : "Ngày"}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => (view === "day" ? shiftDay(-1) : setOffset((o) => o - 1))}
            title={view === "day" ? "Hôm trước" : "Tuần trước"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={offset === 0 && (view === "week" || selectedIso === todayIso) ? "secondary" : "outline"}
            onClick={() => {
              setOffset(0);
              if (view === "day") setSelectedIso(todayIso);
            }}
          >
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => (view === "day" ? shiftDay(1) : setOffset((o) => o + 1))}
            title={view === "day" ? "Hôm sau" : "Tuần sau"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {sessions.error && <ErrorNote message={sessions.error} />}

      {/* ===== Dải 7 ngày (bấm để xem chi tiết ngày) ===== */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {days.map((d) => {
          const iso = isoDate(d);
          const count = (byDate.get(iso) ?? []).filter((s) => s.status !== "cancelled").length;
          const isToday = iso === todayIso;
          const isSelected = view === "day" && iso === selectedIso;
          return (
            <button
              key={iso}
              onClick={() => gotoDay(iso)}
              className={cn(
                "rounded-xl border px-1 py-2 text-center transition-all",
                isSelected
                  ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                  : isToday
                    ? "border-brand-300 bg-brand-50 text-brand-700 hover:border-brand-400"
                    : "bg-card text-muted-foreground hover:border-brand-200 hover:text-foreground",
              )}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                {WEEKDAY_LABELS[d.getDay()]}
              </div>
              <div className="text-lg font-extrabold leading-tight">{d.getDate()}</div>
              <div className={cn("text-[10px]", isSelected ? "text-white/85" : "text-muted-foreground")}>
                {count > 0 ? `${count} buổi` : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== Bộ lọc + chú giải ===== */}
      <Card className="p-3.5">
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
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Sắp diễn ra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Đã hoàn thành
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gold-500" /> Buổi học bù
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-ink-300" /> Đã hủy
            </span>
          </div>
        </div>
      </Card>

      {/* ===== Nội dung ===== */}
      {sessions.loading ? (
        <Card><LoadingRows rows={6} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={CalendarDays}
          title="Tuần này chưa có buổi học nào"
          description="Xác nhận lịch tuần cho các lớp rồi bấm “Sinh buổi học” trong trang chi tiết lớp — buổi học sẽ hiện lên đây."
        />
      ) : view === "week" ? (
        <WeekGrid days={days} byDate={byDate} todayIso={todayIso} />
      ) : (
        <DayGrid
          iso={selectedIso}
          list={byDate.get(selectedIso) ?? []}
          isToday={selectedIso === todayIso}
        />
      )}
    </div>
  );
}

/* =====================================================================
 * CHẾ ĐỘ TUẦN — 7 cột, mỗi ngày chia Sáng / Chiều / Tối
 * ===================================================================== */

function WeekGrid({
  days,
  byDate,
  todayIso,
}: {
  days: Date[];
  byDate: Map<string, SessionRow[]>;
  todayIso: string;
}) {
  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="grid min-w-[980px] grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = isoDate(d);
          const list = byDate.get(iso) ?? [];
          const isToday = iso === todayIso;
          const parts = ["morning", "afternoon", "evening"] as const;
          return (
            <div
              key={iso}
              className={cn(
                "min-w-0 rounded-xl border bg-card/60 p-1.5",
                isToday && "border-brand-300 bg-brand-50/40 ring-1 ring-brand-200",
              )}
            >
              {list.length === 0 ? (
                <div className="grid h-24 place-items-center text-xs text-muted-foreground/60">
                  Trống
                </div>
              ) : (
                <div className="space-y-1.5">
                  {parts.map((part) => {
                    const items = list.filter((s) => daypartOf(s.start_time) === part);
                    if (!items.length) return null;
                    return (
                      <div key={part}>
                        <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                          <span className="h-px flex-1 bg-border" />
                          {DAYPART_LABELS[part]}
                          <span className="h-px flex-1 bg-border" />
                        </div>
                        <div className="space-y-1.5">
                          {items.map((s) => (
                            <SessionCard key={s.id} s={s} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({ s }: { s: SessionRow }) {
  const level = s.class?.course?.level;
  return (
    <Link
      href={`/admin/classes/${s.class?.id ?? s.class_id}`}
      className={cn(
        "block rounded-lg border border-l-4 p-2 transition-all hover:-translate-y-px hover:shadow-soft",
        sessionTone(s),
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[11px] font-bold text-foreground/80">
          <Clock className="h-3 w-3" />
          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
        </span>
        {s.type === "makeup" && (
          <span className="rounded bg-gold-200/80 px-1 text-[9px] font-bold uppercase text-gold-800">Bù</span>
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-[13px] font-bold leading-snug",
          s.status === "cancelled" && "line-through",
        )}
        title={s.class?.name}
      >
        {s.class?.name ?? "?"}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <span className={cn("flex items-center gap-0.5", !s.room && "text-gold-700")}>
          <DoorOpen className="h-3 w-3" />
          {s.room ? `P.${s.room.name}` : "Chưa xếp phòng"}
        </span>
        {level && (
          <span className="rounded bg-foreground/5 px-1 font-semibold">
            {LEVEL_LABELS[level] ?? level}
          </span>
        )}
      </div>
      {s.teacher && (
        <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground" title={s.teacher.name}>
          <GraduationCap className="h-3 w-3 shrink-0" />
          <span className="truncate">{s.teacher.name}</span>
        </div>
      )}
    </Link>
  );
}

/* =====================================================================
 * CHẾ ĐỘ NGÀY — lưới giờ, cột theo phòng học (nhìn rõ phòng trống giờ nào)
 * ===================================================================== */

const HOUR_PX = 72;

/** Xếp các buổi chồng giờ trong cùng cột vào các "làn" cạnh nhau. */
function withLanes(list: SessionRow[]): { placed: { s: SessionRow; lane: number }[]; laneCount: number } {
  const sorted = [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const laneEnds: string[] = [];
  const placed = sorted.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.start_time);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.end_time);
    } else {
      laneEnds[lane] = s.end_time;
    }
    return { s, lane };
  });
  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

function DayGrid({ iso, list, isToday }: { iso: string; list: SessionRow[]; isToday: boolean }) {
  const d = new Date(iso + "T00:00:00");

  const columns = useMemo(() => {
    const roomMap = new Map<string, { label: string; sessions: SessionRow[] }>();
    const noRoom: SessionRow[] = [];
    for (const s of list) {
      if (s.room) {
        const col = roomMap.get(s.room.id) ?? { label: `Phòng ${s.room.name}`, sessions: [] };
        col.sessions.push(s);
        roomMap.set(s.room.id, col);
      } else {
        noRoom.push(s);
      }
    }
    const cols = [...roomMap.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (noRoom.length) cols.push({ label: "Chưa xếp phòng", sessions: noRoom });
    return cols;
  }, [list]);

  if (list.length === 0) {
    return (
      <Empty
        icon={School}
        title={`${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} không có buổi học`}
        description="Chọn ngày khác trên dải tuần phía trên, hoặc sinh buổi học cho các lớp."
      />
    );
  }

  // Khung giờ: từ giờ tròn trước buổi sớm nhất đến giờ tròn sau buổi muộn nhất
  const startHour = Math.floor(Math.min(...list.map((s) => toMinutes(s.start_time))) / 60);
  const endHour = Math.ceil(Math.max(...list.map((s) => toMinutes(s.end_time))) / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;

  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-secondary/40 px-4 py-2.5 text-sm font-bold">
        {WEEKDAY_LABELS[d.getDay()]}, {d.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })}
        <span className="ml-2 font-normal text-muted-foreground">
          {list.filter((s) => s.status !== "cancelled").length} buổi · {columns.length} phòng
        </span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="flex min-w-fit">
          {/* Cột giờ (dính trái) */}
          <div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-card">
            <div className="h-9 border-b" />
            <div className="relative" style={{ height: gridHeight }}>
              {hours.slice(0, -1).map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground"
                  style={{ top: (h - startHour) * HOUR_PX }}
                >
                  {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
                </div>
              ))}
              <div
                className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground"
                style={{ top: gridHeight }}
              >
                {String(endHour).padStart(2, "0")}:00
              </div>
            </div>
          </div>

          {/* Cột phòng */}
          {columns.map((col) => {
            const { placed, laneCount } = withLanes(col.sessions);
            return (
              <div key={col.label} className="min-w-[11rem] flex-1 border-r last:border-r-0">
                <div
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 border-b bg-secondary/30 px-2 text-sm font-bold",
                    col.label === "Chưa xếp phòng" && "text-gold-700",
                  )}
                >
                  <DoorOpen className="h-3.5 w-3.5 opacity-60" />
                  <span className="truncate">{col.label}</span>
                  <span className="rounded-full bg-foreground/5 px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {col.sessions.length}
                  </span>
                </div>
                <div className="relative" style={{ height: gridHeight }}>
                  {/* Kẻ dòng mỗi giờ */}
                  {hours.slice(1).map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    />
                  ))}
                  {/* Vạch "bây giờ" */}
                  {showNow && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500"
                      style={{ top: ((nowMin - startHour * 60) / 60) * HOUR_PX }}
                    >
                      <span className="absolute -left-0.5 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  )}
                  {/* Khối buổi học */}
                  {placed.map(({ s, lane }) => {
                    const top = ((toMinutes(s.start_time) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(
                      30,
                      ((toMinutes(s.end_time) - toMinutes(s.start_time)) / 60) * HOUR_PX - 3,
                    );
                    const width = 100 / laneCount;
                    const compact = height < 56;
                    return (
                      <Link
                        key={s.id}
                        href={`/admin/classes/${s.class?.id ?? s.class_id}`}
                        className={cn(
                          "absolute overflow-hidden rounded-lg border border-l-4 p-1.5 shadow-sm transition-all hover:z-10 hover:shadow-soft",
                          sessionTone(s),
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${lane * width}% + 3px)`,
                          width: `calc(${width}% - 6px)`,
                        }}
                        title={`${s.class?.name ?? "?"} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}${s.teacher ? ` · ${s.teacher.name}` : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-foreground/70">
                          <span>
                            {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          </span>
                          {s.type === "makeup" && (
                            <span className="rounded bg-gold-200/80 px-1 text-[9px] uppercase text-gold-800">Bù</span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "truncate text-xs font-bold leading-tight",
                            s.status === "cancelled" && "line-through",
                          )}
                        >
                          {s.class?.name ?? "?"}
                        </div>
                        {!compact && s.teacher && (
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                            <GraduationCap className="h-3 w-3 shrink-0" />
                            <span className="truncate">{s.teacher.name}</span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
