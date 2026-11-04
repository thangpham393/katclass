"use client";

import { PhoneCall } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { CARE_STATUS_LABELS, type CareStatus } from "@/lib/db-care-requests";

export interface ParentContact {
  on: boolean;
  note: string;
}

/**
 * Ô tích "Cần CSKH liên hệ phụ huynh" trong nhận xét buổi (0065). Tích vào
 * thì hiện ô ghi nội dung cần trao đổi — lưu nhận xét là CSKH nhận phiếu
 * ở trang Chăm sóc học viên, học viên vào mục Học viên cần chú ý.
 */
export function ParentContactField({
  value,
  onChange,
  status,
}: {
  value: ParentContact;
  onChange: (v: ParentContact) => void;
  /** Trạng thái phiếu đã mở trước đó (nếu có). */
  status?: CareStatus;
}) {
  return (
    <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/40 p-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.on}
          onChange={(e) => onChange({ ...value, on: e.target.checked })}
          className="h-4 w-4 accent-rose-600"
        />
        <PhoneCall className="h-3.5 w-3.5 text-rose-600" />
        Cần CSKH liên hệ phụ huynh
        {status && (
          <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Phiếu: {CARE_STATUS_LABELS[status]}
          </span>
        )}
      </label>
      {value.on && (
        <Textarea
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          rows={2}
          className="mt-2"
          placeholder="Nội dung cần trao đổi với phụ huynh, điều cần chú ý ở học viên (chỉ CSKH và GV xem, phụ huynh không thấy)…"
        />
      )}
    </div>
  );
}
