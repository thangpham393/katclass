"use client";

import { useMemo, useState } from "react";
import { CalendarOff, CalendarX2, CheckCircle2, Search, UserCheck, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchProfilesByRole,
  dbErrorMessage,
  WEEKDAY_LABELS,
  type ProfileRow,
} from "@/lib/db";
import {
  fetchChangeRequests,
  approveWithSubstitute,
  approveCancelSession,
  approveReschedule,
  rejectChangeRequest,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  RESOLUTION_LABELS,
  type ChangeRequestRow,
} from "@/lib/db-requests";
import { useLoad } from "@/lib/use-load";

function fmtSession(s: { date: string; start_time: string; end_time: string } | null): string {
  if (!s) return "?";
  const d = new Date(s.date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
}

function fmtProposed(r: ChangeRequestRow): string {
  if (!r.proposed_date) return "?";
  const d = new Date(r.proposed_date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")} · ${r.proposed_start_time?.slice(0, 5)}–${r.proposed_end_time?.slice(0, 5)}`;
}

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const adminId = user?.id ?? "";

  const requests = useLoad(() => fetchChangeRequests(["pending", "approved", "rejected"]));
  const [assigning, setAssigning] = useState<ChangeRequestRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pending = (requests.data ?? []).filter((r) => r.status === "pending");
  const resolved = (requests.data ?? []).filter((r) => r.status !== "pending").slice(0, 30);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await action();
      requests.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function handleCancelSession(r: ChangeRequestRow) {
    if (
      !confirm(
        `Hủy buổi ${fmtSession(r.session)} của lớp ${r.session?.class?.name ?? "?"}?\n` +
          "Học viên và phụ huynh sẽ nhận thông báo buổi học bị hủy.",
      )
    )
      return;
    run(r.id, () => approveCancelSession(r, null, adminId));
  }

  function handleApproveReschedule(r: ChangeRequestRow) {
    if (
      !confirm(
        `Duyệt đổi buổi ${fmtSession(r.session)} (lớp ${r.session?.class?.name ?? "?"})\n` +
          `sang ${fmtProposed(r)}?\nHọc viên và phụ huynh sẽ nhận thông báo lịch mới.`,
      )
    )
      return;
    run(r.id, () => approveReschedule(r, null, adminId));
  }

  function handleReject(r: ChangeRequestRow) {
    const note = prompt("Lý do từ chối (để trống nếu không cần):");
    if (note === null) return;
    run(r.id, () => rejectChangeRequest(r.id, note.trim() || null, adminId));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Duyệt nghỉ / đổi buổi</h1>
        <p className="mt-1 text-muted-foreground">
          Giáo viên xin nghỉ hoặc đề xuất đổi buổi — duyệt và xếp dạy thay tại đây.
          Học viên, phụ huynh được thông báo tự động khi lịch thay đổi.
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      {requests.error && <ErrorNote message={requests.error} />}

      <Card>
        <CardHeader>
          <CardTitle>
            Chờ duyệt <Badge variant="gold" className="ml-1">{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {requests.loading ? (
            <LoadingRows rows={3} className="p-0" />
          ) : pending.length === 0 ? (
            <Empty
              icon={CalendarOff}
              title="Không có yêu cầu nào chờ duyệt"
              description="Khi giáo viên gửi yêu cầu nghỉ / đổi buổi, yêu cầu sẽ hiện ở đây."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {pending.map((r) => (
                <div key={r.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{r.teacher?.name ?? "?"}</span>
                    <Badge variant={r.type === "leave" ? "destructive" : "gold"}>
                      {REQUEST_TYPE_LABELS[r.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      gửi {new Date(r.created_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Lớp <span className="font-medium text-foreground">{r.session?.class?.name ?? "?"}</span>{" "}
                    · buổi {fmtSession(r.session)}
                    {r.type === "reschedule" && (
                      <>
                        {" "}→ đề xuất{" "}
                        <span className="font-medium text-foreground">{fmtProposed(r)}</span>
                      </>
                    )}
                  </div>
                  {r.reason && (
                    <div className="mt-0.5 text-xs text-muted-foreground">Lý do: {r.reason}</div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {r.type === "leave" ? (
                      <>
                        <Button size="sm" disabled={busy === r.id} onClick={() => setAssigning(r)}>
                          <UserCheck className="h-3.5 w-3.5" /> Xếp dạy thay
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => handleCancelSession(r)}
                        >
                          <CalendarX2 className="h-3.5 w-3.5" /> Hủy buổi
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" disabled={busy === r.id} onClick={() => handleApproveReschedule(r)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt & áp lịch mới
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => handleReject(r)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Từ chối
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Đã xử lý gần đây <Badge variant="muted" className="ml-1">{resolved.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {requests.loading ? (
            <LoadingRows rows={2} className="p-0" />
          ) : resolved.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa xử lý yêu cầu nào.
            </div>
          ) : (
            <div className="divide-y">
              {resolved.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{r.teacher?.name ?? "?"}</span>
                      <span className="text-xs text-muted-foreground">{REQUEST_TYPE_LABELS[r.type]}</span>
                      <Badge variant={r.status === "approved" ? "jade" : "destructive"}>
                        {REQUEST_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.session?.class?.name ?? "?"} · {fmtSession(r.session)}
                      {r.status === "approved" && r.resolution && (
                        <>
                          {" "}·{" "}
                          <span className="font-medium text-foreground">
                            {RESOLUTION_LABELS[r.resolution]}
                            {r.resolution === "substitute" && r.substitute_teacher
                              ? `: ${r.substitute_teacher.name}`
                              : ""}
                          </span>
                        </>
                      )}
                      {r.resolution_note ? ` · ${r.resolution_note}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {assigning && (
        <AssignSubstituteModal
          request={assigning}
          adminId={adminId}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            requests.reload();
          }}
        />
      )}
    </div>
  );
}

function AssignSubstituteModal({
  request,
  adminId,
  onClose,
  onSaved,
}: {
  request: ChangeRequestRow;
  adminId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const teachers = useLoad(() => fetchProfilesByRole("teacher"));
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    // Không xếp chính GV đang xin nghỉ dạy thay
    const list = (teachers.data ?? []).filter((t) => t.id !== request.teacher?.id);
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        (t.student_code ?? "").toLowerCase().includes(needle),
    );
  }, [teachers.data, q, request.teacher?.id]);

  async function handlePick(t: ProfileRow) {
    setBusy(t.id);
    setError(null);
    try {
      await approveWithSubstitute(request, t.id, note.trim() || null, adminId);
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
      title={`Xếp dạy thay — ${request.teacher?.name ?? "?"} xin nghỉ`}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        {error && <ErrorNote message={error} />}
        <p className="text-sm text-muted-foreground">
          Buổi {fmtSession(request.session)} · lớp{" "}
          <span className="font-medium text-foreground">{request.session?.class?.name ?? "?"}</span>.
          Chọn giáo viên dạy thay — nếu GV trùng lịch buổi khác, hệ thống sẽ báo lỗi ngay.
        </p>
        <Field label="Ghi chú duyệt (tùy chọn)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm giáo viên theo tên hoặc mã..."
            className="pl-9"
            autoFocus
          />
        </div>
        {teachers.loading ? (
          <LoadingRows rows={4} className="p-0" />
        ) : candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Không tìm thấy giáo viên phù hợp.
          </p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
            {candidates.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <Avatar name={t.name} src={t.avatar ?? undefined} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {t.name}
                    {t.student_code && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {t.student_code}
                      </span>
                    )}
                  </div>
                  {t.phone && <div className="text-xs text-muted-foreground">{t.phone}</div>}
                </div>
                <Button size="sm" variant="secondary" disabled={busy === t.id} onClick={() => handlePick(t)}>
                  {busy === t.id ? "..." : "Chọn"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
