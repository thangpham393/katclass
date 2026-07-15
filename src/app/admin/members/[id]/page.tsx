"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Copy, KeyRound, Mail, MapPin, Phone,
  RotateCcw, StickyNote, Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchProfile,
  fetchStudentClasses,
  fetchStudentAttendanceSummary,
  fetchTeacherClasses,
  provisionAccount,
  resetMemberPassword,
  deleteMember,
  formatSchedules,
  ATTENDANCE_LABELS,
  CLASS_STATUS_LABELS,
  type AttendanceStatus,
} from "@/lib/db";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";
import { useLoad } from "@/lib/use-load";
import { pct } from "@/lib/utils";
import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  student: "Học viên",
  parent: "Phụ huynh",
  teacher: "Giáo viên",
  staff: "Nhân viên hành chính",
  admin: "Quản trị",
};

export default function AdminMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const profileId = params.id;

  const profile = useLoad(() => fetchProfile(profileId), [profileId]);
  const p = profile.data;

  const studentClasses = useLoad(
    () => (p?.role === "student" ? fetchStudentClasses(profileId) : Promise.resolve([])),
    [profileId, p?.role],
  );
  const attendanceSummary = useLoad(
    () =>
      p?.role === "student"
        ? fetchStudentAttendanceSummary(profileId)
        : Promise.resolve({ total: 0, byStatus: { present: 0, absent_excused: 0, absent_unexcused: 0, makeup: 0 } }),
    [profileId, p?.role],
  );
  const teacherClasses = useLoad(
    () => (p?.role === "teacher" ? fetchTeacherClasses(profileId) : Promise.resolve([])),
    [profileId, p?.role],
  );

  const [busy, setBusy] = useState<"provision" | "reset" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const backHref = p?.role === "student" ? "/admin/students" : "/admin/teachers";
  const backLabel = p?.role === "student" ? "Danh sách học viên" : "Đội ngũ";

  async function handleProvision() {
    setBusy("provision");
    setError(null);
    setNotice(null);
    try {
      const { code } = await provisionAccount(profileId);
      setNotice(`Đã cấp tài khoản. Gửi cho ${p?.name}: mã ${code} · mật khẩu ${DEFAULT_LOGIN_PASSWORD}.`);
      profile.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetPassword() {
    if (!confirm(`Đặt lại mật khẩu của ${p?.name} về mặc định ${DEFAULT_LOGIN_PASSWORD}?`)) return;
    setBusy("reset");
    setError(null);
    setNotice(null);
    try {
      const { code } = await resetMemberPassword(profileId);
      setNotice(`Đã đặt lại mật khẩu. Gửi cho ${p?.name}: mã ${code} · mật khẩu ${DEFAULT_LOGIN_PASSWORD} (sẽ được nhắc đổi khi đăng nhập).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirm(
      `XÓA ${p?.name} (${p?.student_code ?? "chưa có mã"})?\n` +
      `Hồ sơ, tài khoản đăng nhập và dữ liệu gắn kèm (điểm danh, lớp đã xếp...) sẽ bị xóa vĩnh viễn.`,
    )) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteMember(profileId);
      router.replace(backHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      setBusy(null);
    }
  }

  function handleCopy() {
    if (!p?.student_code) return;
    const summary = `Mã đăng nhập: ${p.student_code}\nMật khẩu mặc định: ${DEFAULT_LOGIN_PASSWORD}\nĐăng nhập tại: ${window.location.origin}/login`;
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (profile.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (profile.error) return <ErrorNote message={profile.error} />;
  if (!p) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy thành viên này." />
        <Link href="/admin/students" className="text-sm font-semibold text-brand-600">← Danh sách học viên</Link>
      </div>
    );
  }

  const summary = attendanceSummary.data;
  const attended = (summary?.byStatus.present ?? 0) + (summary?.byStatus.makeup ?? 0);

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={p.name} src={p.avatar ?? undefined} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{p.name}</h1>
            <Badge variant="muted">{ROLE_LABELS[p.role]}</Badge>
            {p.user_id ? (
              <Badge variant="jade">Đã có tài khoản</Badge>
            ) : (
              <Badge variant="gold">Chưa có tài khoản</Badge>
            )}
          </div>
          {p.student_code && (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-widest text-brand-700">{p.student_code}</span>
              <button
                onClick={handleCopy}
                title="Copy mã + mật khẩu mặc định"
                className="grid h-7 w-7 place-items-center rounded-md border text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Thông tin liên hệ</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 p-6 pt-0 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {p.email || "Chưa có email"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {p.phone ?? "Chưa có SĐT"}
              </div>
              {p.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {p.address}
                </div>
              )}
              {p.note && (
                <div className="flex items-start gap-2">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p.note}
                </div>
              )}
              <div className="pt-1 text-xs">
                Tham gia {new Date(p.created_at).toLocaleDateString("vi-VN")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tài khoản đăng nhập</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 p-6 pt-0">
              {!p.user_id ? (
                <Button className="w-full" disabled={busy !== null} onClick={handleProvision}>
                  <KeyRound className="h-4 w-4" />
                  {busy === "provision" ? "Đang cấp..." : "Cấp tài khoản đăng nhập"}
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled={busy !== null} onClick={handleResetPassword}>
                  <RotateCcw className="h-4 w-4" />
                  {busy === "reset" ? "Đang đặt lại..." : `Reset mật khẩu về ${DEFAULT_LOGIN_PASSWORD}`}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full text-gold-700 hover:bg-gold-50"
                disabled={busy !== null || p.id === me?.id}
                onClick={handleDelete}
                title={p.id === me?.id ? "Không thể tự xóa chính mình" : undefined}
              >
                <Trash2 className="h-4 w-4" />
                {busy === "delete" ? "Đang xóa..." : "Xóa thành viên"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Reset xong gửi lại mã + mật khẩu mặc định; thành viên sẽ được nhắc đổi khi đăng nhập.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {p.role === "student" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Lớp đang tham gia
                    <Badge variant="muted" className="ml-2">{studentClasses.data?.length ?? 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  {studentClasses.loading ? (
                    <LoadingRows rows={2} className="p-0" />
                  ) : (studentClasses.data?.length ?? 0) === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Chưa vào lớp nào — xếp lớp ở trang chi tiết lớp.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {studentClasses.data!.map((c) => (
                        <Link
                          key={c.class_id}
                          href={`/admin/classes/${c.class_id}`}
                          className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700"
                        >
                          <span className="min-w-0 flex-1 truncate font-semibold">{c.class?.name ?? "?"}</span>
                          <span className="text-xs text-muted-foreground">
                            Vào lớp {new Date(c.joined_at).toLocaleDateString("vi-VN")}
                          </span>
                          <Badge variant={c.class?.status === "active" ? "jade" : "muted"}>
                            {c.class ? CLASS_STATUS_LABELS[c.class.status as keyof typeof CLASS_STATUS_LABELS] ?? c.class.status : "?"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Điểm danh
                    {summary && summary.total > 0 && (
                      <Badge variant="jade" className="ml-2">
                        Chuyên cần {pct(attended, summary.total)}%
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  {attendanceSummary.loading ? (
                    <LoadingRows rows={2} className="p-0" />
                  ) : summary && summary.total > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[]).map((k) => (
                        <div key={k} className="rounded-xl border bg-card p-3 text-center">
                          <div className="text-2xl font-extrabold">{summary.byStatus[k]}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{ATTENDANCE_LABELS[k]}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Chưa có lượt điểm danh nào.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {p.role === "teacher" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Lớp phụ trách
                  <Badge variant="muted" className="ml-2">{teacherClasses.data?.length ?? 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {teacherClasses.loading ? (
                  <LoadingRows rows={2} className="p-0" />
                ) : (teacherClasses.data?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Chưa phụ trách lớp nào — gán ở trang chi tiết lớp.
                  </div>
                ) : (
                  <div className="divide-y">
                    {teacherClasses.data!.map((c) => (
                      <Link
                        key={c.id}
                        href={`/admin/classes/${c.id}`}
                        className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{formatSchedules(c.class_schedules)}</span>
                        <Badge variant={c.status === "active" ? "jade" : "muted"}>
                          {CLASS_STATUS_LABELS[c.status]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(p.role === "staff" || p.role === "admin") && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {ROLE_LABELS[p.role]} dùng chung khu quản trị — không có dữ liệu lớp/điểm danh riêng.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
