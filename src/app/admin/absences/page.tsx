"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX2, History, Phone, PhoneCall, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import {
  addStudentContact,
  fetchAbsenceStreaks,
  fetchStudentContacts,
  CONTACT_CHANNEL_LABELS,
  CONTACT_OUTCOME_LABELS,
  type AbsenceStreakRow,
  type ContactChannel,
  type ContactLogRow,
  type ContactOutcome,
} from "@/lib/db-care";
import { useLoad } from "@/lib/use-load";

type ContactFilter = "all" | "todo" | "done";

function fmtDate(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Số ngày kể từ buổi vắng đầu tiên của chuỗi — càng lâu càng dễ mất em. */
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso + "T00:00:00").getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export default function AdminAbsencesPage() {
  const { user } = useAuth();
  const [minStreak, setMinStreak] = useState(2);
  const { data, loading, error, reload } = useLoad(() => fetchAbsenceStreaks(minStreak), [minStreak]);

  const [q, setQ] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [logging, setLogging] = useState<AbsenceStreakRow | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (contactFilter === "todo" && r.contactedAfterAbsence) return false;
      if (contactFilter === "done" && !r.contactedAfterAbsence) return false;
      if (!needle) return true;
      return `${r.name} ${r.student_code ?? ""} ${r.parentName ?? ""} ${r.className ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, contactFilter]);

  const todoCount = rows.filter((r) => !r.contactedAfterAbsence).length;

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} />}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold sm:text-xl">Vắng {minStreak} buổi liên tiếp</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Liên hệ phụ huynh để hỗ trợ học viên quay lại lớp — {todoCount} em chưa ai gọi.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Tổng: <b className="text-foreground">{loading ? "..." : filtered.length}</b>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">Ngưỡng</span>
              <Select
                wrapClassName="flex-1"
                value={minStreak}
                onChange={(e) => setMinStreak(Number(e.target.value))}
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>Vắng từ {n} buổi liên tiếp</option>
                ))}
              </Select>
            </label>
            <Select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
            >
              <option value="all">Tất cả</option>
              <option value="todo">Chưa liên hệ</option>
              <option value="done">Đã liên hệ</option>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm học viên, lớp, phụ huynh..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={CalendarX2}
          title={rows.length === 0 ? "Không có học viên vắng liên tiếp 🎉" : "Không có ai khớp bộ lọc"}
          description={
            rows.length === 0
              ? `Chưa em nào vắng từ ${minStreak} buổi liền. Hạ ngưỡng xuống để dò sớm hơn.`
              : "Thử đổi từ khóa hoặc bỏ bộ lọc trạng thái liên hệ."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <StreakCard
              key={row.id}
              row={row}
              onLog={() => setLogging(row)}
            />
          ))}
        </div>
      )}

      {logging && user && (
        <ContactModal
          row={logging}
          onClose={() => setLogging(null)}
          onSaved={() => {
            setLogging(null);
            reload();
          }}
          userId={user.id}
        />
      )}
    </div>
  );
}

/* ================= Một học viên đang vắng ================= */

function StreakCard({ row, onLog }: { row: AbsenceStreakRow; onLog: () => void }) {
  const [history, setHistory] = useState<ContactLogRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const firstMissed = row.missed[row.missed.length - 1]?.date;

  async function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    setLoadingHistory(true);
    try {
      setHistory(await fetchStudentContacts(row.id));
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <Card className={cn(!row.contactedAfterAbsence && "border-l-4 border-l-destructive")}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={row.name} src={row.avatar ?? undefined} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/members/${row.id}`} className="font-semibold hover:underline">
                {row.name}
              </Link>
              <Badge variant="destructive">Vắng {row.streak} buổi liền</Badge>
              {row.study_status === "reserved" && <Badge variant="gold">Bảo lưu</Badge>}
              {row.contactedAfterAbsence ? (
                <Badge variant="jade">Đã liên hệ</Badge>
              ) : (
                <Badge variant="muted">Chưa liên hệ</Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.student_code ?? "—"}
              {row.className ? ` · ${row.className}` : ""}
              {firstMissed ? ` · nghỉ từ ${fmtDate(firstMissed)} (${daysSince(firstMissed)} ngày)` : ""}
              {row.lastPresent ? ` · đi học gần nhất ${fmtDate(row.lastPresent)}` : " · chưa từng đi học"}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {row.missed.map((m) => (
                <Badge
                  key={m.date}
                  variant={m.status === "absent_unexcused" ? "destructive" : "gold"}
                  title={m.status === "absent_unexcused" ? "Vắng không phép" : "Vắng có phép"}
                >
                  {fmtDate(m.date)}
                </Badge>
              ))}
            </div>

            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Phụ huynh: </span>
              {row.parentName ?? "chưa có hồ sơ phụ huynh"}
              {(row.parentPhone || row.phone) && (
                <a
                  href={`tel:${row.parentPhone ?? row.phone}`}
                  className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {row.parentPhone ?? row.phone}
                </a>
              )}
            </div>

            {row.lastContact && (
              <p className="mt-1 text-xs text-muted-foreground">
                Lần gần nhất: {CONTACT_CHANNEL_LABELS[row.lastContact.channel]} ·{" "}
                {CONTACT_OUTCOME_LABELS[row.lastContact.outcome]} ·{" "}
                {fmtDateTime(row.lastContact.contacted_at)}
                {row.lastContact.contacted_by_name ? ` · ${row.lastContact.contacted_by_name}` : ""}
                {row.lastContact.note ? ` — “${row.lastContact.note}”` : ""}
              </p>
            )}

            {history && (
              <div className="mt-2 space-y-1 rounded-lg bg-muted/60 p-2.5">
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có lần liên hệ nào được ghi.</p>
                ) : (
                  history.map((h) => (
                    <p key={h.id} className="text-xs text-muted-foreground">
                      {fmtDateTime(h.contacted_at)} · {CONTACT_CHANNEL_LABELS[h.channel]} ·{" "}
                      {CONTACT_OUTCOME_LABELS[h.outcome]}
                      {h.contacted_by_name ? ` · ${h.contacted_by_name}` : ""}
                      {h.note ? ` — ${h.note}` : ""}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Button size="sm" onClick={onLog}>
              <PhoneCall className="h-3.5 w-3.5" /> Ghi nhận liên hệ
            </Button>
            <Button size="sm" variant="outline" onClick={toggleHistory} disabled={loadingHistory}>
              <History className="h-3.5 w-3.5" />
              {history ? "Ẩn lịch sử" : loadingHistory ? "Đang tải..." : "Lịch sử"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================= Ghi nhận một lần liên hệ ================= */

function ContactModal({
  row,
  userId,
  onClose,
  onSaved,
}: {
  row: AbsenceStreakRow;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [channel, setChannel] = useState<ContactChannel>("call");
  const [outcome, setOutcome] = useState<ContactOutcome>("reached");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addStudentContact({
        student_id: row.id,
        channel,
        outcome,
        note,
        contacted_by: userId,
      });
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ghi nhận liên hệ — ${row.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          {row.parentName ?? "Phụ huynh"}
          {row.parentPhone ? ` · ${row.parentPhone}` : row.phone ? ` · ${row.phone}` : ""} — vắng{" "}
          {row.streak} buổi liên tiếp.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kênh liên hệ">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)}>
              {(Object.keys(CONTACT_CHANNEL_LABELS) as ContactChannel[]).map((k) => (
                <option key={k} value={k}>{CONTACT_CHANNEL_LABELS[k]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kết quả">
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value as ContactOutcome)}>
              {(Object.keys(CONTACT_OUTCOME_LABELS) as ContactOutcome[]).map((k) => (
                <option key={k} value={k}>{CONTACT_OUTCOME_LABELS[k]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú" hint="Phụ huynh nói gì, hẹn khi nào quay lại, có cần xếp học bù không...">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}
