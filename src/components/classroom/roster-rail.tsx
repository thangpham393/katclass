"use client";

import { Star, Undo2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/db";
import { POINT_REASONS, type ClassroomStudent, type PointReason } from "@/lib/db-classroom";

const ABSENT: AttendanceStatus[] = ["absent_excused", "absent_unexcused"];

/**
 * Cột học viên bên phải màn hình lớp học: giáo viên chọn lý do cộng điểm một
 * lần rồi chạm vào học viên là cộng — thao tác nhanh nhất có thể trong giờ.
 */
export function RosterRail({
  students,
  attendance,
  points,
  reason,
  onReasonChange,
  onGive,
  onUndo,
  canUndo,
  answeringId,
  pendingCount,
}: {
  students: ClassroomStudent[];
  attendance: Record<string, AttendanceStatus | undefined>;
  points: Record<string, number>;
  reason: PointReason;
  onReasonChange: (r: PointReason) => void;
  onGive: (studentId: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Học viên vừa được gọi, đang trả lời trước lớp. */
  answeringId?: string | null;
  pendingCount: number;
}) {
  const def = POINT_REASONS.find((r) => r.value === reason)!;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-ink-800 bg-ink-900 text-white">
      <div className="border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Users className="h-4 w-4" /> Học viên
          <span className="ml-auto text-xs font-medium text-ink-300">
            {students.filter((s) => attendance[s.id] && !ABSENT.includes(attendance[s.id]!)).length}/
            {students.length} có mặt
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {POINT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => onReasonChange(r.value)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                r.value === reason
                  ? r.points < 0
                    ? "bg-gold-600 text-white"
                    : "bg-brand-500 text-white"
                  : "bg-ink-800 text-ink-200 hover:bg-ink-700",
              )}
              title={`${r.label} (${r.points > 0 ? "+" : ""}${r.points})`}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-ink-300">
          Chạm học viên = {def.points > 0 ? "+" : ""}
          {def.points} · {def.label}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {students.length === 0 ? (
          <div className="p-4 text-center text-xs text-ink-300">Lớp chưa có học viên.</div>
        ) : (
          <div className="space-y-1.5">
            {students.map((s) => {
              const st = attendance[s.id];
              const absent = st ? ABSENT.includes(st) : false;
              const p = points[s.id] ?? 0;
              const answering = s.id === answeringId;
              return (
                <button
                  key={s.id}
                  onClick={() => onGive(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-all active:scale-[0.97]",
                    absent ? "bg-ink-950/60 opacity-50" : "bg-ink-800 hover:bg-ink-700",
                    answering && "bg-gold-600/20 ring-2 ring-gold-500",
                  )}
                >
                  <Avatar name={s.name} src={s.avatar ?? undefined} size={34} className="ring-ink-700" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.name}</div>
                    <div className={cn("text-[11px]", answering ? "font-bold text-gold-300" : "text-ink-300")}>
                      {answering
                        ? "🎤 Đang trả lời"
                        : absent
                          ? "Vắng"
                          : s.makeup
                            ? "Học bù"
                            : st
                              ? "Có mặt"
                              : "Chưa điểm danh"}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-sm font-extrabold tabular-nums",
                      p > 0 ? "bg-gold-600/20 text-gold-300" : p < 0 ? "bg-ink-950 text-ink-400" : "text-ink-500",
                    )}
                  >
                    <Star className={cn("h-3.5 w-3.5", p > 0 && "fill-gold-400 text-gold-400")} />
                    {p}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-ink-800 px-3 py-2 text-xs">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 font-semibold text-ink-100 hover:bg-ink-700 disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" /> Hoàn tác
        </button>
        {pendingCount > 0 && (
          <span className="text-gold-300" title="Điểm đang lưu tạm trên máy, sẽ tự đẩy lên khi có mạng">
            ⏳ {pendingCount} điểm chờ đồng bộ
          </span>
        )}
      </div>
    </aside>
  );
}
