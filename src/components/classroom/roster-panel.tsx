"use client";

import { useEffect, useRef } from "react";
import { Minus, Pin, PinOff, Plus, Star, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/db";
import { POINT_REASONS, type ClassroomStudent, type PointReason } from "@/lib/db-classroom";

const ABSENT: AttendanceStatus[] = ["absent_excused", "absent_unexcused"];

export function presentCount(
  students: ClassroomStudent[],
  attendance: Record<string, AttendanceStatus | undefined>,
) {
  return students.filter((s) => attendance[s.id] && !ABSENT.includes(attendance[s.id]!)).length;
}

/**
 * Danh sách học viên dạng popover thả xuống ngay dưới nút "Học viên" trên
 * topbar: nổi đè lên slide nên bật/tắt không làm khung chiếu co giãn. Giáo
 * viên chọn lý do cộng điểm một lần rồi chạm vào học viên là cộng; ghim lại
 * nếu muốn bảng luôn mở suốt buổi.
 */
export function RosterPanel({
  students,
  attendance,
  points,
  reason,
  onReasonChange,
  onGive,
  onUndo,
  onUndoStudent,
  lastFor,
  canUndo,
  answeringId,
  pendingCount,
  pinned,
  onTogglePin,
  onClose,
}: {
  students: ClassroomStudent[];
  attendance: Record<string, AttendanceStatus | undefined>;
  points: Record<string, number>;
  reason: PointReason;
  onReasonChange: (r: PointReason) => void;
  onGive: (studentId: string) => void;
  onUndo: () => void;
  /** Gỡ lần cộng gần nhất của riêng một học viên (nút − cạnh ngôi sao). */
  onUndoStudent: (studentId: string) => void;
  /** Lần cộng gần nhất của học viên — để nút − nói rõ nó sắp gỡ cái gì. */
  lastFor?: (studentId: string) => { points: number; label: string; emoji: string } | null;
  canUndo: boolean;
  /** Học viên vừa được gọi, đang trả lời trước lớp. */
  answeringId?: string | null;
  pendingCount: number;
  /** Ghim = không tự đóng khi bấm ra ngoài. */
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const def = POINT_REASONS.find((r) => r.value === reason)!;
  const ref = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài thì đóng — trừ khi đã ghim
  useEffect(() => {
    if (pinned) return;
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const t = e.target as Node;
      // Nút mở popover cũng nằm ngoài panel → đánh dấu để không đóng rồi mở lại
      if (el.contains(t) || (t as HTMLElement).closest?.("[data-roster-toggle]")) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pinned, onClose]);

  return (
    <div
      ref={ref}
      className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/95 text-white shadow-soft backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2.5">
        <span className="text-sm font-bold">
          Học viên{" "}
          <span className="font-medium text-ink-300">
            ({presentCount(students, attendance)}/{students.length})
          </span>
        </span>
        <button
          onClick={onTogglePin}
          title={pinned ? "Bỏ ghim — bấm ra ngoài là đóng" : "Ghim để bảng luôn mở"}
          aria-label={pinned ? "Bỏ ghim danh sách học viên" : "Ghim danh sách học viên"}
          className={cn(
            "ml-auto grid h-7 w-7 place-items-center rounded-lg",
            pinned ? "bg-brand-600 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white",
          )}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onClose}
          aria-label="Đóng danh sách học viên"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {students.length === 0 ? (
          <div className="p-4 text-center text-xs text-ink-300">Lớp chưa có học viên.</div>
        ) : (
          <div className="space-y-1">
            {students.map((s) => {
              const st = attendance[s.id];
              const absent = st ? ABSENT.includes(st) : false;
              const p = points[s.id] ?? 0;
              const answering = s.id === answeringId;
              const last = lastFor?.(s.id) ?? null;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-xl pr-1.5 transition-colors",
                    absent ? "opacity-50 hover:bg-ink-800/60" : "hover:bg-ink-800",
                    answering && "bg-gold-600/20 ring-2 ring-gold-500",
                  )}
                >
                  <button
                    onClick={() => onGive(s.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-transform active:scale-[0.97]"
                    title={`Chạm để ${def.points > 0 ? "+" : ""}${def.points} · ${def.label}`}
                  >
                    <Avatar name={s.name} src={s.avatar ?? undefined} size={34} className="ring-ink-700" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className={cn("text-[11px]", answering ? "font-bold text-gold-300" : "text-ink-400")}>
                        {answering ? (
                          "🎤 Đang trả lời"
                        ) : absent ? (
                          "Vắng"
                        ) : (
                          <>
                            <span className={cn("mr-1", st ? "text-emerald-400" : "text-ink-500")}>●</span>
                            {s.makeup ? "Học bù" : st ? "Có mặt" : "Chưa điểm danh"}
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/*
                    Cộng nhầm thì gỡ ngay tại chỗ: nút − xoá hẳn lần cộng gần
                    nhất của chính học viên này (không phải cộng thêm điểm âm),
                    nên lịch sử buổi sạch và nhận xét cuối buổi không đọc sai.
                  */}
                  <button
                    onClick={() => onUndoStudent(s.id)}
                    disabled={!last}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-300 transition-colors hover:bg-ink-700 hover:text-white active:scale-90 disabled:opacity-25 disabled:hover:bg-transparent"
                    title={
                      last
                        ? `Gỡ lần cộng gần nhất: ${last.emoji} ${last.label} ${last.points > 0 ? "+" : ""}${last.points}`
                        : "Chưa cộng ★ nào cho bạn này trong buổi"
                    }
                    aria-label={`Gỡ điểm gần nhất của ${s.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    className={cn(
                      "flex w-11 shrink-0 items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-sm font-extrabold tabular-nums",
                      p > 0 ? "bg-gold-600/20 text-gold-300" : p < 0 ? "bg-ink-950 text-ink-400" : "text-ink-500",
                    )}
                  >
                    <Star className={cn("h-3.5 w-3.5 shrink-0", p > 0 && "fill-gold-400 text-gold-400")} />
                    {p}
                  </span>
                  <button
                    onClick={() => onGive(s.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-ink-100 transition-colors hover:bg-brand-600 hover:text-white active:scale-90"
                    title={`${def.emoji} ${def.label} ${def.points > 0 ? "+" : ""}${def.points}`}
                    aria-label={`Cộng ★ cho ${s.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lý do cộng điểm: chip đang chọn hiện rõ nhất, chạm học viên là cộng đúng lý do đó */}
      <div className="border-t border-ink-800 px-3 py-2">
        <div className="flex flex-wrap gap-1">
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
                  : "bg-ink-800 text-ink-300 hover:bg-ink-700",
              )}
              title={`${r.label} (${r.points > 0 ? "+" : ""}${r.points})`}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-400">
          <span>
            Chạm tên hoặc <b className="text-white">+</b> ={" "}
            <b className="text-white">
              {def.points > 0 ? "+" : ""}
              {def.points} {def.label}
            </b>{" "}
            · <b className="text-white">−</b> gỡ lần cộng gần nhất
          </span>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="ml-auto rounded-lg bg-ink-800 px-2 py-1 font-semibold text-ink-100 hover:bg-ink-700 disabled:opacity-40"
          >
            Hoàn tác
          </button>
        </div>
        {pendingCount > 0 && (
          <div className="mt-1 text-[11px] text-gold-300" title="Điểm đang lưu tạm trên máy, sẽ tự đẩy lên khi có mạng">
            ⏳ {pendingCount} điểm chờ đồng bộ
          </div>
        )}
      </div>
    </div>
  );
}
