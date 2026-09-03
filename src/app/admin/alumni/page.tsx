"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  PhoneCall,
  Search,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatTile } from "@/components/ui/stat-tile";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { dbErrorMessage, todayISO, STUDY_STATUS_LABELS } from "@/lib/db";
import { addStudentContact, CONTACT_CHANNEL_LABELS, type ContactChannel } from "@/lib/db-care";
import {
  agoLabel,
  fetchAlumni,
  isPreventable,
  reactivateStudent,
  reasonStats,
  saveLeaveInfo,
  LEAVE_REASONS,
  LEAVE_REASON_LABELS,
  type AlumniRow,
  type LeaveReason,
} from "@/lib/db-alumni";
import { fmtVND } from "@/lib/db-tuition";
import { useLoad } from "@/lib/use-load";

/* ================= Bộ lọc ================= */

type StatusFilter = "all" | "left" | "reserved";
type ReasonFilter = "all" | LeaveReason | "none";
/** Nghỉ cách đây bao lâu — quyết định cách mời lại rất khác nhau. */
type PeriodFilter = "all" | "30" | "90" | "180" | "365" | "older";
type InviteFilter = "all" | "todo" | "done";
type SortKey = "recent" | "oldest" | "leftover" | "name";

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "all", label: "Nghỉ bất kỳ lúc nào" },
  { value: "30", label: "Nghỉ trong 30 ngày" },
  { value: "90", label: "Nghỉ trong 3 tháng" },
  { value: "180", label: "Nghỉ trong 6 tháng" },
  { value: "365", label: "Nghỉ trong 1 năm" },
  { value: "older", label: "Nghỉ hơn 1 năm" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Mới nghỉ trước" },
  { value: "oldest", label: "Nghỉ lâu nhất trước" },
  { value: "leftover", label: "Còn thừa nhiều buổi trước" },
  { value: "name", label: "Sắp xếp theo tên" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");
}

/* ================= Trang ================= */

export default function AdminAlumniPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(fetchAlumni);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [level, setLevel] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [invite, setInvite] = useState<InviteFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const [editing, setEditing] = useState<AlumniRow | null>(null);
  const [inviting, setInviting] = useState<AlumniRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);

  const levelOptions = useMemo(
    () => [...new Set(all.flatMap((r) => r.levels))].sort((a, b) => a.localeCompare(b, "vi")),
    [all],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = all.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (reason === "none" ? r.leftReason !== null : reason !== "all" && r.leftReason !== reason)
        return false;
      if (level !== "all" && !r.levels.includes(level)) return false;
      if (invite === "todo" && r.invited) return false;
      if (invite === "done" && !r.invited) return false;
      if (period !== "all") {
        const d = r.daysSinceLeft;
        if (d === null) return false;
        if (period === "older" ? d <= 365 : d > Number(period)) return false;
      }
      if (!needle) return true;
      return `${r.name} ${r.student_code ?? ""} ${r.parentName ?? ""} ${r.phone ?? ""} ${r.parentPhone ?? ""} ${r.classes.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });

    const byDate = (r: AlumniRow) => (r.leftAt ? new Date(r.leftAt).getTime() : 0);
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "vi");
      if (sort === "leftover") return b.remainingSessions - a.remainingSessions;
      if (sort === "oldest") return byDate(a) - byDate(b);
      return byDate(b) - byDate(a);
    });
  }, [all, q, status, reason, level, period, invite, sort]);

  const stats = useMemo(() => {
    const left = all.filter((r) => r.status === "left").length;
    const reserved = all.filter((r) => r.status === "reserved").length;
    const recent = all.filter((r) => r.daysSinceLeft !== null && r.daysSinceLeft <= 30).length;
    const leftoverSessions = all.reduce((s, r) => s + r.remainingSessions, 0);
    const leftoverValue = all.reduce((s, r) => s + r.leftoverValue, 0);
    const notInvited = all.filter((r) => !r.invited).length;
    const preventable = all.filter((r) => isPreventable(r.leftReason)).length;
    return { left, reserved, recent, leftoverSessions, leftoverValue, notInvited, preventable };
  }, [all]);

  /** Thống kê lý do tính trên danh sách ĐANG lọc — lọc để soi từng nhóm. */
  const reasons = useMemo(() => reasonStats(filtered), [filtered]);

  async function handleReactivate(row: AlumniRow) {
    if (
      !confirm(
        `Cho ${row.name} học lại? Hồ sơ về trạng thái “Đang học”, lý do nghỉ và ngày nghỉ sẽ được xóa. ` +
          `Nhớ xếp lớp lại cho em ở hồ sơ chi tiết.`,
      )
    )
      return;
    setBusyId(row.id);
    setActionError(null);
    try {
      await reactivateStudent(row.id);
      reload();
    } catch (err) {
      setActionError(dbErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Học viên đã nghỉ</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading
              ? "Đang tải..."
              : `${stats.left} em đã nghỉ · ${stats.reserved} em bảo lưu · ` +
                `${stats.notInvited} em chưa ai liên hệ mời quay lại.`}
          </p>
        </div>
        <Link href="/admin/students" className={buttonVariants({ variant: "outline" })}>
          <Users className="h-4 w-4" /> Danh sách đang học
        </Link>
      </div>

      {error && <ErrorNote message={error} />}
      {actionError && <ErrorNote message={actionError} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Đã nghỉ" value={stats.left} icon={UserMinus} tone="gold" />
        <StatTile
          label="Đang bảo lưu"
          value={stats.reserved}
          icon={CalendarClock}
          tone="brand"
          hint="Có hẹn quay lại"
        />
        <StatTile
          label="Nghỉ trong 30 ngày"
          value={stats.recent}
          icon={PhoneCall}
          tone="gold"
          hint={`${stats.preventable} em nghỉ vì lý do níu được`}
        />
        <StatTile
          label="Buổi còn thừa"
          value={stats.leftoverSessions}
          icon={Wallet}
          tone="jade"
          hint={`Trị giá ${fmtVND(stats.leftoverValue)}`}
        />
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tên học viên, mã, phụ huynh, số điện thoại..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Nghỉ và bảo lưu</option>
            <option value="left">Đã nghỉ</option>
            <option value="reserved">Bảo lưu</option>
          </Select>
          <Select value={reason} onChange={(e) => setReason(e.target.value as ReasonFilter)}>
            <option value="all">Tất cả lý do</option>
            {LEAVE_REASONS.map((r) => (
              <option key={r} value={r}>{LEAVE_REASON_LABELS[r]}</option>
            ))}
            <option value="none">Chưa ghi lý do</option>
          </Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">Mọi trình độ đã học</option>
            {levelOptions.map((l) => (
              <option key={l} value={l}>Đã học {l}</option>
            ))}
          </Select>
          <Select value={invite} onChange={(e) => setInvite(e.target.value as InviteFilter)}>
            <option value="all">Mời lại: tất cả</option>
            <option value="todo">Chưa ai mời lại</option>
            <option value="done">Đã mời lại</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <div className="flex items-center text-sm text-muted-foreground">
            Đang xem <b className="mx-1 text-foreground">{filtered.length}</b> / {all.length} em
          </div>
        </CardContent>
      </Card>

      {!loading && filtered.length > 0 && <ReasonBreakdown stats={reasons} total={filtered.length} />}

      {loading ? (
        <Card><LoadingRows rows={6} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={UserMinus}
          title={all.length === 0 ? "Chưa có học viên nào nghỉ 🎉" : "Không có em nào khớp bộ lọc"}
          description={
            all.length === 0
              ? "Khi chuyển trạng thái một em sang “Đã nghỉ” hoặc “Bảo lưu”, hồ sơ của em sẽ nằm ở đây để chăm sóc tiếp."
              : "Thử bỏ bớt bộ lọc hoặc đổi từ khóa."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Bảng đầy đủ cho màn hình rộng */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="px-3 py-3 font-semibold">Lý do</th>
                  <th className="px-3 py-3 font-semibold">Ngày nghỉ</th>
                  <th className="px-3 py-3 font-semibold">Buổi còn thừa</th>
                  <th className="px-3 py-3 font-semibold">Đã học</th>
                  <th className="px-3 py-3 font-semibold">Mời lại</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} src={r.avatar ?? undefined} size={34} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/members/${r.id}`}
                            className="block truncate font-semibold hover:underline"
                          >
                            {r.name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">
                            {r.parentName ? `PH: ${r.parentName}` : "Chưa nối phụ huynh"}
                            {(r.phone ?? r.parentPhone) && ` · ${r.phone ?? r.parentPhone}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><StatusChip row={r} /></td>
                    <td className="px-3 py-2.5"><ReasonChip reason={r.leftReason} note={r.leftNote} /></td>
                    <td className="px-3 py-2.5">
                      <div>{fmtDate(r.leftAt)}</div>
                      <div className="text-xs text-muted-foreground">{agoLabel(r.daysSinceLeft)}</div>
                    </td>
                    <td className="px-3 py-2.5"><LeftoverChip row={r} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div className="truncate">{r.levels.join(", ") || r.classes.join(", ") || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5"><InviteChip row={r} /></td>
                    <td className="px-4 py-2.5">
                      <RowActions
                        row={r}
                        busy={busyId === r.id}
                        onEdit={() => setEditing(r)}
                        onInvite={() => setInviting(r)}
                        onReactivate={() => handleReactivate(r)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Điện thoại / máy tính bảng: mỗi em một thẻ */}
          <div className="divide-y lg:hidden">
            {filtered.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={r.name} src={r.avatar ?? undefined} size={38} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/members/${r.id}`} className="block truncate font-semibold">
                      {r.name}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.parentName ? `PH: ${r.parentName} · ` : ""}
                      {r.phone ?? r.parentPhone ?? "chưa có số"}
                    </div>
                  </div>
                  <StatusChip row={r} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ReasonChip reason={r.leftReason} note={r.leftNote} />
                  <LeftoverChip row={r} />
                  <InviteChip row={r} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Nghỉ {fmtDate(r.leftAt)} ({agoLabel(r.daysSinceLeft)})
                  {r.levels.length > 0 && ` · đã học ${r.levels.join(", ")}`}
                  {r.returnAt && ` · hẹn quay lại ${fmtDate(r.returnAt)}`}
                </div>
                <div className="mt-3">
                  <RowActions
                    row={r}
                    busy={busyId === r.id}
                    onEdit={() => setEditing(r)}
                    onInvite={() => setInviting(r)}
                    onReactivate={() => handleReactivate(r)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <LeaveInfoModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {inviting && user && (
        <InviteModal
          row={inviting}
          userId={user.id}
          onClose={() => setInviting(null)}
          onSaved={() => {
            setInviting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ================= Các mảnh nhỏ trên một dòng ================= */

function StatusChip({ row }: { row: AlumniRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={row.status === "reserved" ? "gold" : "destructive"}>
        {STUDY_STATUS_LABELS[row.status]}
      </Badge>
      {row.returnAt && (
        <span className="text-xs text-muted-foreground" title="Hẹn quay lại">
          → {fmtDate(row.returnAt)}
        </span>
      )}
    </div>
  );
}

function ReasonChip({ reason, note }: { reason: LeaveReason | null; note: string | null }) {
  if (!reason) return <span className="text-xs text-muted-foreground">Chưa ghi lý do</span>;
  return (
    <Badge variant={isPreventable(reason) ? "gold" : "muted"} title={note ?? undefined}>
      {LEAVE_REASON_LABELS[reason]}
    </Badge>
  );
}

/** Buổi chưa học hết khi nghỉ — con số phải nói chuyện được với phụ huynh. */
function LeftoverChip({ row }: { row: AlumniRow }) {
  if (row.debt > 0) return <Badge variant="destructive">Nợ {fmtVND(row.debt)}</Badge>;
  if (row.remainingSessions <= 0) return <span className="text-xs text-muted-foreground">Hết buổi</span>;
  return (
    <Badge variant="jade" title={`Trị giá khoảng ${fmtVND(row.leftoverValue)}`}>
      {row.remainingSessions} buổi · {fmtVND(row.leftoverValue)}
    </Badge>
  );
}

function InviteChip({ row }: { row: AlumniRow }) {
  if (!row.invited) return <Badge variant="outline">Chưa mời</Badge>;
  return (
    <span className="text-xs text-muted-foreground">
      Đã mời {row.lastContactAt ? fmtDate(row.lastContactAt) : ""}
    </span>
  );
}

function RowActions({
  row,
  busy,
  onEdit,
  onInvite,
  onReactivate,
}: {
  row: AlumniRow;
  busy: boolean;
  onEdit: () => void;
  onInvite: () => void;
  onReactivate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={onInvite}>
        <PhoneCall className="h-3.5 w-3.5" /> Mời lại
      </Button>
      <Button size="sm" variant="ghost" onClick={onEdit}>
        Sửa lý do
      </Button>
      <Button size="sm" onClick={onReactivate} disabled={busy}>
        <Undo2 className="h-3.5 w-3.5" /> {busy ? "Đang lưu..." : "Học lại"}
      </Button>
    </div>
  );
}

/* ================= Thống kê theo lý do ================= */

function ReasonBreakdown({
  stats,
  total,
}: {
  stats: ReturnType<typeof reasonStats>;
  total: number;
}) {
  const [open, setOpen] = useState(true);
  const max = Math.max(...stats.map((s) => s.count), 1);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-base font-bold">Vì sao học viên nghỉ</h2>
            <p className="text-xs text-muted-foreground">
              Tính trên {total} em đang lọc — vạch vàng là lý do trung tâm níu lại được.
            </p>
          </div>
          <span className="text-xs font-medium text-primary">{open ? "Thu gọn" : "Xem"}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-2">
            {stats.map((s) => (
              <div key={s.reason ?? "none"} className="flex items-center gap-3">
                <div className="w-52 shrink-0 truncate text-sm">{s.label}</div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isPreventable(s.reason) ? "bg-gold-400" : "bg-brand-400",
                    )}
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                  {s.count} em · {s.percent}%
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================= Sửa thông tin nghỉ ================= */

function LeaveInfoModal({
  row,
  onClose,
  onSaved,
}: {
  row: AlumniRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<"left" | "reserved">(row.status);
  const [leftAt, setLeftAt] = useState(row.leftAt ?? todayISO());
  const [reason, setReason] = useState<LeaveReason | "">(row.leftReason ?? "");
  const [returnAt, setReturnAt] = useState(row.returnAt ?? "");
  const [note, setNote] = useState(row.leftNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveLeaveInfo(row.id, {
        status,
        leftAt: leftAt || null,
        reason: reason || null,
        note,
        returnAt: returnAt || null,
      });
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Thông tin nghỉ — ${row.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as "left" | "reserved")}
            >
              <option value="left">Đã nghỉ</option>
              <option value="reserved">Bảo lưu</option>
            </Select>
          </Field>
          <Field label="Ngày nghỉ">
            <Input type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Lý do nghỉ" hint="Chọn đúng lý do để thống kê nói được điều gì cần sửa.">
          <Select value={reason} onChange={(e) => setReason(e.target.value as LeaveReason | "")}>
            <option value="">Chưa ghi lý do</option>
            {LEAVE_REASONS.map((r) => (
              <option key={r} value={r}>{LEAVE_REASON_LABELS[r]}</option>
            ))}
          </Select>
        </Field>
        <Field
          label={status === "reserved" ? "Bảo lưu đến ngày" : "Hẹn quay lại"}
          hint="Để trống nếu chưa hẹn được ngày."
        >
          <Input type="date" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Phụ huynh nói gì, hẹn gì, cần lưu ý gì khi gọi lại..."
          />
        </Field>
        {row.remainingSessions > 0 && (
          <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-800">
            Em còn <b>{row.remainingSessions} buổi</b> chưa học trong gói (khoảng{" "}
            {fmtVND(row.leftoverValue)}) — nhớ thống nhất với phụ huynh giữ buổi hay hoàn phí.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Mời quay lại ================= */

function InviteModal({
  row,
  userId,
  onClose,
  onSaved,
}: {
  row: AlumniRow;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [channel, setChannel] = useState<ContactChannel>("call");
  const [result, setResult] = useState<"interested" | "later" | "no_answer" | "declined">(
    "interested",
  );
  const [returnAt, setReturnAt] = useState(row.returnAt ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Nhật ký dùng chung với trang "Vắng liên tiếp" (student_contacts) nên
      // kết quả phải quy về 3 giá trị của bảng; chi tiết mời lại ghi vào ghi chú.
      const RESULT_LABEL = {
        interested: "quan tâm, muốn học lại",
        later: "hẹn dịp khác",
        no_answer: "không nghe máy",
        declined: "không có nhu cầu",
      }[result];
      await addStudentContact({
        student_id: row.id,
        channel,
        outcome: result === "no_answer" ? "no_answer" : "reached",
        note: `Mời học lại — ${RESULT_LABEL}${note.trim() ? `. ${note.trim()}` : ""}`,
        contacted_by: userId,
      });
      // Hẹn được ngày thì ghi luôn lên hồ sơ để lần sau lọc ra nhắc lại.
      if (returnAt !== (row.returnAt ?? "")) {
        await saveLeaveInfo(row.id, {
          status: row.status,
          leftAt: row.leftAt,
          reason: row.leftReason,
          note: row.leftNote,
          returnAt: returnAt || null,
        });
      }
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  const phone = row.parentPhone ?? row.phone;

  return (
    <Modal open onClose={onClose} title={`Mời học lại — ${row.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <div>
            Nghỉ {fmtDate(row.leftAt)} ({agoLabel(row.daysSinceLeft)})
            {row.leftReason && ` · ${LEAVE_REASON_LABELS[row.leftReason]}`}
          </div>
          <div className="text-muted-foreground">
            {row.levels.length > 0 ? `Đã học ${row.levels.join(", ")}` : "Chưa ghi trình độ"}
            {row.remainingSessions > 0 && ` · còn ${row.remainingSessions} buổi trong gói`}
            {phone && ` · ${phone}`}
          </div>
          {row.leftNote && <div className="mt-1 text-muted-foreground">Ghi chú: {row.leftNote}</div>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Liên hệ qua">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)}>
              {(Object.keys(CONTACT_CHANNEL_LABELS) as ContactChannel[]).map((k) => (
                <option key={k} value={k}>{CONTACT_CHANNEL_LABELS[k]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kết quả">
            <Select value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
              <option value="interested">Quan tâm, muốn học lại</option>
              <option value="later">Hẹn dịp khác</option>
              <option value="no_answer">Không nghe máy</option>
              <option value="declined">Không có nhu cầu</option>
            </Select>
          </Field>
        </div>
        <Field label="Hẹn quay lại ngày" hint="Điền khi phụ huynh hẹn được mốc cụ thể.">
          <Input type="date" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Phụ huynh hỏi khóa nào, giờ nào học được, cần ưu đãi gì..."
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            <UserPlus className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu nhật ký"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
