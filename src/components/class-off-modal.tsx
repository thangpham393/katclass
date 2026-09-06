"use client";

import { useEffect, useState } from "react";
import { CalendarX2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { dbErrorMessage, WEEKDAY_LABELS, sessionClassLabel } from "@/lib/db";
import { markClassOff, undoClassOff } from "@/lib/db-tuition";

/** Buổi tối thiểu cần cho việc báo nghỉ (dùng được cả TeachingSessionRow). */
export interface ClassOffTargetSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled";
  type: "regular" | "makeup";
  cancel_reason?: string | null;
  class: { name: string } | null;
  room?: { name: string } | null;
}

/**
 * BÁO LỚP NGHỈ — mở từ chỗ check-in ca dạy (trang chủ GV, lịch dạy GV,
 * theo dõi chấm công của hành chính).
 *
 * Buổi đang bình thường → hỏi lý do rồi đánh dấu nghỉ; buổi đã nghỉ →
 * cho bỏ đánh dấu. Giáo viên vẫn rảnh khung giờ đó nên vẫn được xếp dạy
 * thay lớp khác cùng giờ.
 */
export function ClassOffModal({
  session,
  onClose,
  onSaved,
}: {
  session: ClassOffTargetSession | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cancelled = session?.status === "cancelled";
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason(session?.cancel_reason ?? "");
    setError(null);
  }, [session]);

  if (!session) return null;
  const d = new Date(session.date + "T00:00:00");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={cancelled ? "Bỏ đánh dấu lớp nghỉ" : "Đánh dấu lớp nghỉ"}>
      <div className="space-y-4">
        <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
          <div className="font-semibold">{sessionClassLabel(session)}</div>
          <div className="text-xs text-muted-foreground">
            {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")} ·{" "}
            {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
            {session.room ? ` · Phòng ${session.room.name}` : ""}
          </div>
        </div>

        {cancelled ? (
          <>
            <p className="text-sm">
              Bỏ đánh dấu nghỉ thì buổi quay lại{" "}
              <span className="font-semibold">chưa dạy</span>, các dòng điểm danh do nút
              &ldquo;Lớp nghỉ&rdquo; tạo sẽ bị gỡ cùng lượt chờ xếp bù tương ứng. Lượt bù đã
              xếp lịch thì giữ nguyên — muốn huỷ hãy vào trang Học bù.
            </p>
            {session.cancel_reason && (
              <p className="text-sm text-muted-foreground">Lý do đã ghi: {session.cancel_reason}</p>
            )}
          </>
        ) : (
          <>
            <div className="rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm text-gold-800">
              Buổi này sẽ chuyển sang <span className="font-semibold">đã hủy</span>, toàn bộ học
              viên đang học của lớp được điểm danh{" "}
              <span className="font-semibold">vắng có phép</span> và vào hàng{" "}
              <span className="font-semibold">chờ xếp bù</span>. Công đã chấm cho buổi (nếu có) bị
              xoá, học viên và phụ huynh nhận thông báo.
            </div>
            <Field label="Lý do nghỉ (tùy chọn)" hint="VD: giáo viên ốm, trung tâm mất điện, nghỉ lễ.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Khung giờ này của bạn được giải phóng — trung tâm vẫn xếp bạn dạy thay lớp khác cùng
              giờ được.
            </p>
          </>
        )}

        {error && <ErrorNote message={error} />}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
          {cancelled ? (
            <Button onClick={() => run(() => undoClassOff(session.id))} disabled={busy}>
              <Undo2 className="h-4 w-4" /> {busy ? "Đang bỏ…" : "Bỏ đánh dấu nghỉ"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => run(() => markClassOff(session.id, reason))}
              disabled={busy}
            >
              <CalendarX2 className="h-4 w-4" /> {busy ? "Đang lưu…" : "Xác nhận lớp nghỉ"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
