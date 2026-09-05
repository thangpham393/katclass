"use client";

import { useEffect, useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { dbErrorMessage, WEEKDAY_LABELS, sessionClassLabel } from "@/lib/db";
import { fetchSessionLessons } from "@/lib/db-content";
import {
  canTeacherUndoLog,
  deleteTeachingLog,
  pickLog,
  saveTeachingLog,
  sessionHours,
  type TeachingLogRow,
} from "@/lib/db-tuition";
import { useAuth } from "@/components/auth/auth-provider";

/** Buổi dạy tối thiểu cần cho việc chấm công (dùng được cả SessionRow). */
export interface LogTargetSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: "regular" | "makeup";
  class: { name: string } | null;
  room: { name: string } | null;
  teacher: { id: string; name: string } | null;
  teaching_log?: TeachingLogRow | TeachingLogRow[] | null;
}

function logOf(s: LogTargetSession | null, override?: TeachingLogRow | null): TeachingLogRow | null {
  if (override !== undefined) return override;
  return s ? pickLog({ teaching_log: s.teaching_log ?? null }) : null;
}

/**
 * Chấm công một ca dạy: giờ dạy thực tế + số giờ + nội dung bài học.
 * Dùng chung cho trang chủ giáo viên và trang theo dõi chấm công của
 * hành chính (hành chính chấm hộ khi giáo viên quên bấm).
 */
export function TeachingLogModal({
  session,
  log: logOverride,
  currentUserId,
  onClose,
  onSaved,
}: {
  session: LogTargetSession | null;
  /** Bản ghi công nếu nạp riêng (trang chi tiết buổi); bỏ trống = lấy từ session. */
  log?: TeachingLogRow | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const log = logOf(session, logOverride);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isStaff = user ? ["staff", "accountant", "admin"].includes(user.role) : false;
  // Chấm nhầm buổi/nhầm ngày thì phải huỷ bản ghi ở buổi sai rồi chấm lại
  // ở buổi đúng. GV tự huỷ trong 24h, quá hạn thì hành chính huỷ hộ (0042).
  const canDelete = !!log && (isStaff || canTeacherUndoLog(log));

  // Mở modal: nạp giá trị đã chấm, hoặc mặc định theo giờ lịch
  useEffect(() => {
    if (!session) return;
    const l = logOf(session, logOverride);
    setStart((l?.actual_start ?? session.start_time).slice(0, 5));
    setEnd((l?.actual_end ?? session.end_time).slice(0, 5));
    setContent(l?.lesson_content ?? "");
    setNote(l?.note ?? "");
    setError(null);
    setConfirmDelete(false);
    // Chưa chấm bao giờ → gợi ý nội dung từ bài học đã gán cho buổi
    if (!l) {
      fetchSessionLessons(session.id)
        .then((rows) => {
          const text = rows
            .map((r) => [r.lesson.unit ? `Bài ${r.lesson.unit}` : null, r.lesson.title].filter(Boolean).join(": "))
            .join("; ");
          if (text) setContent((prev) => prev || text);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, logOverride]);

  if (!session) return null;

  const hours = sessionHours({ start_time: start || "00:00", end_time: end || "00:00" });
  const d = new Date(session.date + "T00:00:00");

  async function handleSave() {
    if (!session) return;
    if (!start || !end) {
      setError("Nhập giờ bắt đầu và giờ kết thúc.");
      return;
    }
    if (end <= start) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (!content.trim()) {
      setError("Nhập nội dung bài học đã dạy.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveTeachingLog({
        sessionId: session.id,
        teacherId: session.teacher?.id ?? currentUserId,
        actualStart: start,
        actualEnd: end,
        lessonContent: content,
        note,
        createdBy: currentUserId,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTeachingLog(session.id);
      onSaved();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={log ? "Sửa chấm công ca dạy" : "Chấm công ca dạy"}>
      <div className="space-y-4">
        <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
          <div className="font-semibold">{sessionClassLabel(session)}</div>
          <div className="text-xs text-muted-foreground">
            {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")} · lịch{" "}
            {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
            {session.room ? ` · Phòng ${session.room.name}` : ""}
            {session.teacher ? ` · GV ${session.teacher.name}` : ""}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu thực tế" required>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Giờ kết thúc thực tế" required>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
          <Clock className="h-4 w-4" /> Số giờ được tính công: {hours > 0 ? `${hours}h` : "—"}
        </div>

        <Field label="Nội dung bài học đã dạy" required hint="VD: Bài 5 — từ vựng + ngữ pháp 把, luyện nghe trang 42.">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Ghi chú (tùy chọn)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lớp vào muộn 10 phút, dạy bù cuối buổi..." />
        </Field>

        {error && <ErrorNote message={error} />}

        {log && !canDelete && (
          <p className="text-xs text-muted-foreground">
            Đã quá 24h kể từ lúc chấm công — muốn huỷ (VD chấm nhầm ngày) hãy nhờ hành chính.
          </p>
        )}

        {confirmDelete ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm">
              Huỷ chấm công buổi này? Buổi quay lại trạng thái{" "}
              <span className="font-semibold">chưa dạy</span> và không còn được tính công.
              Nếu chấm nhầm ngày, sau đó hãy vào đúng buổi để chấm lại.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={saving}>
                Quay lại
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                {saving ? "Đang huỷ…" : "Xác nhận huỷ công"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canDelete && (
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="mr-auto text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Huỷ chấm công
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu…" : log ? "Lưu thay đổi" : "Xác nhận chấm công"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
