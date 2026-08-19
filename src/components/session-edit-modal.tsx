"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import {
  dbErrorMessage,
  fetchProfilesByRole,
  fetchRooms,
  updateClassInfo,
  updateSession,
  SESSION_STATUS_LABELS,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

/** Buổi học tối thiểu cần cho form sửa (TeachingSessionRow / SessionRow dùng được). */
export interface EditableSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  session_no: number | null;
  status: "scheduled" | "completed" | "cancelled";
  type: "regular" | "makeup";
  note?: string | null;
  class: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
}

/**
 * Sửa thông tin một ca dạy: tên lớp (áp cho cả lớp), giáo viên, phòng,
 * ngày giờ, buổi thứ, trạng thái, ghi chú.
 * Đổi ngày/giờ hoặc hủy buổi sẽ tự sinh thông báo cho học viên (trigger DB).
 */
export function SessionEditModal({
  session,
  onClose,
  onSaved,
}: {
  session: EditableSession | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!session;
  const teachers = useLoad(
    () => (open ? fetchProfilesByRole("teacher") : Promise.resolve([])),
    [open],
  );
  const rooms = useLoad(() => (open ? fetchRooms() : Promise.resolve([])), [open]);

  const [className, setClassName] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [roomId, setRoomId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sessionNo, setSessionNo] = useState("");
  const [status, setStatus] = useState<EditableSession["status"]>("scheduled");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setClassName(session.class?.name ?? "");
    setDate(session.date);
    setStart(session.start_time.slice(0, 5));
    setEnd(session.end_time.slice(0, 5));
    setRoomId(session.room?.id ?? "");
    setTeacherId(session.teacher?.id ?? "");
    setSessionNo(session.session_no != null ? String(session.session_no) : "");
    setStatus(session.status);
    setNote(session.note ?? "");
    setError(null);
  }, [session]);

  if (!session) return null;

  const scheduleChanged =
    date !== session.date ||
    start !== session.start_time.slice(0, 5) ||
    end !== session.end_time.slice(0, 5) ||
    status === "cancelled";

  async function handleSave() {
    if (!session) return;
    if (!date || !start || !end) {
      setError("Nhập đủ ngày và giờ học.");
      return;
    }
    if (end <= start) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (session.class && !className.trim()) {
      setError("Tên lớp không được để trống.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Buổi trước, lớp sau: trùng lịch (23P01) thì tên lớp chưa bị đổi oan
      await updateSession(session.id, {
        date,
        start_time: start,
        end_time: end,
        room_id: roomId || null,
        teacher_id: teacherId || null,
        session_no: sessionNo.trim() ? Number(sessionNo) : null,
        status,
        note: note.trim() || null,
      });
      if (session.class && className.trim() !== session.class.name) {
        await updateClassInfo(session.class.id, { name: className.trim() });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Sửa thông tin buổi học">
      <div className="space-y-4">
        {session.class ? (
          <Field label="Tên lớp" required hint="Đổi tên áp dụng cho toàn bộ lớp, không riêng buổi này.">
            <Input value={className} onChange={(e) => setClassName(e.target.value)} />
          </Field>
        ) : (
          <div className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            Buổi học bù riêng — không gắn lớp nào.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Giáo viên">
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">— Chưa gán —</option>
              {(teachers.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phòng học">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">— Không xếp phòng —</option>
              {(rooms.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Ngày học" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Bắt đầu" required>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Kết thúc" required>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Buổi thứ">
            <Input
              type="number"
              min={1}
              value={sessionNo}
              onChange={(e) => setSessionNo(e.target.value)}
              placeholder="—"
            />
          </Field>
          <Field label="Trạng thái buổi">
            <Select value={status} onChange={(e) => setStatus(e.target.value as EditableSession["status"])}>
              {(Object.keys(SESSION_STATUS_LABELS) as EditableSession["status"][]).map((k) => (
                <option key={k} value={k}>
                  {SESSION_STATUS_LABELS[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Ghi chú buổi học">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: đổi phòng do trùng lịch..." />
        </Field>

        {scheduleChanged && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Đổi ngày/giờ hoặc hủy buổi sẽ tự gửi thông báo đổi lịch cho học viên của lớp (và phụ huynh).
          </div>
        )}

        {error && <ErrorNote message={error} />}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
