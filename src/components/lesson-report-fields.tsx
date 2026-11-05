"use client";

import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROGRESS_LABELS, type LessonProgress } from "@/lib/db-tuition";

const PROGRESS_ORDER: LessonProgress[] = ["on_track", "behind", "ahead"];

const PROGRESS_STYLE: Record<LessonProgress, string> = {
  on_track: "border-emerald-600 bg-emerald-600 text-white",
  behind: "border-amber-500 bg-amber-500 text-white",
  ahead: "border-sky-600 bg-sky-600 text-white",
};

export interface LessonReport {
  progress: LessonProgress | null;
  homeworkNote: string;
  nextPlan: string;
}

/**
 * Phần báo cáo cuối buổi (0064): tiến độ so với kế hoạch, BTVN đã giao, nội
 * dung dự kiến buổi sau. Dùng chung cho modal chấm công và bước "Chốt buổi"
 * của màn kết thúc buổi học.
 */
export function LessonReportFields({
  value,
  onChange,
  hideHomework,
}: {
  value: LessonReport;
  onChange: (v: LessonReport) => void;
  /** Modal chấm công đã có khối xác nhận BTVN riêng (0066). */
  hideHomework?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-sm font-semibold">
          Tiến độ so với kế hoạch <span className="text-destructive">*</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROGRESS_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ ...value, progress: p })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                value.progress === p ? PROGRESS_STYLE[p] : "border-input text-muted-foreground hover:bg-secondary",
              )}
            >
              {PROGRESS_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      {!hideHomework && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Bài tập về nhà đã giao</span>
          <Textarea
            value={value.homeworkNote}
            onChange={(e) => onChange({ ...value, homeworkNote: e.target.value })}
            rows={2}
            placeholder="VD: Sách bài tập trang 12–13, viết mỗi từ mới 3 dòng. Bỏ trống nếu không giao."
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Nội dung dự kiến buổi sau</span>
        <span className="block text-xs text-muted-foreground">
          Học viên và phụ huynh thấy mục này để xem trước bài.
        </span>
        <Textarea
          value={value.nextPlan}
          onChange={(e) => onChange({ ...value, nextPlan: e.target.value })}
          rows={2}
          placeholder="VD: Chữa BTVN, Bài 5 — từ vựng + mẫu câu, nghe đọc theo."
        />
      </label>
    </div>
  );
}
