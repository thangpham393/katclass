"use client";

import { useState } from "react";
import { Check, Copy, GraduationCap, KeyRound, Mail, Phone, Plus, Undo2, UserCog } from "lucide-react";
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
  issueInviteCode,
  revokeInviteCode,
  dbErrorMessage,
  TEAM_ROLE_LABELS,
  type ProfileRow,
  type TeamRole,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function AdminTeamPage() {
  const [role, setRole] = useState<TeamRole>("teacher");
  const list = useLoad(() => fetchProfilesByRole(role), [role]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<ProfileRow | null>(null);

  const activated = (list.data ?? []).filter((p) => p.user_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Đội ngũ</h1>
          <p className="mt-1 text-muted-foreground">
            {list.loading
              ? "Đang tải..."
              : `${list.data?.length ?? 0} ${TEAM_ROLE_LABELS[role].toLowerCase()} · ${activated} đã kích hoạt tài khoản.`}
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

      {list.loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : (list.data?.length ?? 0) === 0 ? (
        <Empty
          icon={role === "teacher" ? GraduationCap : UserCog}
          title={`Chưa có ${TEAM_ROLE_LABELS[role].toLowerCase()}`}
          description="Bấm “Thêm” để tạo hồ sơ và cấp mã kích hoạt tài khoản."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Thêm {TEAM_ROLE_LABELS[role].toLowerCase()}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.data!.map((p) => (
            <TeamCard
              key={p.id}
              profile={p}
              onChanged={list.reload}
              onError={(m) => setError(m)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateTeamModal
          role={role}
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            setJustCreated(p);
            list.reload();
          }}
        />
      )}

      {justCreated && (
        <InviteCodeModal profile={justCreated} onClose={() => setJustCreated(null)} />
      )}
    </div>
  );
}

/* ================= Thẻ thành viên ================= */

function TeamCard({
  profile: p,
  onChanged,
  onError,
}: {
  profile: ProfileRow;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleIssue() {
    if (
      p.invite_code &&
      !confirm("Cấp mã mới sẽ vô hiệu mã cũ. Tiếp tục?")
    ) return;
    setBusy(true);
    try {
      await issueInviteCode(p.id);
      onChanged();
    } catch (e) {
      onError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!confirm(`Thu hồi mã kích hoạt của ${p.name}?`)) return;
    setBusy(true);
    try {
      await revokeInviteCode(p.id);
      onChanged();
    } catch (e) {
      onError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!p.invite_code) return;
    navigator.clipboard.writeText(p.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card className="card-hover">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={p.name} src={p.avatar ?? undefined} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{p.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              Tham gia {new Date(p.created_at).toLocaleDateString("vi-VN")}
            </div>
          </div>
          {p.user_id ? (
            <Badge variant="jade">Đã kích hoạt</Badge>
          ) : (
            <Badge variant="gold">Chưa kích hoạt</Badge>
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

        {!p.user_id && (
          <div className="mt-4 border-t pt-3">
            {p.invite_code ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-center font-mono text-sm font-bold tracking-widest">
                  {p.invite_code}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy} title="Copy mã">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={handleRevoke} title="Thu hồi mã">
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="w-full" disabled={busy} onClick={handleIssue}>
                <KeyRound className="h-3.5 w-3.5" /> Cấp mã đăng nhập
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================= Tạo hồ sơ mới ================= */

function CreateTeamModal({
  role: initialRole,
  onClose,
  onCreated,
}: {
  role: TeamRole;
  onClose: () => void;
  onCreated: (p: ProfileRow) => void;
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
      const p = await createTeamProfile({ name, email, phone, role });
      onCreated(p);
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
        <Field
          label="Email"
          hint="Nếu nhập đúng email họ dùng đăng nhập (Google), tài khoản sẽ tự liên kết — không cần mã."
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mai@gmail.com" />
        </Field>
        <Field label="Số điện thoại">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang tạo..." : "Tạo & cấp mã"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Hiện mã sau khi tạo ================= */

function InviteCodeModal({ profile: p, onClose }: { profile: ProfileRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!p.invite_code) return;
    navigator.clipboard.writeText(p.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Modal open onClose={onClose} title={`Mã kích hoạt — ${p.name}`}>
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gửi mã này cho {p.name}
          </div>
          <div className="mt-2 font-mono text-3xl font-extrabold tracking-[0.2em] text-brand-700">
            {p.invite_code}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Đã copy" : "Copy mã"}
          </Button>
        </div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Vào trang web, bấm <b>Đăng nhập</b> bằng Google (hoặc tài khoản email).</li>
          <li>Mở trang <b>Kích hoạt tài khoản</b> (link ngay dưới form đăng nhập).</li>
          <li>Nhập mã trên → hệ thống tự nhận đúng vai trò {TEAM_ROLE_LABELS[p.role as TeamRole]?.toLowerCase() ?? p.role}.</li>
        </ol>
        {p.email && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Đã có email <b>{p.email}</b> — nếu họ đăng nhập đúng email này, tài khoản tự liên kết, không cần mã.
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Xong</Button>
        </div>
      </div>
    </Modal>
  );
}
