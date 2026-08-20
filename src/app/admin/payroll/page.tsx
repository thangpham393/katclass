"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Pencil,
  Wallet,
  Clock,
  GraduationCap,
  Timer,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { TeachingLogModal } from "@/components/teaching-log-modal";
import { SessionEditModal } from "@/components/session-edit-modal";
import { PayConfigModal } from "@/components/pay-config-modal";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, fetchProfilesByRole, sessionClassLabel, todayISO } from "@/lib/db";
import {
  attendanceCount,
  fetchTeachingSessions,
  fmtVND,
  payHours,
  pickLog,
  sessionHours,
  type TeachingSessionRow,
} from "@/lib/db-tuition";
import {
  computePayroll,
  fetchClassSizes,
  fetchPayProfiles,
  fetchPayTiers,
  tierLabel,
  PAY_TYPE_LABELS,
  type PayTierRow,
  type TeacherPay,
} from "@/lib/db-payroll";

/** [from, to] của một tháng dạng YYYY-MM. */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** Ngày YYYY-MM-DD lệch n ngày. */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminPayrollPage() {
  const [tab, setTab] = useState<"day" | "month" | "rates">("day");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Chấm công giáo viên</h1>
        <p className="mt-1 text-muted-foreground">
          Giáo viên bấm <span className="font-semibold text-foreground">Chấm công</span> ở trang chủ sau mỗi ca dạy —
          hệ thống ghi giờ dạy thực tế, số giờ và nội dung bài học. 1 ca đã chấm = 1 công.
        </p>
      </div>

      <div className="flex w-fit rounded-lg border bg-secondary/40 p-0.5">
        {([
          { key: "day", label: "Theo dõi theo ngày" },
          { key: "month", label: "Bảng công & lương tháng" },
          { key: "rates", label: "Mức lương giáo viên" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "day" ? <DayTracking /> : tab === "month" ? <MonthTally /> : <PayRates />}
    </div>
  );
}

/* ---------------- Theo dõi theo ngày ---------------- */

function DayTracking() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [logFor, setLogFor] = useState<TeachingSessionRow | null>(null);
  const [editFor, setEditFor] = useState<TeachingSessionRow | null>(null);

  const sessions = useLoad(
    () => fetchTeachingSessions(date, date, { includeCancelled: true }),
    [date],
  );
  const rows = sessions.data ?? [];
  const active = rows.filter((s) => s.status !== "cancelled"); // buổi đã hủy không tính công
  const logged = active.filter((s) => pickLog(s));
  const pending = active.filter((s) => !pickLog(s));
  const hours = logged.reduce((sum, s) => sum + payHours(s), 0);
  const noTeacher = active.filter((s) => !s.teacher).length;
  const d = new Date(date + "T00:00:00");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))} aria-label="Ngày trước">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="w-44">
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))} aria-label="Ngày sau">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant={date === todayISO() ? "secondary" : "ghost"} size="sm" onClick={() => setDate(todayISO())}>
          Hôm nay
        </Button>
        <span className="text-sm text-muted-foreground">
          {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Ca dạy trong ngày" value={sessions.loading ? "—" : active.length} icon={CalendarDays} accent="brand" />
        <StatCard label="Đã chấm công" value={sessions.loading ? "—" : logged.length} icon={CalendarCheck} accent="jade" />
        <StatCard label="Chưa chấm công" value={sessions.loading ? "—" : pending.length} icon={Timer} accent="gold" />
        <StatCard label="Tổng giờ đã ghi nhận" value={sessions.loading ? "—" : `${hours}h`} icon={Clock} accent="sky" />
      </section>

      {sessions.error && <ErrorNote message={sessions.error} />}
      {noTeacher > 0 && !sessions.loading && (
        <div className="flex items-center gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-gold-800">
          <CircleAlert className="h-4 w-4" /> {noTeacher} buổi trong ngày chưa gán giáo viên — không tính công được.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ca dạy</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {sessions.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : rows.length === 0 ? (
            <Empty
              icon={CalendarDays}
              title="Không có buổi học nào trong ngày này"
              description="Chọn ngày khác hoặc sinh buổi học từ lịch tuần của lớp."
              className="p-10"
            />
          ) : (
            <div className="divide-y">
              {rows.map((s) => {
                const log = pickLog(s);
                return (
                  <div
                    key={s.id}
                    className={cn("flex flex-wrap items-center gap-3 py-3", s.status === "cancelled" && "opacity-60")}
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold text-muted-foreground">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-semibold">
                        {s.class ? (
                          <Link href={`/admin/classes/${s.class.id}`} className="truncate hover:text-brand-600">
                            {s.class.name}
                          </Link>
                        ) : (
                          <span className="truncate">{sessionClassLabel(s)}</span>
                        )}
                        {s.type === "makeup" && <Badge variant="jade">Buổi bù</Badge>}
                        {s.status === "cancelled" && <Badge variant="destructive">Đã hủy</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.teacher?.name ?? "Chưa gán GV"}
                        {s.room ? ` · Phòng ${s.room.name}` : " · chưa xếp phòng"}
                        {s.session_no ? ` · Buổi ${s.session_no}` : ""}
                        {attendanceCount(s) > 0 ? ` · điểm danh ${attendanceCount(s)} HV` : " · chưa điểm danh HV"}
                      </div>
                      {log && (
                        <div className="mt-0.5 text-xs text-emerald-700">
                          Thực dạy {log.actual_start.slice(0, 5)}–{log.actual_end.slice(0, 5)} ·{" "}
                          {sessionHours({ start_time: log.actual_start, end_time: log.actual_end })}h
                          {log.lesson_content ? ` · ${log.lesson_content}` : ""}
                          {log.note ? ` (${log.note})` : ""}
                        </div>
                      )}
                    </div>
                    {s.status === "cancelled" ? null : log ? (
                      <Badge variant="jade" className="shrink-0">Đã chấm công</Badge>
                    ) : (
                      <Badge variant="gold" className="shrink-0">Chưa chấm công</Badge>
                    )}
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditFor(s)}>
                        <Pencil className="h-3.5 w-3.5" /> Sửa lớp
                      </Button>
                      {s.status !== "cancelled" && (
                        <Button size="sm" variant={log ? "ghost" : "outline"} onClick={() => setLogFor(s)}>
                          {log ? "Sửa công" : "Chấm hộ"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TeachingLogModal
        session={logFor}
        currentUserId={user?.id ?? ""}
        onClose={() => setLogFor(null)}
        onSaved={sessions.reload}
      />

      <SessionEditModal session={editFor} onClose={() => setEditFor(null)} onSaved={sessions.reload} />
    </div>
  );
}

/* ---------------- Bảng công & lương tháng ---------------- */

function MonthTally() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const sessions = useLoad(() => {
    const [from, to] = monthRange(month);
    return fetchTeachingSessions(from, to, { completedOnly: true });
  }, [month]);
  const profiles = useLoad(fetchPayProfiles, []);
  const tiers = useLoad(fetchPayTiers, []);
  const sizes = useLoad(fetchClassSizes, []);

  const loading = sessions.loading || profiles.loading || tiers.loading || sizes.loading;

  const rows = useMemo<TeacherPay[]>(
    () =>
      computePayroll(sessions.data ?? [], profiles.data ?? [], tiers.data ?? [], sizes.data ?? {}),
    [sessions.data, profiles.data, tiers.data, sizes.data],
  );

  const totalSessions = rows.reduce((s, t) => s + t.sessions.length, 0);
  const totalHours = Math.round(rows.reduce((s, t) => s + t.hours, 0) * 100) / 100;
  const totalMoney = rows.reduce((s, t) => s + t.total, 0);
  const noTeacher = (sessions.data ?? []).filter((s) => !s.teacher).length;
  const warnings = rows.filter((t) => t.unconfigured || t.missingTier > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Giờ dạy lấy theo <span className="font-semibold text-foreground">giờ thực tế đã chấm công</span> (buổi chưa
          chấm tạm tính theo giờ lịch). Tiền công tính lại theo mức lương hiện hành ở tab “Mức lương giáo viên”.
        </p>
        <div className="w-44">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="GV có công trong tháng" value={loading ? "—" : rows.length} icon={GraduationCap} accent="brand" />
        <StatCard label="Tổng buổi dạy" value={loading ? "—" : totalSessions} icon={CalendarCheck} accent="jade" />
        <StatCard label="Tổng giờ dạy" value={loading ? "—" : `${totalHours}h`} icon={Clock} accent="sky" />
        <StatCard label="Tổng chi lương" value={loading ? "—" : fmtVND(totalMoney)} icon={Wallet} accent="gold" />
      </section>

      {sessions.error && <ErrorNote message={sessions.error} />}
      {profiles.error && <ErrorNote message={profiles.error} />}

      {!loading && noTeacher > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-gold-800">
          <CircleAlert className="h-4 w-4" /> {noTeacher} buổi hoàn thành chưa gán giáo viên — không tính công được.
        </div>
      )}
      {!loading && warnings.length > 0 && (
        <div className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-gold-800">
          <div className="flex items-center gap-2 font-semibold">
            <CircleAlert className="h-4 w-4" /> Cần thiết lập mức lương
          </div>
          <ul className="mt-1 list-inside list-disc text-xs">
            {warnings.map((t) => (
              <li key={t.teacherId}>
                {t.teacherName}:{" "}
                {t.unconfigured
                  ? "chưa thiết lập mức lương → tạm tính 0 ₫"
                  : `${t.missingTier} buổi có sĩ số không khớp bậc nào → tính 0 ₫`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bảng công tháng {month.split("-")[1]}/{month.split("-")[0]}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : rows.length === 0 ? (
            <Empty
              icon={CalendarCheck}
              title="Chưa có buổi dạy hoàn thành nào trong tháng này"
              description="Khi giáo viên chấm công ca dạy (hoặc điểm danh xong buổi), công sẽ tự hiện ở đây."
              className="p-10"
            />
          ) : (
            <div className="divide-y">
              {rows.map((t) => {
                const open = expanded === t.teacherId;
                const fulltime = t.profile?.pay_type === "fulltime";
                return (
                  <div key={t.teacherId}>
                    <button
                      onClick={() => setExpanded(open ? null : t.teacherId)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <Avatar name={t.teacherName} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate text-sm font-semibold">
                          {t.teacherName}
                          {t.profile ? (
                            <Badge variant={fulltime ? "default" : "muted"}>
                              {PAY_TYPE_LABELS[t.profile.pay_type]}
                            </Badge>
                          ) : (
                            <Badge variant="gold">Chưa thiết lập lương</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.sessions.length} công · {t.hours}h
                          {fulltime && t.overtimeHours > 0 && ` · vượt ${t.overtimeHours}h`}
                          {!fulltime && t.missingTier > 0 && ` · ${t.missingTier} buổi ngoài bậc`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-extrabold">{fmtVND(t.total)}</div>
                        <div className="text-xs text-muted-foreground">
                          {fulltime
                            ? `cứng ${fmtVND(t.baseSalary)}${t.overtimeTotal > 0 ? ` + vượt ${fmtVND(t.overtimeTotal)}` : ""}`
                            : `${t.sessions.length} buổi`}
                        </div>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="mb-3 space-y-2">
                        {fulltime && t.profile && (
                          <div className="rounded-lg border bg-secondary/30 p-3 text-xs">
                            <div className="grid gap-1 sm:grid-cols-2">
                              <div>Lương cứng: <span className="font-semibold">{fmtVND(t.baseSalary)}</span></div>
                              <div>Giờ chuẩn tháng: <span className="font-semibold">{Number(t.profile.standard_hours)}h</span></div>
                              <div>Đã dạy: <span className="font-semibold">{t.hours}h</span></div>
                              <div>
                                Vượt giờ: <span className="font-semibold">{t.overtimeHours}h</span> ×{" "}
                                {fmtVND(Number(t.profile.overtime_rate))} ={" "}
                                <span className="font-semibold">{fmtVND(t.overtimeTotal)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="max-h-72 overflow-y-auto rounded-lg border bg-secondary/30 scrollbar-thin">
                          <div className="divide-y">
                            {t.sessions.map((sp) => {
                              const s = sp.session;
                              const d = new Date(s.date + "T00:00:00");
                              const log = pickLog(s);
                              return (
                                <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                                    {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")}
                                  </span>
                                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                                    {(log?.actual_start ?? s.start_time).slice(0, 5)}–
                                    {(log?.actual_end ?? s.end_time).slice(0, 5)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {sessionClassLabel(s)}
                                    {log?.lesson_content && (
                                      <span className="font-normal text-muted-foreground"> — {log.lesson_content}</span>
                                    )}
                                  </span>
                                  {s.type === "makeup" && <Badge variant="jade">Buổi bù</Badge>}
                                  {!log && <Badge variant="gold">Chưa chấm công</Badge>}
                                  <span className="shrink-0 text-xs text-muted-foreground">{sp.students} HV</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">{sp.hours}h</span>
                                  {!fulltime && (
                                    <span
                                      className={cn(
                                        "w-24 shrink-0 text-right text-xs font-semibold",
                                        sp.amount === 0 && "text-destructive",
                                      )}
                                    >
                                      {fmtVND(sp.amount)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Mức lương giáo viên ---------------- */

function PayRates() {
  const [editFor, setEditFor] = useState<{ id: string; name: string } | null>(null);

  const teachers = useLoad(() => fetchProfilesByRole("teacher"), []);
  const profiles = useLoad(fetchPayProfiles, []);
  const tiers = useLoad(fetchPayTiers, []);

  const profileBy = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.teacher_id, p])),
    [profiles.data],
  );
  const tiersBy = useMemo(() => {
    const map = new Map<string, PayTierRow[]>();
    for (const t of tiers.data ?? []) {
      const list = map.get(t.teacher_id) ?? [];
      list.push(t);
      map.set(t.teacher_id, list);
    }
    return map;
  }, [tiers.data]);

  const loading = teachers.loading || profiles.loading || tiers.loading;
  const configured = (teachers.data ?? []).filter((t) => profileBy.has(t.id)).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Thỉnh giảng</span>: trả theo từng buổi dạy, mức tiền tra theo sĩ
        số lớp.{" "}
        <span className="font-semibold text-foreground">Full time</span>: lương cứng tháng, dạy vượt số giờ chuẩn thì
        cộng thêm tiền vượt giờ. Chỉ tài khoản quản lý/hành chính xem được mục này.
      </p>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Giáo viên" value={loading ? "—" : teachers.data!.length} icon={GraduationCap} accent="brand" />
        <StatCard label="Đã thiết lập lương" value={loading ? "—" : configured} icon={Wallet} accent="jade" />
        <StatCard
          label="Chưa thiết lập"
          value={loading ? "—" : (teachers.data?.length ?? 0) - configured}
          icon={CircleAlert}
          accent="gold"
        />
        <StatCard
          label="GV full time"
          value={loading ? "—" : (profiles.data ?? []).filter((p) => p.pay_type === "fulltime").length}
          icon={Clock}
          accent="sky"
        />
      </section>

      {teachers.error && <ErrorNote message={teachers.error} />}
      {profiles.error && <ErrorNote message={profiles.error} />}

      <Card>
        <CardHeader>
          <CardTitle>Mức tiền công từng giáo viên</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : (teachers.data?.length ?? 0) === 0 ? (
            <Empty icon={GraduationCap} title="Chưa có giáo viên nào" description="Thêm giáo viên ở mục Đội ngũ." className="p-10" />
          ) : (
            <div className="divide-y">
              {teachers.data!.map((t) => {
                const p = profileBy.get(t.id);
                const list = tiersBy.get(t.id) ?? [];
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={t.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-semibold">
                        {t.name}
                        {p ? (
                          <Badge variant={p.pay_type === "fulltime" ? "default" : "muted"}>
                            {PAY_TYPE_LABELS[p.pay_type]}
                          </Badge>
                        ) : (
                          <Badge variant="gold">Chưa thiết lập</Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {!p
                          ? "Buổi dạy của GV này đang tính 0 ₫"
                          : p.pay_type === "fulltime"
                            ? `Lương cứng ${fmtVND(Number(p.base_salary))} · chuẩn ${Number(p.standard_hours)}h/tháng · vượt giờ ${fmtVND(Number(p.overtime_rate))}/h`
                            : list.length
                              ? list
                                  .map((x) => `${tierLabel(x)}: ${fmtVND(Number(x.amount))}`)
                                  .join(" · ")
                              : "Chưa có bậc theo sĩ số → buổi dạy tính 0 ₫"}
                        {p?.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditFor({ id: t.id, name: t.name })}>
                      <Pencil className="h-3.5 w-3.5" /> {p ? "Sửa mức lương" : "Thiết lập"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PayConfigModal
        teacher={editFor}
        profile={editFor ? profileBy.get(editFor.id) ?? null : null}
        tiers={editFor ? tiersBy.get(editFor.id) ?? [] : []}
        onClose={() => setEditFor(null)}
        onSaved={() => {
          profiles.reload();
          tiers.reload();
        }}
      />
    </div>
  );
}
