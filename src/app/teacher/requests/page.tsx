"use client";

import { useMemo, useState } from "react";
import { CalendarOff, Plus, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchTeacherSessions,
  dbErrorMessage,
  todayISO,
  WEEKDAY_LABELS,
  type SessionRow,
} from "@/lib/db";
import {
  fetchMyChangeRequests,
  createChangeRequest,
  cancelChangeRequest,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  RESOLUTION_LABELS,
  type ChangeRequestRow,
  type ChangeRequestType,
  type ChangeRequestStatus,
} from "@/lib/db-requests";
import { useLoad } from "@/lib/use-load";

const STATUS_BADGE: Record<ChangeRequestStatus, "gold" | "jade" | "destructive" | "muted"> = {
  pending: "gold",
  approved: "jade",
  rejected: "destructive",
  cancelled: "muted",
};

function fmtSession(s: { date: string; start_time: string; end_time: string } | null): string {
  if (!s) return "?";
  const d = new Date(s.date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
}

export default function TeacherRequestsPage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";

  const requests = useLoad(
    () => (teacherId ? fetchMyChangeRequests(teacherId) : Promise.resolve([])),
    [teacherId],
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw(r: ChangeRequestRow) {
    if (!confirm("Rút yêu cầu này? Buổi dạy giữ nguyên như cũ.")) return;
    setError(null);
    try {
      await cancelChangeRequest(r.id);
      requests.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  const list = requests.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Nghỉ / đổi buổi dạy</h1>
          <p className="mt-1 text-muted-foreground">
            Gửi yêu cầu xin nghỉ hoặc đề xuất đổi buổi — trung tâm duyệt và xếp dạy thay nếu cần.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Tạo yêu cầu
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {requests.error && <ErrorNote message={requests.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu của tôi</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {requests.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : list.length === 0 ? (
            <Empty
              icon={CalendarOff}
              title="Chưa có yêu cầu nào"
              description="Bấm “Tạo yêu cầu” để xin nghỉ hoặc đề xuất đổi một buổi dạy sắp tới."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {list.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{REQUEST_TYPE_LABELS[r.type]}</span>
                      <Badge variant={STATUS_BADGE[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.session?.class?.name ?? "?"} · {fmtSession(r.session)}
                      {r.type === "reschedule" && r.proposed_date && (
                        <>
                          {" "}→ đề xuất{" "}
                          <span className="font-medium text-foreground">
                            {new Date(r.proposed_date + "T00:00:00").toLocaleDateString("vi-VN")}{" "}
                            {r.proposed_start_time?.slice(0, 5)}–{r.proposed_end_time?.slice(0, 5)}
                          </span>
                        </>
                      )}
                    </div>
                    {r.reason && (
                      <div className="mt-0.5 text-xs text-muted-foreground">Lý do: {r.reason}</div>
                    )}
                    {r.status === "approved" && r.resolution && (
                      <div className="mt-0.5 text-xs text-emerald-700">
                        Kết quả: {RESOLUTION_LABELS[r.resolution]}
                        {r.resolution === "substitute" && r.substitute_teacher
                          ? ` — GV ${r.substitute_teacher.name}`
                          : ""}
                        {r.resolution_note ? ` · ${r.resolution_note}` : ""}
                      </div>
                    )}
                    {r.status === "rejected" && r.resolution_note && (
                      <div className="mt-0.5 text-xs text-destructive">
                        Lý do từ chối: {r.resolution_note}
                      </div>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => handleWithdraw(r)}>
                      <Undo2 className="h-3.5 w-3.5" /> Rút yêu cầu
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateRequestModal
          teacherId={teacherId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            requests.reload();
          }}
        />
      )}
    </div>
  );
}

function CreateRequestModal({
  teacherId,
  onClose,
  onSaved,
}: {
  teacherId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Buổi sắp tới 60 ngày của GV (chỉ buổi chưa diễn ra, chưa hoàn thành)
  const sessions = useLoad(
    () => fetchTeacherSessions(teacherId, todayISO(), todayISO(60)),
    [teacherId],
  );
  const candidates = useMemo(
    () => (sessions.data ?? []).filter((s) => s.status === "scheduled"),
    [sessions.data],
  );

  const [sessionId, setSessionId] = useState("");
  const [type, setType] = useState<ChangeRequestType>("leave");
  const [reason, setReason] = useState("");
  const [pDate, setPDate] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected: SessionRow | undefined = candidates.find((s) => s.id === sessionId);

  async function handleSubmit() {
    if (!sessionId) return setError("Chọn buổi dạy cần nghỉ / đổi.");
    if (type === "reschedule") {
      if (!pDate || !pStart || !pEnd) return setError("Nhập đủ ngày và giờ đề xuất.");
      if (pEnd <= pStart) return setError("Giờ kết thúc phải sau giờ bắt đầu.");
    }
    setBusy(true);
    setError(null);
    try {
      await createChangeRequest({
        session_id: sessionId,
        teacher_id: teacherId,
        type,
        reason: reason.trim() || null,
        proposed_date: type === "reschedule" ? pDate : null,
        proposed_start_time: type === "reschedule" ? pStart : null,
        proposed_end_time: type === "reschedule" ? pEnd : null,
      });
      onSaved();
    } catch (e) {
      const err = e as { code?: string };
      setError(
        err?.code === "23505"
          ? "Buổi này đã có một yêu cầu đang chờ duyệt."
          : dbErrorMessage(e),
      );
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tạo yêu cầu nghỉ / đổi buổi" className="max-w-xl">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        {sessions.error && <ErrorNote message={sessions.error} />}

        <Field label="Buổi dạy" required>
          {sessions.loading ? (
            <LoadingRows rows={1} className="p-0" />
          ) : candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Bạn không có buổi dạy nào sắp tới trong 60 ngày.
            </p>
          ) : (
            <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">— Chọn buổi —</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class?.name ?? "?"} · {fmtSession(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Loại yêu cầu" required>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(REQUEST_TYPE_LABELS) as ChangeRequestType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                  (type === t
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "text-muted-foreground hover:bg-secondary")
                }
              >
                {REQUEST_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        {type === "reschedule" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Ngày mới" required>
              <Input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} />
            </Field>
            <Field label="Bắt đầu" required>
              <Input type="time" value={pStart} onChange={(e) => setPStart(e.target.value)} />
            </Field>
            <Field label="Kết thúc" required>
              <Input type="time" value={pEnd} onChange={(e) => setPEnd(e.target.value)} />
            </Field>
          </div>
        )}

        <Field
          label="Lý do"
          hint={
            type === "leave"
              ? "Trung tâm sẽ xếp giáo viên dạy thay hoặc hủy buổi này."
              : "Buổi chỉ đổi lịch sau khi trung tâm duyệt — học viên sẽ được thông báo."
          }
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="VD: bận việc gia đình, lịch khám bệnh..."
          />
        </Field>

        {selected && type === "reschedule" && (
          <p className="text-xs text-muted-foreground">
            Buổi hiện tại: {fmtSession(selected)}
            {selected.room ? ` · P.${selected.room.name}` : ""} — phòng giữ nguyên khi đổi lịch.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={busy || !sessionId}>
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
