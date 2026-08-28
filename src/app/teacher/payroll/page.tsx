"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarCheck, Clock, Coins, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { WEEKDAY_LABELS } from "@/lib/db";
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
  PAY_TYPE_LABELS,
  tierLabel,
} from "@/lib/db-payroll";

/** YYYY-MM của tháng hiện tại. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Ngày đầu / cuối của tháng YYYY-MM. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function fmtDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return `${WEEKDAY_LABELS[d.getDay()]} ${d.toLocaleDateString("vi-VN")}`;
}

/**
 * CHẤM CÔNG CỦA TÔI — giáo viên tự đối soát trước khi nhận lương.
 *
 * Chỉ đọc, không sửa được gì: buổi dạy đã hoàn thành trong tháng, giờ thực
 * tế đã chấm (nếu quên chấm thì lấy giờ theo lịch và có nhãn cảnh báo), và
 * tiền công quy ra theo mức lương trung tâm đã thiết lập cho mình.
 *
 * Mức lương do hành chính giữ (bảng `teacher_pay_profiles`) — giáo viên chỉ
 * đọc được dòng của chính mình. Trung tâm chưa thiết lập thì trang vẫn chạy,
 * chỉ hiện số buổi / số giờ.
 */
export default function TeacherPayrollPage() {
  const { user } = useAuth();
  const teacherId = user?.id ?? "";
  const [month, setMonth] = useState(currentMonth);
  const { from, to } = monthRange(month);

  const sessions = useLoad(
    () =>
      teacherId
        ? fetchTeachingSessions(from, to, { teacherId, completedOnly: true })
        : Promise.resolve([] as TeachingSessionRow[]),
    [teacherId, from, to],
  );
  const profiles = useLoad(() => fetchPayProfiles().catch(() => []), []);
  const tiers = useLoad(() => fetchPayTiers().catch(() => []), []);
  const sizes = useLoad(() => fetchClassSizes().catch(() => ({})), []);

  const ready = !!sessions.data && !!profiles.data && !!tiers.data && !!sizes.data;

  const pay = useMemo(() => {
    if (!ready || !teacherId) return null;
    const rows = computePayroll(
      sessions.data ?? [],
      profiles.data ?? [],
      tiers.data ?? [],
      sizes.data ?? {},
    );
    return rows.find((r) => r.teacherId === teacherId) ?? null;
  }, [ready, teacherId, sessions.data, profiles.data, tiers.data, sizes.data]);

  const myProfile = (profiles.data ?? []).find((p) => p.teacher_id === teacherId) ?? null;
  const myTiers = (tiers.data ?? []).filter((t) => t.teacher_id === teacherId);
  const list = sessions.data ?? [];
  const totalHours = list.reduce((s, x) => s + payHours(x), 0);
  const unlogged = list.filter((s) => !pickLog(s)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Chấm công của tôi</h1>
          <p className="mt-1 text-muted-foreground">
            Số buổi và số giờ đã dạy trong tháng — đối soát trước khi nhận lương.
          </p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          className="w-44"
          aria-label="Chọn tháng"
        />
      </div>

      {sessions.error && <ErrorNote message={sessions.error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Buổi đã dạy" value={list.length} icon={CalendarCheck} />
        <StatCard
          label="Tổng giờ dạy"
          value={`${Math.round(totalHours * 100) / 100} giờ`}
          icon={Clock}
          accent="sky"
        />
        <StatCard
          label="Tiền công tạm tính"
          value={myProfile && pay ? fmtVND(pay.total) : "—"}
          icon={Coins}
          accent="jade"
        />
      </div>

      {!profiles.loading && !myProfile && (
        <div className="flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Trung tâm chưa công bố mức lương cho tài khoản của bạn, nên trang này mới hiện được số
            buổi và số giờ. Cần biết tiền công thì nhắn văn phòng nhé.
          </span>
        </div>
      )}

      {myProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Mức lương đang áp dụng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-sm sm:p-5 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{PAY_TYPE_LABELS[myProfile.pay_type]}</Badge>
              {myProfile.pay_type === "fulltime" ? (
                <span className="text-muted-foreground">
                  Lương cứng {fmtVND(myProfile.base_salary)}/tháng · chuẩn{" "}
                  {myProfile.standard_hours} giờ · vượt giờ {fmtVND(myProfile.overtime_rate)}/giờ
                </span>
              ) : (
                <span className="text-muted-foreground">Tiền theo từng buổi, tùy sĩ số lớp</span>
              )}
            </div>

            {myProfile.pay_type === "visiting" && myTiers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {myTiers.map((t) => (
                  <Badge key={t.id} variant="muted">
                    {tierLabel(t)}: {fmtVND(t.amount)}/buổi
                  </Badge>
                ))}
              </div>
            )}

            {pay && myProfile.pay_type === "fulltime" && (
              <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
                Lương cứng {fmtVND(pay.baseSalary)}
                {pay.overtimeHours > 0 ? (
                  <>
                    {" + vượt "}
                    {pay.overtimeHours} giờ × {fmtVND(myProfile.overtime_rate)} ={" "}
                    {fmtVND(pay.overtimeTotal)}
                  </>
                ) : (
                  " · chưa vượt giờ chuẩn"
                )}
                <span className="font-bold"> → {fmtVND(pay.total)}</span>
              </div>
            )}

            {pay && pay.missingTier > 0 && (
              <p className="text-xs text-gold-700">
                {pay.missingTier} buổi chưa tra được bậc theo sĩ số — trung tâm sẽ đối soát tay.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Số liệu tạm tính từ buổi đã hoàn thành; bảng lương chính thức do trung tâm chốt.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Buổi đã dạy trong tháng <Badge className="ml-1">{list.length}</Badge>
            {unlogged > 0 && (
              <Badge variant="gold" className="ml-1.5">
                {unlogged} buổi chưa chấm công
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          {sessions.loading ? (
            <LoadingRows rows={4} className="p-0" />
          ) : list.length === 0 ? (
            <Empty
              icon={FileText}
              title="Chưa có buổi nào hoàn thành trong tháng"
              description="Buổi dạy hiện ở đây sau khi bạn bấm “Chấm công” ở trang Tổng quan."
              className="p-8"
            />
          ) : (
            <div className="divide-y">
              {list.map((s) => {
                const log = pickLog(s);
                const sessionPay = pay?.sessions.find((x) => x.session.id === s.id);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                        {s.class?.name ?? "Buổi học bù riêng"}
                        {!log && <Badge variant="gold">Chưa chấm công</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {fmtDate(s.date)} ·{" "}
                        {log
                          ? `${log.actual_start.slice(0, 5)}–${log.actual_end.slice(0, 5)} (giờ thực tế)`
                          : `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} (giờ theo lịch)`}
                        {` · ${attendanceCount(s)} HV điểm danh`}
                      </div>
                      {log?.lesson_content && (
                        <div className="truncate text-xs text-muted-foreground">
                          Nội dung: {log.lesson_content}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold">
                        {log ? payHours(s) : sessionHours(s)} giờ
                      </div>
                      {sessionPay && sessionPay.amount > 0 && (
                        <div className="text-xs text-emerald-700">{fmtVND(sessionPay.amount)}</div>
                      )}
                    </div>
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
