"use client";

import { CheckCircle2, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MANUAL_HOMEWORK_OPTIONS, type SessionHomeworkRow } from "@/lib/db-content";

export interface HomeworkCheckValue {
  /** null = GV chưa chọn; chỉ dùng khi buổi chưa có bài nào trên hệ thống. */
  mode: "quick" | "none" | null;
  tasks: string[];
  note: string;
  due: string;
  reason: string;
}

export const EMPTY_HOMEWORK_CHECK: HomeworkCheckValue = { mode: null, tasks: [], note: "", due: "", reason: "" };

/**
 * Bước xác nhận BTVN trong modal chấm công (0066): GV bấm chấm công thẳng
 * (không qua màn "Vào lớp") vẫn phải thấy buổi đã có bài tập chưa — chưa có
 * thì giao nhanh ngay tại đây, hoặc ghi lý do không giao.
 */
export function HomeworkCheck({
  sessionId,
  classId,
  homeworks,
  loading,
  required,
  value,
  onChange,
  onReload,
}: {
  sessionId: string;
  classId: string;
  homeworks: SessionHomeworkRow[];
  loading: boolean;
  required: boolean;
  value: HomeworkCheckValue;
  onChange: (v: HomeworkCheckValue) => void;
  onReload: () => void;
}) {
  const assignHref = `/teacher/homework/new?class=${classId}&session=${sessionId}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Bài tập về nhà {required && <span className="text-destructive">*</span>}
        </span>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Tải lại
        </button>
      </div>

      {loading && !homeworks.length ? (
        <p className="text-sm text-muted-foreground">Đang kiểm tra bài tập đã giao…</p>
      ) : homeworks.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {homeworks.map((h) => (
            <div key={h.id} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{h.title}</span>
                {(h.homework_questions[0]?.count ?? 0) > 0 && ` · ${h.homework_questions[0].count} câu`}
                {h.manual_tasks.length > 0 && ` · ${h.manual_tasks.join(", ")}`}
                {h.due_at && ` · hạn ${new Date(h.due_at).toLocaleDateString("vi-VN")}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Buổi này chưa có bài tập về nhà nào trên hệ thống — học viên sẽ không nhận được bài.
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["quick", "Giao BTVN ngay"],
              ["none", "Buổi này không giao BTVN"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ ...value, mode })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                  value.mode === mode
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-input bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {value.mode === "quick" && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {MANUAL_HOMEWORK_OPTIONS.map((task) => (
                  <label key={task} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={value.tasks.includes(task)}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          tasks: e.target.checked ? [...value.tasks, task] : value.tasks.filter((t) => t !== task),
                        })
                      }
                      className="h-4 w-4 accent-brand-600"
                    />
                    {task}
                  </label>
                ))}
              </div>
              <Textarea
                value={value.note}
                onChange={(e) => onChange({ ...value, note: e.target.value })}
                rows={2}
                placeholder="Dặn dò / bài khác — VD: sách bài tập trang 12–13, viết mỗi từ mới 3 dòng."
              />
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Hạn nộp (tùy chọn)</span>
                <Input type="datetime-local" value={value.due} onChange={(e) => onChange({ ...value, due: e.target.value })} />
              </label>
              <p className="text-xs text-muted-foreground">
                Muốn giao câu hỏi làm trên hệ thống?{" "}
                <a href={assignHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand-600 hover:underline">
                  Mở trang giao bài <ExternalLink className="h-3 w-3" />
                </a>{" "}
                rồi quay lại bấm “Tải lại”.
              </p>
            </div>
          )}

          {value.mode === "none" && (
            <Input
              value={value.reason}
              onChange={(e) => onChange({ ...value, reason: e.target.value })}
              placeholder="Lý do (tùy chọn) — VD: buổi kiểm tra cuối khóa, đã giao bài dài hạn từ buổi trước…"
            />
          )}
        </div>
      )}
    </div>
  );
}
