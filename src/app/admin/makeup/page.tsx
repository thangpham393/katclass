"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Search, Undo2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  createStandaloneMakeupSession,
  fetchMakeupCredits,
  fetchProfilesByRole,
  fetchRooms,
  fetchUpcomingSessions,
  scheduleMakeup,
  sessionClassLabel,
  resetMakeup,
  dbErrorMessage,
  todayISO,
  WEEKDAY_LABELS,
  type MakeupCreditRow,
  type SessionRow,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

function fmtSession(s: { date: string; start_time: string; end_time: string } | null): string {
  if (!s) return "?";
  const d = new Date(s.date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
}

export default function AdminMakeupPage() {
  const credits = useLoad(() => fetchMakeupCredits(["pending", "scheduled"]));
  const [assigning, setAssigning] = useState<MakeupCreditRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = (credits.data ?? []).filter((c) => c.status === "pending");
  const scheduled = (credits.data ?? []).filter((c) => c.status === "scheduled");

  async function handleReset(credit: MakeupCreditRow) {
    if (!confirm(`Bỏ xếp bù cho ${credit.student.name}? Học viên quay lại danh sách chờ.`)) return;
    setError(null);
    try {
      await resetMakeup(credit.id);
      credits.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Học bù</h1>
        <p className="mt-1 text-muted-foreground">
          Học viên vắng có phép tự động vào danh sách chờ — xếp vào buổi phù hợp để học bù.
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      {credits.error && <ErrorNote message={credits.error} />}

      <Card>
        <CardHeader>
          <CardTitle>
            Chờ xếp bù <Badge variant="gold" className="ml-1">{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {credits.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : pending.length === 0 ? (
            <Empty
              icon={CalendarClock}
              title="Không có học viên chờ học bù"
              description="Khi giáo viên điểm danh “vắng có phép”, học viên sẽ tự động vào danh sách này."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {pending.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={c.student.name} src={c.student.avatar ?? undefined} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {c.student.name}
                      {c.student.student_code && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{c.student.student_code}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Vắng buổi {fmtSession(c.missed_session)} · {c.missed_session?.class?.name ?? "?"}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setAssigning(c)}>
                    <CalendarClock className="h-3.5 w-3.5" /> Xếp bù
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Đã xếp, chờ học <Badge variant="muted" className="ml-1">{scheduled.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {credits.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : scheduled.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có lượt học bù nào đang chờ diễn ra. Khi giáo viên điểm danh &ldquo;học bù&rdquo;, lượt sẽ tự đóng.
            </div>
          ) : (
            <div className="divide-y">
              {scheduled.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={c.student.name} src={c.student.avatar ?? undefined} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.student.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Vắng {fmtSession(c.missed_session)} ({c.missed_session?.class?.name ?? "?"}) → học bù{" "}
                      <span className="font-medium text-foreground">
                        {fmtSession(c.makeup_session)} ({c.makeup_session?.class?.name ?? "buổi bù riêng"})
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleReset(c)}>
                    <Undo2 className="h-3.5 w-3.5" /> Bỏ xếp
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {assigning && (
        <AssignMakeupModal
          credit={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            credits.reload();
          }}
        />
      )}
    </div>
  );
}

function AssignMakeupModal({
  credit,
  onClose,
  onSaved,
}: {
  credit: MakeupCreditRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "create">("existing");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Xếp học bù — ${credit.student.name}`}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Vắng buổi {fmtSession(credit.missed_session)} · lớp{" "}
          <span className="font-medium text-foreground">{credit.missed_session?.class?.name ?? "?"}</span>.
        </p>

        {/* Chọn cách xếp bù */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-secondary/40 p-1">
          {(
            [
              { key: "existing", label: "Xếp vào buổi có sẵn", icon: CalendarClock },
              { key: "create", label: "Tạo buổi bù riêng", icon: CalendarPlus },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                mode === t.key ? "bg-card text-brand-700 shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <PickExistingSession credit={credit} onSaved={onSaved} />
        ) : (
          <CreateStandaloneSession credit={credit} onSaved={onSaved} />
        )}
      </div>
    </Modal>
  );
}

/** Xếp vào buổi sắp tới của lớp khác (hoặc buổi bù riêng đã tạo trước đó). */
function PickExistingSession({ credit, onSaved }: { credit: MakeupCreditRow; onSaved: () => void }) {
  const sessions = useLoad(fetchUpcomingSessions);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    // Không xếp bù vào chính buổi đã vắng
    const list = (sessions.data ?? []).filter((s) => s.id !== credit.missed_session?.id);
    if (!q.trim()) return list.slice(0, 50);
    const needle = q.trim().toLowerCase();
    return list
      .filter((s) => sessionClassLabel(s).toLowerCase().includes(needle))
      .slice(0, 50);
  }, [sessions.data, q, credit.missed_session?.id]);

  async function handlePick(s: SessionRow) {
    setBusy(s.id);
    setError(null);
    try {
      await scheduleMakeup(credit.id, s.id);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorNote message={error} />}
      <p className="text-sm text-muted-foreground">
        Chọn một buổi sắp tới (ưu tiên lớp cùng trình độ) — buổi bù riêng đã tạo cũng hiện trong danh sách,
        có thể xếp thêm nhiều học viên vào cùng một buổi.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên lớp..."
          className="pl-9"
          autoFocus
        />
      </div>
      {sessions.loading ? (
        <LoadingRows rows={4} className="p-0" />
      ) : candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Không có buổi sắp tới phù hợp. Sinh buổi học cho các lớp trước, hoặc chuyển sang “Tạo buổi bù riêng”.
        </p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
          {candidates.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {sessionClassLabel(s)}
                  {!s.class && <Badge variant="gold">Buổi bù riêng</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtSession(s)}
                  {s.room ? ` · P.${s.room.name}` : ""}
                  {s.teacher ? ` · GV ${s.teacher.name}` : ""}
                </div>
              </div>
              <Button size="sm" variant="secondary" disabled={busy === s.id} onClick={() => handlePick(s)}>
                {busy === s.id ? "..." : "Chọn"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tạo buổi học bù độc lập (không gắn lớp) rồi xếp học viên vào luôn. */
function CreateStandaloneSession({ credit, onSaved }: { credit: MakeupCreditRow; onSaved: () => void }) {
  const rooms = useLoad(fetchRooms);
  const teachers = useLoad(() => fetchProfilesByRole("teacher"));
  const [date, setDate] = useState(todayISO(1));
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:30");
  const [roomId, setRoomId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!date) return setError("Chọn ngày học bù.");
    if (!startTime || !endTime || endTime <= startTime)
      return setError("Giờ kết thúc phải sau giờ bắt đầu.");
    if (!teacherId) return setError("Chọn giáo viên đứng buổi (để tính công).");

    setBusy(true);
    setError(null);
    try {
      const sessionId = await createStandaloneMakeupSession({
        date,
        start_time: startTime,
        end_time: endTime,
        room_id: roomId || null,
        teacher_id: teacherId,
        note: note || `Buổi học bù riêng — ${credit.student.name}`,
      });
      await scheduleMakeup(credit.id, sessionId);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorNote message={error} />}
      <p className="text-sm text-muted-foreground">
        Buổi bù riêng không gắn lớp nào — học xong là khép lại. Giáo viên đứng buổi vẫn được
        tính công bình thường; buổi hiện trên thời khóa biểu và lịch của giáo viên/học viên.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ngày" required>
          <Input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Bắt đầu" required>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="Kết thúc" required>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Giáo viên" required hint="Buổi hoàn thành sẽ tính 1 công cho GV này.">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— Chọn giáo viên —</option>
            {(teachers.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Phòng học" hint="Hệ thống tự chặn nếu phòng/GV trùng giờ buổi khác.">
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">— Không đặt phòng —</option>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>Phòng {r.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Ghi chú">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`vd: Học bù riêng cho ${credit.student.name}`}
        />
      </Field>

      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={busy || rooms.loading || teachers.loading}>
          <CalendarPlus className="h-4 w-4" />
          {busy ? "Đang tạo..." : "Tạo buổi & xếp học bù"}
        </Button>
      </div>
    </div>
  );
}
