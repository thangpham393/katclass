"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  Check,
  Search,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, dbErrorMessage, MAKEUP_STATUS_LABELS } from "@/lib/db";
import { fetchMyClasses, fetchMyUpcomingSessions, type UpcomingSessionRow } from "@/lib/db-student";
import {
  ABSENCE_STATUS_LABELS,
  cancelAbsenceRequest,
  createAbsenceRequest,
  fetchAvailableMakeupSessions,
  fetchMyAbsenceRequests,
  fetchMyMakeupCredits,
  proposeMakeupSlot,
  type AvailableSessionRow,
  type MyMakeupCreditRow,
} from "@/lib/db-absence";

function fmtSession(s: { date: string; start_time: string; end_time: string } | null): string {
  if (!s) return "?";
  const d = new Date(s.date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
}

/**
 * ĐĂNG KÝ HỌC BÙ (khu học viên).
 *
 * Hai việc trong một trang:
 *   1. Báo nghỉ trước một buổi sắp tới (kèm ca bù mong muốn) — gửi đơn cho
 *      trung tâm duyệt, KHÔNG tự đổi lịch.
 *   2. Với các lượt học bù đang chờ xếp (kể cả lượt sinh ra do giáo viên
 *      điểm danh "vắng có phép"), chọn ca bù mong muốn để trung tâm xếp
 *      đúng buổi mình đi được.
 *
 * Buổi của lớp khác học viên không đọc được trực tiếp (RLS) nên danh sách ca
 * bù đi qua hàm `available_makeup_sessions` (migration 0029).
 */
export default function StudentMakeupPage() {
  const { user } = useAuth();
  const studentId = user?.id ?? "";

  const classes = useLoad(
    () => (studentId ? fetchMyClasses(studentId) : Promise.resolve([])),
    [studentId],
  );
  const classIds = (classes.data ?? [])
    .filter((c) => c.class && c.class.status !== "cancelled")
    .map((c) => c.class_id);
  const classKey = classIds.join(",");

  const upcoming = useLoad(
    () =>
      studentId && classes.data
        ? fetchMyUpcomingSessions(studentId, classIds, 30)
        : Promise.resolve([]),
    [studentId, classKey, !!classes.data],
  );
  const requests = useLoad(
    () => (studentId ? fetchMyAbsenceRequests(studentId) : Promise.resolve([])),
    [studentId],
  );
  const credits = useLoad(
    () => (studentId ? fetchMyMakeupCredits(studentId) : Promise.resolve([])),
    [studentId],
  );

  const [absentFor, setAbsentFor] = useState<UpcomingSessionRow | null>(null);
  const [pickFor, setPickFor] = useState<MyMakeupCreditRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Buổi đã gửi đơn rồi thì không cho gửi lần nữa (DB cũng chặn bằng unique)
  const requestedSessionIds = new Set(
    (requests.data ?? []).filter((r) => r.status !== "cancelled").map((r) => r.session_id),
  );
  const myUpcoming = (upcoming.data ?? []).filter((s) => !s.isMakeupForMe);

  const openRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const doneRequests = (requests.data ?? []).filter((r) => r.status !== "pending");
  const openCredits = (credits.data ?? []).filter(
    (c) => c.status === "pending" || c.status === "scheduled",
  );

  async function handleCancel(id: string) {
    if (!confirm("Rút đơn xin nghỉ này?")) return;
    setError(null);
    try {
      await cancelAbsenceRequest(id);
      requests.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Đăng ký học bù</h1>
        <p className="mt-1 text-muted-foreground">
          Báo trước buổi bạn không đi học được và chọn ca học bù phù hợp — trung tâm sẽ xếp lịch
          và báo lại cho bạn.
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      {/* 1. Báo nghỉ buổi sắp tới */}
      <Card>
        <CardHeader>
          <CardTitle>Buổi học sắp tới</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {upcoming.error && <ErrorNote message={upcoming.error} />}
          {upcoming.loading || classes.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : myUpcoming.length === 0 ? (
            <Empty
              icon={CalendarClock}
              title="Chưa có buổi học nào sắp tới"
              description="Khi trung tâm xếp lịch cho lớp của bạn, các buổi sẽ hiện ở đây."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {myUpcoming.map((s) => {
                const sent = requestedSessionIds.has(s.id);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.class?.name ?? "Buổi học"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {fmtSession(s)}
                        {s.room ? ` · P.${s.room.name}` : ""}
                      </div>
                    </div>
                    {sent ? (
                      <Badge variant="muted">Đã gửi đơn</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setAbsentFor(s)}>
                        <CalendarOff className="h-3.5 w-3.5" /> Báo nghỉ
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Đơn đã gửi */}
      {(openRequests.length > 0 || doneRequests.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>
              Đơn xin nghỉ của tôi
              {openRequests.length > 0 && (
                <Badge variant="gold" className="ml-1.5">{openRequests.length} chờ duyệt</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            {requests.error && <ErrorNote message={requests.error} />}
            <div className="divide-y">
              {[...openRequests, ...doneRequests].map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      {r.session?.class?.name ?? "Buổi học"}
                      <Badge
                        variant={
                          r.status === "approved"
                            ? "jade"
                            : r.status === "pending"
                              ? "gold"
                              : "muted"
                        }
                      >
                        {ABSENCE_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Nghỉ buổi {fmtSession(r.session)}
                      {r.reason ? ` · lý do: ${r.reason}` : ""}
                    </div>
                    {r.preferred_session && (
                      <div className="truncate text-xs text-muted-foreground">
                        Muốn học bù vào {fmtSession(r.preferred_session)}
                        {r.preferred_session.class ? ` · ${r.preferred_session.class.name}` : ""}
                      </div>
                    )}
                    {r.resolution_note && (
                      <div className="truncate text-xs text-muted-foreground">
                        Trung tâm trả lời: {r.resolution_note}
                      </div>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(r.id)}>
                      <Undo2 className="h-3.5 w-3.5" /> Rút đơn
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Lượt học bù */}
      <Card>
        <CardHeader>
          <CardTitle>Lượt học bù của tôi</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {credits.error && <ErrorNote message={credits.error} />}
          {credits.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : openCredits.length === 0 ? (
            <Empty
              icon={CalendarPlus}
              title="Bạn chưa có buổi nào cần học bù"
              description="Buổi nghỉ có phép sẽ thành một lượt học bù ở đây, chọn ca bạn đi được rồi trung tâm xếp lịch."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {openCredits.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                      Vắng buổi {fmtSession(c.missed_session)}
                      <Badge variant={c.status === "scheduled" ? "jade" : "gold"}>
                        {MAKEUP_STATUS_LABELS[c.status]}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.missed_session?.class?.name ?? "Lớp của bạn"}
                    </div>
                    {c.status === "scheduled" && c.makeup_session && (
                      <div className="truncate text-xs font-medium text-emerald-700">
                        Đã xếp bù: {fmtSession(c.makeup_session)}
                        {c.makeup_session.class ? ` · ${c.makeup_session.class.name}` : " · buổi bù riêng"}
                      </div>
                    )}
                    {c.status === "pending" && c.preferred_session && (
                      <div className="truncate text-xs text-muted-foreground">
                        Bạn đã chọn: {fmtSession(c.preferred_session)} — chờ trung tâm xếp lịch
                      </div>
                    )}
                  </div>
                  {c.status === "pending" && (
                    <Button size="sm" variant="secondary" onClick={() => setPickFor(c)}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {c.preferred_session ? "Đổi ca bù" : "Chọn ca bù"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {absentFor && (
        <AbsenceModal
          studentId={studentId}
          session={absentFor}
          onClose={() => setAbsentFor(null)}
          onSaved={() => {
            setAbsentFor(null);
            requests.reload();
          }}
        />
      )}

      {pickFor && (
        <PickSlotModal
          studentId={studentId}
          credit={pickFor}
          onClose={() => setPickFor(null)}
          onSaved={() => {
            setPickFor(null);
            credits.reload();
          }}
        />
      )}
    </div>
  );
}

/** Gửi đơn xin nghỉ cho một buổi sắp tới, kèm ca bù mong muốn (tùy chọn). */
function AbsenceModal({
  studentId,
  session,
  onClose,
  onSaved,
}: {
  studentId: string;
  session: UpcomingSessionRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [preferred, setPreferred] = useState<AvailableSessionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason.trim()) return setError("Ghi giúp trung tâm lý do nghỉ nhé.");
    setBusy(true);
    setError(null);
    try {
      await createAbsenceRequest({
        student_id: studentId,
        session_id: session.id,
        reason: reason.trim(),
        preferred_session_id: preferred?.id ?? null,
      });
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Báo nghỉ buổi học" className="max-w-2xl">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <p className="text-sm text-muted-foreground">
          Nghỉ buổi <span className="font-medium text-foreground">{fmtSession(session)}</span>
          {session.class ? ` · lớp ${session.class.name}` : ""}. Trung tâm duyệt xong sẽ tính là
          nghỉ có phép và tạo cho bạn một lượt học bù.
        </p>

        <Field label="Lý do nghỉ" required>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="vd: em bị ốm, gia đình có việc..."
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-1.5 text-sm font-medium">
            Ca học bù mong muốn <span className="font-normal text-muted-foreground">(có thể bỏ qua)</span>
          </div>
          <SessionPicker
            studentId={studentId}
            excludeId={session.id}
            selectedId={preferred?.id ?? null}
            onPick={(s) => setPreferred((cur) => (cur?.id === s.id ? null : s))}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Để sau</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            <Check className="h-4 w-4" />
            {busy ? "Đang gửi..." : "Gửi đơn"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Chọn ca bù mong muốn cho một lượt học bù đang chờ xếp. */
function PickSlotModal({
  studentId,
  credit,
  onClose,
  onSaved,
}: {
  studentId: string;
  credit: MyMakeupCreditRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(s: AvailableSessionRow) {
    setBusy(s.id);
    setError(null);
    try {
      await proposeMakeupSlot(credit.id, s.id);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Chọn ca học bù" className="max-w-2xl">
      <div className="space-y-3">
        {error && <ErrorNote message={error} />}
        <p className="text-sm text-muted-foreground">
          Bù cho buổi <span className="font-medium text-foreground">{fmtSession(credit.missed_session)}</span>.
          Chọn buổi bạn đi học được — trung tâm sẽ xác nhận rồi báo lại, chưa phải là đã xếp lịch.
        </p>
        <SessionPicker
          studentId={studentId}
          excludeId={credit.missed_session?.id ?? null}
          selectedId={credit.preferred_session?.id ?? null}
          busyId={busy}
          onPick={handlePick}
        />
      </div>
    </Modal>
  );
}

/** Danh sách buổi sắp tới cùng chi nhánh để chọn làm ca bù. */
function SessionPicker({
  studentId,
  excludeId,
  selectedId,
  busyId,
  onPick,
}: {
  studentId: string;
  excludeId: string | null;
  selectedId: string | null;
  busyId?: string | null;
  onPick: (s: AvailableSessionRow) => void;
}) {
  const sessions = useLoad(
    () => (studentId ? fetchAvailableMakeupSessions(studentId) : Promise.resolve([])),
    [studentId],
  );
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = (sessions.data ?? []).filter((s) => s.id !== excludeId);
    const needle = q.trim().toLowerCase();
    if (!needle) return all.slice(0, 60);
    return all
      .filter((s) =>
        `${s.class_name} ${s.course_name ?? ""} ${s.level ?? ""}`.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [sessions.data, q, excludeId]);

  return (
    <div className="space-y-2">
      {sessions.error && <ErrorNote message={sessions.error} />}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên lớp hoặc trình độ..."
          className="pl-9"
        />
      </div>
      {sessions.loading ? (
        <LoadingRows rows={3} className="p-0" />
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có buổi nào sắp tới để chọn. Bạn cứ gửi đơn, trung tâm sẽ xếp ca bù phù hợp.
        </p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
          {list.map((s) => {
            const active = selectedId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={busyId === s.id}
                onClick={() => onPick(s)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  active ? "border-brand-400 bg-brand-50" : "hover:bg-secondary/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold">
                    {s.class_name}
                    {s.level && <Badge variant="muted">{s.level}</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {fmtSession(s)}
                    {s.room_name ? ` · P.${s.room_name}` : ""}
                    {s.teacher_name ? ` · GV ${s.teacher_name}` : ""}
                  </div>
                </div>
                {busyId === s.id ? (
                  <span className="shrink-0 text-xs text-muted-foreground">...</span>
                ) : active ? (
                  <Check className="h-4 w-4 shrink-0 text-brand-600" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
