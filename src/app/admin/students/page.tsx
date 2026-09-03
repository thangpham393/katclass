"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Eye,
  KeyRound,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  deleteMember,
  fetchClasses,
  fetchCourses,
  fetchProfilesByRole,
  fetchRooms,
  provisionAccount,
  dbErrorMessage,
  todayISO,
  formatSchedules,
  STUDY_STATUS_LABELS,
  WEEKDAY_LABELS,
  type AttendanceStatus,
  type ProfileRow,
  type StudyStatus,
} from "@/lib/db";
import { fetchBranchList } from "@/lib/branch";
import {
  createStudentFull,
  fetchOwnerCandidates,
  fetchStudentList,
  updateStudentProfile,
  DILIGENCE_META,
  RECENT_DOTS,
  type NewStudentInput,
  type StudentListRow,
  type StudentScheduleInput,
} from "@/lib/db-student-list";
import { LEAVE_REASONS, LEAVE_REASON_LABELS } from "@/lib/db-alumni";
import { fmtVND } from "@/lib/db-tuition";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";
import { useLoad } from "@/lib/use-load";

/* ================= Bộ lọc ================= */

type StatusFilter = "all" | StudyStatus | "unassigned" | "no-account";
type SessionFilter = "all" | "low" | "empty" | "none";
type PayFilter = "all" | "debt" | "clear";
type CareFilter = "all" | "good" | "warn";
type SortKey = "name" | "newest" | "remaining" | "debt" | "absences";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "studying", label: "Đang học" },
  { value: "reserved", label: "Bảo lưu" },
  { value: "left", label: "Đã nghỉ" },
  { value: "unassigned", label: "Chưa xếp lớp" },
  { value: "no-account", label: "Chưa có tài khoản" },
];

const SESSION_OPTIONS: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "Tất cả số buổi" },
  { value: "low", label: "Sắp hết (≤ 5 buổi)" },
  { value: "empty", label: "Đã hết buổi" },
  { value: "none", label: "Chưa mua gói" },
];

const PAY_OPTIONS: { value: PayFilter; label: string }[] = [
  { value: "all", label: "Tất cả thanh toán" },
  { value: "debt", label: "Còn nợ học phí" },
  { value: "clear", label: "Đã đóng đủ" },
];

const CARE_OPTIONS: { value: CareFilter; label: string }[] = [
  { value: "all", label: "Tất cả chuyên cần" },
  { value: "good", label: "Đi học đều" },
  { value: "warn", label: "Vắng nhiều" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Sắp xếp theo tên" },
  { value: "newest", label: "Mới nhập học trước" },
  { value: "remaining", label: "Sắp hết buổi trước" },
  { value: "debt", label: "Nợ nhiều nhất trước" },
  { value: "absences", label: "Vắng nhiều nhất trước" },
];

/* ================= Ô điểm danh gần đây ================= */

const DOT_CLASS: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  makeup: "bg-sky-500",
  absent_excused: "bg-gold-400",
  absent_unexcused: "bg-rose-500",
};

const DOT_LABEL: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  makeup: "Học bù",
  absent_excused: "Vắng có phép",
  absent_unexcused: "Vắng không phép",
};

function RecentDots({ row }: { row: StudentListRow }) {
  const care = DILIGENCE_META[row.diligence];
  return (
    <div className="mt-1 flex items-center gap-1">
      {row.recent.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">Chưa có buổi nào</span>
      ) : (
        row.recent.map((s, i) => (
          <span
            key={i}
            title={DOT_LABEL[s]}
            className={cn("h-2.5 w-2.5 rounded-full", DOT_CLASS[s])}
          />
        ))
      )}
      {row.diligence !== "none" && (
        <span className="ml-1 text-xs" title={care.label}>
          {care.emoji}
        </span>
      )}
    </div>
  );
}

/** Chip "45/58 (13 còn lại)" — đổi màu theo số buổi còn lại. */
function SessionChip({ row }: { row: StudentListRow }) {
  if (!row.hasPackage) return <Badge variant="muted">Chưa có gói</Badge>;
  const variant =
    row.remainingSessions <= 0 ? "destructive" : row.remainingSessions <= 5 ? "gold" : "jade";
  return (
    <Badge variant={variant}>
      {row.usedSessions}/{row.totalSessions} ({row.remainingSessions} còn lại)
    </Badge>
  );
}

