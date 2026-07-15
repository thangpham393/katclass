"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, GraduationCap, KeyRound, Mail, Phone, Plus, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  fetchProfilesByRole,
  createTeamProfile,
  provisionAccount,
  dbErrorMessage,
  TEAM_ROLE_LABELS,
  type ProfileRow,
  type TeamRole,
} from "@/lib/db";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";
import { useLoad } from "@/lib/use-load";

export default function AdminTeamPage() {
  const [role, setRole] = useState<TeamRole>("teacher");
  const list = useLoad(() => fetchProfilesByRole(role), [role]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ profile: ProfileRow; provisionError?: string } | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noAccount = (list.data ?? []).filter((p) => !p.user_id);
  const activated = (list.data ?? []).filter((p) => p.user_id).length;

  /** Cấp tài khoản cho các hồ sơ tạo từ trước chưa có tài khoản. */
  async function handleBulkProvision() {
    if (!confirm(
      `Cấp tài khoản đăng nhập cho ${noAccount.length} ${TEAM_ROLE_LABELS[role].toLowerCase()} chưa có?\n` +
      `Mật khẩu mặc định ${DEFAULT_LOGIN_PASSWORD} (đổi sau khi đăng nhập).`,
    )) return;
    setError(null);
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
    list.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Đội ngũ</h1>
          <p className="mt-1 text-muted-foreground">
            {list.loading
              ? "Đang tải..."
              : `${list.data?.length ?? 0} ${TEAM_ROLE_LABELS[role].toLowerCase()} · ${activated} đã có tài khoản.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Thêm {TEAM_ROLE_LABELS[role].toLowerCase()}
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl border bg-card p-1">
        {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              role === r ? "bg-brand-600 text-white shadow-soft" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {r === "teacher" ? <GraduationCap className="h-4 w-4" /> : <UserCog className="h-4 w-4" />}
            {TEAM_ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} />}
      {list.error && <ErrorNote message={list.error} />}

      {!list.loading && noAccount.length > 0 && !bulk && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="text-sm text-brand-800">
            <b>{noAccount.length} {TEAM_ROLE_LABELS[role].toLowerCase()}</b> chưa có tài khoản đăng nhập.
            Cấp xong chỉ cần gửi mã + mật khẩu mặc định <b>{DEFAULT_LOGIN_PASSWORD}</b>.
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

      {list.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : (list.data?.length ?? 0) === 0 ? (
        <Empty
          icon={role === "teacher" ? GraduationCap : UserCog}
          title={`Chưa có ${TEAM_ROLE_LABELS[role].toLowerCase()}`}
          description="Bấm “Thêm” — hệ thống tự cấp mã + tài khoản đăng nhập."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Thêm {TEAM_ROLE_LABELS[role].toLowerCase()}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.data!.map((p) => (
            <Link key={p.id} href={`/admin/members/${p.id}`}>
            <Card className="card-hover h-full">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={p.name} src={p.avatar ?? undefined} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.name}</div>
                    {p.student_code && (
                      <div className="mt-0.5 font-mono text-xs font-semibold text-brand-700">
                        {p.student_code}
                      </div>
                    )}
                  </div>
                  {p.user_id ? (
                    <Badge variant="jade">Đã có tài khoản</Badge>
                  ) : (
                    <Badge variant="gold">Chưa có tài khoản</Badge>
                  )}
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {p.email || "Chưa có email"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {p.phone ?? "Chưa có SĐT"}
                  </div>
                </div>
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <CreateTeamModal
          role={role}
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            setCreated(result);
            list.reload();
          }}
        />
      )}

      {created && (
        <AccountInfoModal
          profile={created.profile}
          provisionError={created.provisionError}
          onClose={() => setCreated(null)}
        />
      )}
    </div>
  );
}

/* ================= Tạo hồ sơ mới (tự cấp mã + tài khoản) ================= */

function CreateTeamModal({
  role: initialRole,
  onClose,
  onCreated,
}: {
  role: TeamRole;
  onClose: () => void;
  onCreated: (result: { profile: ProfileRow; provisionError?: string }) => void;
}) {
  const [role, setRole] = useState<TeamRole>(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Tạo hồ sơ (trigger DB tự cấp mã GVKAT/NVKAT) rồi cấp tài khoản luôn
      const profile = await createTeamProfile({ name, email, phone, role });
      try {
        await provisionAccount(profile.id);
        onCreated({ profile });
      } catch (provErr) {
        onCreated({
          profile,
          provisionError: provErr instanceof Error ? provErr.message : "Không cấp được tài khoản.",
        });
      }
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Thêm giáo viên / nhân viên">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Vai trò" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
            {(Object.keys(TEAM_ROLE_LABELS) as TeamRole[]).map((r) => (
              <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Họ tên" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Thị Mai" required autoFocus />
        </Field>
        <Field label="Email (không bắt buộc)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mai@gmail.com" />
        </Field>
        <Field label="Số điện thoại">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
        </Field>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Tạo xong hệ thống tự cấp <b>mã đăng nhập</b> (GVKAT/NVKAT) và tài khoản với mật khẩu mặc định{" "}
          <b>{DEFAULT_LOGIN_PASSWORD}</b>.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo & cấp tài khoản"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Hiện mã + mật khẩu sau khi tạo ================= */

function AccountInfoModal({
  profile: p,
  provisionError,
  onClose,
}: {
  profile: ProfileRow;
  provisionError?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const summary = `Mã đăng nhập: ${p.student_code}\nMật khẩu: ${DEFAULT_LOGIN_PASSWORD}\nĐăng nhập tại: ${typeof window !== "undefined" ? window.location.origin : ""}/login`;

  function handleCopy() {
    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Modal open onClose={onClose} title={`Đã tạo — ${p.name}`}>
      <div className="space-y-4">
        {provisionError ? (
          <ErrorNote message={`Hồ sơ đã tạo nhưng chưa cấp được tài khoản: ${provisionError}. Dùng nút "Cấp tài khoản cho tất cả" để thử lại.`} />
        ) : (
          <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gửi thông tin đăng nhập này cho {p.name}
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
          Đăng nhập lần đầu sẽ được nhắc đổi mật khẩu ngay để bảo mật.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Xong</Button>
        </div>
      </div>
    </Modal>
  );
}
