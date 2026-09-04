"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Search,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import {
  classTeachers,
  createStandaloneMakeupSession,
  dbErrorMessage,
  fetchClasses,
  fetchProfilesByRole,
  fetchRooms,
  saveAttendance,
  todayISO,
  updateSessionStatus,
  ATTENDANCE_LABELS,
  WEEKDAY_LABELS,
  type AttendanceStatus,
} from "@/lib/db";
import {
  fetchAttendanceDay,
  daySummary,
  type DaySessionRow,
  type DayStudentRow,
} from "@/lib/db-attendance-day";
import { useLoad } from "@/lib/use-load";

const STATUS_ORDER: AttendanceStatus[] = ["present", "absent_excused", "absent_unexcused", "makeup"];

/** Nút trạng thái: chưa chọn thì viền nhạt, chọn rồi thì tô đặc màu của trạng thái. */
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white",
  absent_excused: "border-gold-600 bg-gold-600 text-white",
  absent_unexcused: "border-destructive bg-destructive text-white",
  makeup: "border-sky-600 bg-sky-600 text-white",
};

/** Nhãn ngắn cho nút bấm — nhãn đầy đủ để ở title. */
const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent_excused: "Có phép",
  absent_unexcused: "Không phép",
  makeup: "Học bù",
};

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

function fmtDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]}, ${d.toLocaleDateString("vi-VN")}`;
}

/* ================= Ô thống kê màu ================= */

/**
 * Bốn ô đếm màu ở đầu trang. Viết đủ tên lớp Tailwind cho từng tông —
 * ghép chuỗi kiểu `bg-${tone}-50` thì Tailwind không quét ra, ô sẽ mất màu.
 */
const TILE_TONE = {
  violet: { bar: "from-violet-500 to-purple-500", bg: "bg-violet-50/70", text: "text-violet-700" },
  sky: { bar: "from-sky-500 to-blue-600", bg: "bg-sky-50/70", text: "text-blue-700" },
  amber: { bar: "from-amber-400 to-orange-500", bg: "bg-amber-50/70", text: "text-amber-700" },
  rose: { bar: "from-rose-500 to-red-600", bg: "bg-rose-50/70", text: "text-rose-700" },
} as const;

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TILE_TONE;
}) {
  const t = TILE_TONE[tone];
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/70 shadow-sm", t.bg)}>
      <div className={cn("h-1.5 bg-gradient-to-r", t.bar)} />
      <div className="p-4">
        <div className={cn("text-[11px] font-bold uppercase tracking-[0.04em]", t.text)}>{label}</div>
        <div className={cn("mt-1 text-3xl font-extrabold tracking-tight", t.text)}>{value}</div>
      </div>
    </div>
  );
}

/* ================= Trang ================= */

export default function AdminAttendancePage() {
  const { user, can } = useAuth();
  // Tạo buổi lẻ / chốt buổi là ghi vào bảng sessions → RLS đòi 'Lớp & lịch học'
  const canManageSessions = can("classes.manage");
  const [date, setDate] = useState(todayISO());
  const day = useLoad(() => fetchAttendanceDay(date), [date]);

  const [classId, setClassId] = useState("all");
  const [roomId, setRoomId] = useState("all");
  const [teacherId, setTeacherId] = useState("all");
  const [slot, setSlot] = useState("all");
  const [q, setQ] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => day.data ?? [], [day.data]);

  /* --- Danh mục cho các ô lọc, lấy từ chính các ca trong ngày --- */
  const classOptions = useMemo(
    () =>
      [...new Map(rows.filter((r) => r.session.class).map((r) => [r.session.class!.id, r.session.class!.name])).entries()],
    [rows],
  );
  const roomOptions = useMemo(
    () => [...new Map(rows.filter((r) => r.session.room).map((r) => [r.session.room!.id, r.session.room!.name])).entries()],
    [rows],
  );
  const teacherOptions = useMemo(
    () => [...new Map(rows.filter((r) => r.session.teacher).map((r) => [r.session.teacher!.id, r.session.teacher!.name])).entries()],
    [rows],
  );
  const slotOptions = useMemo(
    () => [...new Set(rows.map((r) => `${fmtTime(r.session.start_time)}–${fmtTime(r.session.end_time)}`))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        const s = r.session;
        if (classId !== "all" && s.class?.id !== classId) return false;
        if (roomId !== "all" && s.room?.id !== roomId) return false;
        if (teacherId !== "all" && s.teacher?.id !== teacherId) return false;
        if (slot !== "all" && `${fmtTime(s.start_time)}–${fmtTime(s.end_time)}` !== slot) return false;
        return true;
      })
      .map((r) =>
        needle
          ? {
              ...r,
              students: r.students.filter(
                (st) =>
                  st.name.toLowerCase().includes(needle) ||
                  (st.student_code ?? "").toLowerCase().includes(needle),
              ),
            }
          : r,
      )
      .filter((r) => !needle || r.students.length > 0);
  }, [rows, classId, roomId, teacherId, slot, q]);

  const stats = useMemo(() => daySummary(filtered), [filtered]);

  /** Tick một học viên — lưu ngay, không có nút "Lưu" riêng. */
  async function mark(sessionId: string, student: DayStudentRow, status: AttendanceStatus) {
    if (!user) return;
    setError(null);
    try {
      await saveAttendance(sessionId, [{ student_id: student.id, status }], user.id);
      day.reload();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  /** Tick "có mặt" cho cả ca (bỏ qua ai đã điểm danh rồi). */
  async function markAllPresent(row: DaySessionRow) {
    if (!user) return;
    const pending = row.students.filter((s) => !s.status);
    if (pending.length === 0) return;
    setError(null);
    try {
      await saveAttendance(
        row.session.id,
        pending.map((s) => ({
          student_id: s.id,
          status: (s.isMakeup ? "makeup" : "present") as AttendanceStatus,
        })),
        user.id,
      );
      day.reload();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  async function closeSession(row: DaySessionRow) {
    setError(null);
    try {
      await updateSessionStatus(row.session.id, "completed");
      day.reload();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Điểm danh — {fmtDateLabel(date)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mọi ca dạy trong ngày của chi nhánh đang xem, kèm học viên được xếp học bù. Tick là lưu ngay.
        </p>
      </div>

      {error && <ErrorNote message={error} />}
      {day.error && <ErrorNote message={day.error} />}

      <Card>
        <CardContent className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">Tất cả lớp học</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="all">Tất cả phòng học</option>
            {roomOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="all">Tất cả giáo viên</option>
            {teacherOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="all">Tất cả ca học</option>
            {slotOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm học viên..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setDate(todayISO())}>Hôm nay</Button>
        {canManageSessions && (
          <Button variant="outline" onClick={() => setBooking(true)}>
            <CalendarPlus className="h-4 w-4" /> Đặt buổi phát sinh
          </Button>
        )}
        <Link
          href="/admin/makeup"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Hàng chờ học bù
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountTile label="Học viên hôm nay" value={stats.expected} tone="violet" />
        <CountTile label="Học viên đi học thực tế" value={stats.attended} tone="sky" />
        <CountTile label="Học viên đang bảo lưu" value={stats.reserved} tone="amber" />
        <CountTile label="Học viên vắng" value={stats.absent} tone="rose" />
      </div>

      {day.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={ClipboardList}
          title={rows.length === 0 ? `Không có ca dạy nào ${fmtDateLabel(date).toLowerCase()}` : "Không có ca nào khớp bộ lọc"}
          description={
            rows.length === 0
              ? "Sinh buổi học cho lớp ở trang Lớp học, hoặc đặt một buổi phát sinh."
              : "Thử bỏ bớt bộ lọc hoặc đổi từ khóa."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((row) => (
            <SessionCard
              key={row.session.id}
              row={row}
              onMark={mark}
              onMarkAll={() => markAllPresent(row)}
              onClose={() => closeSession(row)}
              canClose={canManageSessions}
            />
          ))}
        </div>
      )}

      {booking && (
        <BookSessionModal
          date={date}
          onClose={() => setBooking(false)}
          onCreated={() => {
            setBooking(false);
            day.reload();
          }}
        />
      )}
    </div>
  );
}

/* ================= Một ca dạy ================= */

function SessionCard({
  row,
  onMark,
  onMarkAll,
  onClose,
  canClose,
}: {
  row: DaySessionRow;
  onMark: (sessionId: string, student: DayStudentRow, status: AttendanceStatus) => void;
  onMarkAll: () => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const [open, setOpen] = useState(true);
  const s = row.session;
  const marked = row.students.filter((st) => st.status).length;
  const done = row.students.length > 0 && marked === row.students.length;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          aria-label={open ? "Thu gọn" : "Mở ra"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {s.class ? s.class.name : "Buổi học lẻ / học bù"}
            </span>
            <Badge variant="outline">
              {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
            </Badge>
            {s.status === "completed" && <Badge variant="jade">Đã xong</Badge>}
            {s.status === "cancelled" && <Badge variant="destructive">Đã hủy</Badge>}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {s.teacher?.name ?? "chưa gán GV"}
            {s.room?.name ? ` · ${s.room.name}` : ""}
            {` · đã điểm danh ${marked}/${row.students.length}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onMarkAll} disabled={done}>
            <CheckCheck className="h-3.5 w-3.5" /> Có mặt cả ca
          </Button>
          {s.status !== "completed" && canClose && (
            <Button size="sm" onClick={onClose} disabled={marked === 0}>
              Chốt buổi
            </Button>
          )}
          <Link
            href={`/teacher/sessions/${s.id}`}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Mở buổi
          </Link>
        </div>
      </div>

      {open && (
        <div className="divide-y">
          {row.students.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Ca này chưa có học viên nào — xếp học viên vào lớp, hoặc xếp lượt học bù ở trang Học bù.
            </p>
          ) : (
            row.students.map((st) => (
              <div key={st.id} className="flex flex-wrap items-center gap-3 p-3 sm:px-4">
                <Avatar name={st.name} src={st.avatar ?? undefined} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/admin/members/${st.id}`} className="truncate text-sm font-semibold hover:underline">
                      {st.name}
                    </Link>
                    {st.isMakeup && <Badge variant="default">Học bù</Badge>}
                    {st.study_status === "reserved" && <Badge variant="gold">Bảo lưu</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {st.student_code ?? "—"}
                    {st.phone ? ` · ${st.phone}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_ORDER.map((status) => (
                    <button
                      key={status}
                      type="button"
                      title={ATTENDANCE_LABELS[status]}
                      onClick={() => onMark(row.session.id, st, status)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                        st.status === status
                          ? STATUS_STYLE[status]
                          : "border-input text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {STATUS_SHORT[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

/* ================= Đặt buổi phát sinh (tăng buổi cho lớp / bù riêng) ================= */

async function fetchBookingOptions() {
  const [rooms, teachers, classes] = await Promise.all([
    fetchRooms(),
    fetchProfilesByRole("teacher"),
    fetchClasses(),
  ]);
  return {
    rooms,
    teachers,
    classes: classes.filter((c) => c.status === "active" || c.status === "planned"),
  };
}

function BookSessionModal({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: opts } = useLoad(fetchBookingOptions);
  const [day, setDay] = useState(date);
  const [classId, setClassId] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:30");
  const [roomId, setRoomId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId) {
      setError("Chọn giáo viên đứng buổi để còn tính công.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createStandaloneMakeupSession({
        date: day,
        start_time: start,
        end_time: end,
        room_id: roomId || null,
        teacher_id: teacherId,
        class_id: classId || null,
        note,
      });
      onCreated();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Đặt buổi phát sinh">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Lớp học">
          <Select
            value={classId}
            onChange={(e) => {
              const id = e.target.value;
              setClassId(id);
              // Gợi ý sẵn GV phụ trách lớp cho đỡ phải chọn lại
              const cls = (opts?.classes ?? []).find((c) => c.id === id);
              const main = cls ? classTeachers(cls)[0] : null;
              if (main) setTeacherId(main.id);
            }}
          >
            <option value="">Không gắn lớp (buổi bù riêng)</option>
            {(opts?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày" required>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giờ bắt đầu" required>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Giờ kết thúc" required>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
          <Field label="Giáo viên" required>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
              <option value="">Chọn giáo viên</option>
              {(opts?.teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Phòng học">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Không gán phòng</option>
              {(opts?.rooms ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bù bài 12 cho nhóm HSK2..." />
        </Field>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {classId ? (
            <>
              Buổi tăng cường của lớp: cả lớp sẽ hiện sẵn trong danh sách điểm danh của ngày này,
              tính buổi như buổi thường. Muốn xếp thêm học viên lớp khác vào học bù thì vào{" "}
              <Link href="/admin/makeup" className="font-medium text-primary hover:underline">hàng chờ học bù</Link>.
            </>
          ) : (
            <>
              Buổi lẻ không gắn lớp nào. Tạo xong vào{" "}
              <Link href="/admin/makeup" className="font-medium text-primary hover:underline">hàng chờ học bù</Link>{" "}
              xếp học viên vào buổi này, rồi quay lại đây điểm danh.
            </>
          )}{" "}
          Giáo viên đứng buổi vẫn được tính công như buổi thường.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo buổi"}</Button>
        </div>
      </form>
    </Modal>
  );
}