function StatusChip({ row }: { row: StudentListRow }) {
  const variant = row.status === "studying" ? "jade" : row.status === "reserved" ? "gold" : "muted";
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={variant}>{STUDY_STATUS_LABELS[row.status]}</Badge>
      {row.status === "studying" && row.unassigned && <Badge variant="muted">Chưa xếp lớp</Badge>}
    </div>
  );
}

/** Người phụ trách hiện trên dòng: nhân viên được gán, không có thì GV của lớp. */
function ownersOf(s: StudentListRow): string[] {
  return s.ownerName ? [s.ownerName] : s.teachers;
}

/* ================= Trang ================= */

export default function AdminStudentsPage() {
  const { data: students, loading, error, reload } = useLoad(fetchStudentList);
  const [q, setQ] = useState("");
  const [phoneQ, setPhoneQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sessions, setSessions] = useState<SessionFilter>("all");
  const [pay, setPay] = useState<PayFilter>("all");
  const [care, setCare] = useState<CareFilter>("all");
  const [teacher, setTeacher] = useState("all");
  const [course, setCourse] = useState("all");
  const [sort, setSort] = useState<SortKey>("name");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StudentListRow | null>(null);
  const [created, setCreated] = useState<{ profile: ProfileRow; warnings: string[] } | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = useMemo(() => students ?? [], [students]);

  const teacherOptions = useMemo(
    () =>
      [...new Set(all.flatMap((s) => ownersOf(s)))].sort((a, b) => a.localeCompare(b, "vi")),
    [all],
  );

  const courseOptions = useMemo(
    () => [...new Set(all.flatMap((s) => s.courses))].sort((a, b) => a.localeCompare(b, "vi")),
    [all],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const phoneNeedle = phoneQ.replace(/\D/g, "");
    const list = all.filter((s) => {
      if (needle) {
        const hay = `${s.name} ${s.email} ${s.student_code ?? ""} ${s.parentName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (phoneNeedle) {
        const phones = `${s.phone ?? ""}${s.parentPhone ?? ""}`.replace(/\D/g, "");
        if (!phones.includes(phoneNeedle)) return false;
      }
      if (status === "no-account" && s.user_id) return false;
      if (status === "unassigned" && !s.unassigned) return false;
      if (status !== "all" && status !== "no-account" && status !== "unassigned" && s.status !== status)
        return false;
      if (sessions === "none" && s.hasPackage) return false;
      if (sessions === "low" && (!s.hasPackage || s.remainingSessions > 5 || s.remainingSessions <= 0))
        return false;
      if (sessions === "empty" && (!s.hasPackage || s.remainingSessions > 0)) return false;
      if (pay === "debt" && s.debt <= 0) return false;
      if (pay === "clear" && s.debt > 0) return false;
      if (care === "good" && !(s.diligence === "great" || s.diligence === "good")) return false;
      if (care === "warn" && s.diligence !== "warn") return false;
      if (teacher !== "all" && !ownersOf(s).includes(teacher)) return false;
      if (course !== "all" && !s.courses.includes(course)) return false;
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "remaining":
          return (
            (a.hasPackage ? a.remainingSessions : Infinity) -
            (b.hasPackage ? b.remainingSessions : Infinity)
          );
        case "debt":
          return b.debt - a.debt;
        case "absences":
          return b.absences - a.absences;
        default:
          return a.name.localeCompare(b.name, "vi");
      }
    });
    return sorted;
  }, [all, q, phoneQ, status, sessions, pay, care, teacher, course, sort]);

  const noAccount = all.filter((s) => !s.user_id);

  /** Cấp tài khoản hàng loạt cho học viên đã import từ trước (chạy 1 lần). */
  async function handleBulkProvision() {
    if (!confirm(
      `Cấp tài khoản đăng nhập cho ${noAccount.length} học viên chưa có?\n` +
      `Tất cả dùng mật khẩu mặc định ${DEFAULT_LOGIN_PASSWORD} (đổi sau khi đăng nhập).`,
    )) return;
    setActionError(null);
    setBulk({ done: 0, total: noAccount.length, errors: 0 });
    let errors = 0;
    for (let i = 0; i < noAccount.length; i++) {
      try {
        await provisionAccount(noAccount[i].id);
      } catch {
        errors++;
      }
      setBulk({ done: i + 1, total: noAccount.length, errors });
    }
    reload();
  }

  async function handleDelete(row: StudentListRow) {
    if (!confirm(`Xóa học viên ${row.name}? Hồ sơ, điểm danh và gói buổi của em sẽ mất luôn.`)) return;
    setActionError(null);
    setBusyId(row.id);
    try {
      await deleteMember(row.id);
      reload();
    } catch (err) {
      setActionError(dbErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Học viên{!loading && ` (${all.length})`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Đang tải..."
              : `${all.filter((s) => s.status === "studying").length} đang học · ` +
                `${all.filter((s) => s.hasPackage && s.remainingSessions <= 5).length} sắp hết buổi · ` +
                `${all.filter((s) => s.debt > 0).length} còn nợ học phí.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Học viên mới
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {actionError && <ErrorNote message={actionError} />}

      {/* Học viên import từ trước chưa có tài khoản → cấp gộp một lần */}
      {!loading && noAccount.length > 0 && !bulk && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="text-sm text-brand-800">
            <b>{noAccount.length} học viên</b> (import từ trước) chưa có tài khoản đăng nhập.
            Cấp một lần — sau đó chỉ cần gửi mã + mật khẩu mặc định <b>{DEFAULT_LOGIN_PASSWORD}</b> cho từng em.
          </div>
          <Button size="sm" onClick={handleBulkProvision}>
            <KeyRound className="h-3.5 w-3.5" /> Cấp tài khoản cho tất cả
          </Button>
        </div>
      )}
      {bulk && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {bulk.done < bulk.total
            ? `Đang cấp tài khoản... ${bulk.done}/${bulk.total}`
            : `Đã cấp xong ${bulk.total - bulk.errors}/${bulk.total} tài khoản.`}
          {bulk.errors > 0 && ` (${bulk.errors} lỗi — thử lại sau)`}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tên học viên, mã, phụ huynh..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Điện thoại"
              className="pl-9"
              value={phoneQ}
              onChange={(e) => setPhoneQ(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={sessions} onChange={(e) => setSessions(e.target.value as SessionFilter)}>
            {SESSION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={pay} onChange={(e) => setPay(e.target.value as PayFilter)}>
            {PAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={care} onChange={(e) => setCare(e.target.value as CareFilter)}>
            {CARE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="all">Tất cả người phụ trách</option>
            {teacherOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="all">Tất cả khóa học</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={6} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={Users}
          title={all.length === 0 ? "Chưa có học viên" : "Không có học viên phù hợp"}
          description={
            all.length === 0
              ? "Bấm “Học viên mới” — hệ thống tự cấp mã + tài khoản đăng nhập."
              : "Thử bỏ bớt bộ lọc hoặc đổi từ khóa."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Bảng đầy đủ cho màn hình rộng */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-3 py-3 font-semibold">Phụ huynh</th>
                  <th className="px-3 py-3 font-semibold">Điện thoại</th>
                  <th className="px-3 py-3 font-semibold">Số buổi</th>
                  <th className="px-3 py-3 font-semibold">Vắng</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="px-3 py-3 font-semibold">Người phụ trách</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} src={s.avatar ?? undefined} size={34} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/members/${s.id}`}
                            className={cn(
                              "block truncate font-semibold hover:underline",
                              s.debt > 0 && "rounded bg-gold-100 px-1.5 text-gold-800",
                            )}
                            title={s.debt > 0 ? `Còn nợ ${fmtVND(s.debt)}` : undefined}
                          >
                            {s.name}
                          </Link>
                          <RecentDots row={s} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.parentName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {s.phone ?? s.parentPhone ?? "—"}
                    </td>
                    <td className="px-3 py-2.5"><SessionChip row={s} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {s.absences}
                      {s.makeups > 0 && ` (Bù ${s.makeups})`}
                    </td>
                    <td className="px-3 py-2.5"><StatusChip row={s} /></td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {ownersOf(s).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions
                        row={s}
                        busy={busyId === s.id}
                        onEdit={() => setEditing(s)}
                        onDelete={() => handleDelete(s)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: mỗi học viên một thẻ */}
          <div className="divide-y md:hidden">
            {filtered.map((s) => (
              <div key={s.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={s.name} src={s.avatar ?? undefined} size={38} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/members/${s.id}`} className="block truncate font-semibold">
                      {s.name}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.parentName ? `PH: ${s.parentName} · ` : ""}
                      {s.phone ?? s.parentPhone ?? "chưa có số"}
                    </div>
                    <RecentDots row={s} />
                  </div>
                  <StatusChip row={s} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SessionChip row={s} />
                  <span className="text-xs text-muted-foreground">
                    Vắng {s.absences}
                    {s.makeups > 0 && ` · bù ${s.makeups}`}
                  </span>
                  {s.debt > 0 && <Badge variant="destructive">Nợ {fmtVND(s.debt)}</Badge>}
                </div>
                <div className="mt-3">
                  <RowActions
                    row={s}
                    busy={busyId === s.id}
                    onEdit={() => setEditing(s)}
                    onDelete={() => handleDelete(s)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Chấm màu là {RECENT_DOTS} buổi gần nhất:
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" /> có mặt ·
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-gold-400 align-middle" /> vắng có phép ·
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-rose-500 align-middle" /> vắng không phép ·
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-sky-500 align-middle" /> học bù.
          Tên nền vàng = còn nợ học phí.
        </p>
      )}

      {creating && (
        <CreateStudentModal
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            setCreated(result);
            reload();
          }}
        />
      )}

      {editing && (
        <EditStudentModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {created && (
        <AccountInfoModal
          profile={created.profile}
          warnings={created.warnings}
          onClose={() => setCreated(null)}
        />
      )}
    </div>
  );
}

/* ================= Nút thao tác trên một dòng ================= */

function RowActions({
  row,
  busy,
  onEdit,
  onDelete,
}: {
  row: StudentListRow;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconCls =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`/admin/members/${row.id}`} className={iconCls} title="Xem hồ sơ">
        <Eye className="h-4 w-4" />
      </Link>
      <button type="button" onClick={onEdit} className={iconCls} title="Sửa thông tin">
        <Pencil className="h-4 w-4" />
      </button>
      <Link href="/admin/tuition" className={iconCls} title="Gói buổi & học phí">
        <Package className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className={cn(iconCls, "hover:bg-destructive/10 hover:text-destructive disabled:opacity-40")}
        title="Xóa học viên"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ================= Thêm học viên (form đầy đủ) ================= */

/** Một dòng "Lịch học" trong form — ca học riêng ngoài lớp. */
type ScheduleDraft = StudentScheduleInput;

const EMPTY_SCHEDULE: ScheduleDraft = {
  weekday: -1,
  start_time: "",
  end_time: null,
  teacher_id: null,
  room_id: null,
};

/** Danh mục cần cho form: chi nhánh, người phụ trách, lớp, khóa, GV, phòng. */
async function fetchNewStudentOptions() {
  const [branches, owners, classes, courses, teachers, rooms] = await Promise.all([
    fetchBranchList(),
    fetchOwnerCandidates(),
    fetchClasses(),
    fetchCourses(),
    fetchProfilesByRole("teacher"),
    fetchRooms(),
  ]);
  return { branches, owners, classes, courses, teachers, rooms };
}

function CreateStudentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: { profile: ProfileRow; warnings: string[] }) => void;
}) {
  const { data: opts, loading: loadingOpts } = useLoad(fetchNewStudentOptions);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [enrolledAt, setEnrolledAt] = useState(todayISO());
  const [studyStatus, setStudyStatus] = useState<StudyStatus>("studying");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [branchId, setBranchId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeClasses = (opts?.classes ?? []).filter(
    (c) => c.status === "active" || c.status === "planned",
  );
  const chosenCourses = (opts?.courses ?? []).filter((c) => courseIds.includes(c.id));
  const totalCourseSessions = chosenCourses.reduce((n, c) => n + (c.total_sessions ?? 0), 0);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function patchSchedule(i: number, patch: Partial<ScheduleDraft>) {
    setSchedules((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: NewStudentInput = {
      name,
      dob: dob || null,
      phone,
      email: "",
      address,
      note,
      enrolledAt: enrolledAt || null,
      studyStatus,
      branchId: branchId || null,
      ownerId: ownerId || null,
      parentName,
      parentPhone,
      parentEmail,
      classIds,
      courseIds,
      schedules: schedules.filter((s) => s.weekday >= 0 && s.start_time),
    };
    try {
      onCreated(await createStudentFull(input));
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Học viên mới" className="sm:max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Minh An" required autoFocus />
          </Field>
          <Field label="Ngày sinh">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Tên phụ huynh">
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Nguyễn Văn B" />
          </Field>
          <Field label="SĐT phụ huynh" hint="Trùng số với hồ sơ phụ huynh đã có thì nối vào hồ sơ đó, không tạo trùng.">
            <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="09xx xxx xxx" />
          </Field>
          <Field label="Email phụ huynh">
            <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
          </Field>
          <Field label="SĐT học viên">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
          </Field>
        </div>

        <Field label="Địa chỉ">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày nhập học">
            <Input type="date" value={enrolledAt} onChange={(e) => setEnrolledAt(e.target.value)} />
          </Field>
          <Field label="Trạng thái">
            <Select value={studyStatus} onChange={(e) => setStudyStatus(e.target.value as StudyStatus)}>
              {(Object.keys(STUDY_STATUS_LABELS) as StudyStatus[]).map((k) => (
                <option key={k} value={k}>{STUDY_STATUS_LABELS[k]}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* --- Lớp: nguồn lịch chính --- */}
        <div>
          <span className="text-sm font-medium">Lớp học</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Xếp vào lớp là có luôn lịch, giáo viên và phòng của lớp đó.
          </p>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-input p-2">
            {loadingOpts ? (
              <p className="p-2 text-sm text-muted-foreground">Đang tải lớp...</p>
            ) : activeClasses.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Chưa có lớp nào đang mở.</p>
            ) : (
              activeClasses.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-secondary">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={classIds.includes(c.id)}
                    onChange={() => setClassIds((v) => toggle(v, c.id))}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatSchedules(c.class_schedules) || "chưa có lịch"}
                      {c.teacher?.name ? ` · ${c.teacher.name}` : ""}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* --- Ca học riêng ngoài lớp --- */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-medium">Lịch học riêng</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Chỉ dùng cho ca kèm / ca lẻ không thuộc lớp nào ở trên.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSchedules((r) => [...r, { ...EMPTY_SCHEDULE }])}>
              <Plus className="h-3.5 w-3.5" /> Thêm ca
            </Button>
          </div>
          {schedules.length > 0 && (
            <div className="mt-2 space-y-2">
              {schedules.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select
                    wrapClassName="w-32"
                    value={row.weekday}
                    onChange={(e) => patchSchedule(i, { weekday: Number(e.target.value) })}
                  >
                    <option value={-1}>Chọn ngày</option>
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>{label}</option>
                    ))}
                  </Select>
                  <Input
                    type="time"
                    className="w-28"
                    value={row.start_time}
                    onChange={(e) => patchSchedule(i, { start_time: e.target.value })}
                  />
                  <Input
                    type="time"
                    className="w-28"
                    value={row.end_time ?? ""}
                    onChange={(e) => patchSchedule(i, { end_time: e.target.value || null })}
                  />
                  <Select
                    wrapClassName="w-40"
                    value={row.teacher_id ?? ""}
                    onChange={(e) => patchSchedule(i, { teacher_id: e.target.value || null })}
                  >
                    <option value="">Không gán GV</option>
                    {(opts?.teachers ?? []).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                  <Select
                    wrapClassName="w-40"
                    value={row.room_id ?? ""}
                    onChange={(e) => patchSchedule(i, { room_id: e.target.value || null })}
                  >
                    <option value="">Không gán phòng</option>
                    {(opts?.rooms ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setSchedules((rows) => rows.filter((_, idx) => idx !== i))}
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Xóa ca này"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trung tâm">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Chi nhánh đang xem</option>
              {(opts?.branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Người phụ trách" hint="Không bắt buộc — để trống thì hiện giáo viên của lớp.">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Không chọn</option>
              {(opts?.owners ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* --- Ghi danh khóa học --- */}
        <div>
          <span className="text-sm font-medium">
            Khóa học ({courseIds.length} đã chọn · tổng {totalCourseSessions} buổi)
          </span>
          <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-input p-2">
            {(opts?.courses ?? []).length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Chưa có khóa học</p>
            ) : (
              (opts?.courses ?? []).map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={courseIds.includes(c.id)}
                    onChange={() => setCourseIds((v) => toggle(v, c.id))}
                  />
                  <span className="text-sm">
                    {c.name}
                    <span className="ml-1 text-xs text-muted-foreground">({c.total_sessions} buổi)</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ghi danh khóa là ghi nhận chuyên môn — bán gói buổi và thu tiền vẫn làm ở trang Học phí.
          </p>
        </div>

        <Field label="Ghi chú / đặc điểm">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dị ứng, tính cách, mục tiêu học..." />
        </Field>

        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Tạo xong hệ thống tự cấp <b>mã học viên HVKAT...</b> và tài khoản đăng nhập với mật khẩu mặc định{" "}
          <b>{DEFAULT_LOGIN_PASSWORD}</b> — chỉ cần gửi 2 thông tin đó cho học viên.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo học viên"}</Button>
        </div>
      </form>
    </Modal>
  );
}
/* ================= Sửa nhanh hồ sơ ================= */

function EditStudentModal({
  row,
  onClose,
  onSaved,
}: {
  row: StudentListRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: owners } = useLoad(fetchOwnerCandidates);
  const [name, setName] = useState(row.name);
  const [phone, setPhone] = useState(row.phone ?? "");
  const [email, setEmail] = useState(row.email);
  const [dob, setDob] = useState(row.dob ?? "");
  const [enrolledAt, setEnrolledAt] = useState(row.enrolledAt ?? "");
  const [studyStatus, setStudyStatus] = useState<StudyStatus>(row.status);
  const [ownerId, setOwnerId] = useState(row.ownerId ?? "");
  const [leftAt, setLeftAt] = useState(row.leftAt ?? todayISO());
  const [leftReason, setLeftReason] = useState(row.leftReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateStudentProfile(row.id, {
        name,
        phone: phone || null,
        email,
        dob: dob || null,
        enrolled_at: enrolledAt || null,
        study_status: studyStatus,
        owner_id: ownerId || null,
        // Về 'studying' thì trigger 0039 tự xóa lý do/ngày nghỉ, không gửi kèm.
        ...(studyStatus === "studying"
          ? {}
          : { left_at: leftAt || null, left_reason: leftReason || null }),
      });
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Sửa hồ sơ — ${row.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Họ tên" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số điện thoại">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
          </Field>
          <Field label="Ngày sinh">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Ngày nhập học">
            <Input type="date" value={enrolledAt} onChange={(e) => setEnrolledAt(e.target.value)} />
          </Field>
          <Field label="Trạng thái">
            <Select value={studyStatus} onChange={(e) => setStudyStatus(e.target.value as StudyStatus)}>
              {(Object.keys(STUDY_STATUS_LABELS) as StudyStatus[]).map((k) => (
                <option key={k} value={k}>{STUDY_STATUS_LABELS[k]}</option>
              ))}
            </Select>
          </Field>
        </div>
        {studyStatus !== "studying" && (
          <div className="grid gap-4 rounded-xl border border-gold-200 bg-gold-50/60 p-3 sm:grid-cols-2">
            <Field label="Ngày nghỉ / bắt đầu bảo lưu">
              <Input type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} />
            </Field>
            <Field label="Lý do">
              <Select value={leftReason} onChange={(e) => setLeftReason(e.target.value)}>
                <option value="">Chưa ghi lý do</option>
                {LEAVE_REASONS.map((r) => (
                  <option key={r} value={r}>{LEAVE_REASON_LABELS[r]}</option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-gold-800 sm:col-span-2">
              Hẹn quay lại, ghi chú và nhật ký mời học lại nằm ở trang{" "}
              <Link href="/admin/alumni" className="font-medium underline">
                Học viên đã nghỉ
              </Link>.
            </p>
          </div>
        )}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Người phụ trách">
          <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Không chọn</option>
            {(owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">
          Lớp học, gói buổi, phụ huynh và tài khoản đăng nhập sửa trong{" "}
          <Link href={`/admin/members/${row.id}`} className="font-medium text-primary hover:underline">
            hồ sơ chi tiết
          </Link>.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Hiện mã + mật khẩu sau khi tạo ================= */

function AccountInfoModal({
  profile: p,
  warnings,
  onClose,
}: {
  profile: ProfileRow;
  warnings: string[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const summary = `Mã học viên: ${p.student_code}\nMật khẩu: ${DEFAULT_LOGIN_PASSWORD}\nĐăng nhập tại: ${typeof window !== "undefined" ? window.location.origin : ""}/login`;

  function handleCopy() {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Modal open onClose={onClose} title={`Đã tạo học viên — ${p.name}`}>
      <div className="space-y-4">
        {warnings.length > 0 && (
          <ErrorNote
            message={`Hồ sơ đã tạo nhưng ${warnings.join(", ")}. Mở hồ sơ chi tiết của em để bổ sung.`}
          />
        )}
        {p.student_code && (
          <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gửi thông tin đăng nhập này cho học viên
            </div>
            <div className="mt-3 font-mono text-2xl font-extrabold tracking-[0.15em] text-brand-700">
              {p.student_code}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Mật khẩu mặc định: <b className="font-mono text-foreground">{DEFAULT_LOGIN_PASSWORD}</b>
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Đã copy" : "Copy mã + mật khẩu"}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Học viên đăng nhập lần đầu sẽ được nhắc đổi mật khẩu ngay để bảo mật.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Xong</Button>
        </div>
      </div>
    </Modal>
  );
}
