"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Search, Undo2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchMakeupCredits,
  fetchUpcomingSessions,
  scheduleMakeup,
  resetMakeup,
  dbErrorMessage,
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
                        {fmtSession(c.makeup_session)} ({c.makeup_session?.class?.name ?? "?"})
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
  const sessions = useLoad(fetchUpcomingSessions);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    // Không xếp bù vào chính buổi đã vắng
    const list = (sessions.data ?? []).filter((s) => s.id !== credit.missed_session?.id);
    if (!q.trim()) return list.slice(0, 50);
    const needle = q.trim().toLowerCase();
    return list.filter((s) => s.class?.name?.toLowerCase().includes(needle)).slice(0, 50);
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
    <Modal
      open
      onClose={onClose}
      title={`Xếp học bù — ${credit.student.name}`}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        {error && <ErrorNote message={error} />}
        <p className="text-sm text-muted-foreground">
          Vắng buổi {fmtSession(credit.missed_session)} · lớp{" "}
          <span className="font-medium text-foreground">{credit.missed_session?.class?.name ?? "?"}</span>.
          Chọn một buổi sắp tới (ưu tiên lớp cùng trình độ) để học bù.
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
            Không có buổi sắp tới phù hợp. Sinh buổi học cho các lớp trước (trang chi tiết lớp).
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
            {candidates.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.class?.name ?? "?"}</div>
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
    </Modal>
  );
}
