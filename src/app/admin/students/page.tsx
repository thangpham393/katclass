"use client";

import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus, Search, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchStudentsWithClassCount,
  createStudentProfile,
  provisionAccount,
  dbErrorMessage,
  type ProfileRow,
} from "@/lib/db";
import { DEFAULT_LOGIN_PASSWORD } from "@/lib/student-login";
import { useLoad } from "@/lib/use-load";

type Filter = "all" | "unassigned" | "assigned" | "no-account";

export default function AdminStudentsPage() {
  const { data: students, loading, error, reload } = useLoad(fetchStudentsWithClassCount);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ profile: ProfileRow; provisionError?: string } | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = students ?? [];
    if (filter === "unassigned" || filter === "assigned") {
      list = list.filter((s) => {
        const count = s.class_students?.[0]?.count ?? 0;
        return filter === "unassigned" ? count === 0 : count > 0;
      });
    }
    if (filter === "no-account") list = list.filter((s) => !s.user_id);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle) ||
          (s.student_code ?? "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [students, q, filter]);

  const unassignedCount = (students ?? []).filter((s) => (s.class_students?.[0]?.count ?? 0) === 0).length;
  const noAccount = (students ?? []).filter((s) => !s.user_id);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Học viên</h1>
          <p className="mt-1 text-muted-foreground">
            {loading
              ? "Đang tải..."
              : `${students?.length ?? 0} học viên · ${unassignedCount} chờ xếp lớp.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Thêm học viên
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
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, email, mã học viên..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select className="w-48" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">Tất cả</option>
            <option value="unassigned">Chờ xếp lớp</option>
            <option value="assigned">Đã có lớp</option>
            <option value="no-account">Chưa có tài khoản</option>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={Users}
          title={q || filter !== "all" ? "Không có học viên phù hợp" : "Chưa có học viên"}
          description={
            q || filter !== "all"
              ? "Thử đổi bộ lọc hoặc từ khóa."
              : "Bấm “Thêm học viên” — hệ thống tự cấp mã + tài khoản đăng nhập."
          }
        />
      ) : (
        <Card>
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <div className="col-span-5">Học viên</div>
            <div className="col-span-2">Liên hệ</div>
            <div className="col-span-3">Tài khoản</div>
            <div className="col-span-2 text-right">Lớp</div>
          </div>
          <div className="divide-y">
            {filtered.map((s) => {
              const count = s.class_students?.[0]?.count ?? 0;
              return (
                <div key={s.id} className="grid grid-cols-1 items-center gap-3 px-5 py-3 md:grid-cols-12">
                  <div className="col-span-5 flex items-center gap-3">
                    <Avatar name={s.name} src={s.avatar ?? undefined} size={38} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.student_code && (
                          <span className="font-mono font-medium text-brand-700">{s.student_code}</span>
                        )}
                        {s.student_code && s.email && " · "}
                        {s.email}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">{s.phone ?? "—"}</div>
                  <div className="col-span-3">
                    {s.user_id ? (
                      <Badge variant="jade">Đã cấp tài khoản</Badge>
                    ) : (
                      <Badge variant="gold">Chưa có tài khoản</Badge>
                    )}
                  </div>
                  <div className="col-span-2 md:text-right">
                    {count === 0 ? (
                      <Badge variant="muted">Chờ xếp lớp</Badge>
                    ) : (
                      <Badge variant="jade">{count} lớp</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
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

/* ================= Thêm học viên (tự cấp mã + tài khoản) ================= */

function CreateStudentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: { profile: ProfileRow; provisionError?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Tạo hồ sơ (trigger DB tự cấp mã HVKAT) rồi cấp tài khoản luôn
      const profile = await createStudentProfile({ name, phone, email });
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
    <Modal open onClose={onClose} title="Thêm học viên">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Họ tên" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Minh An" required autoFocus />
        </Field>
        <Field label="Số điện thoại (phụ huynh hoặc học viên)">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
        </Field>
        <Field label="Email (không bắt buộc)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="an@gmail.com" />
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
        {provisionError ? (
          <ErrorNote message={`Hồ sơ đã tạo nhưng chưa cấp được tài khoản: ${provisionError}. Dùng nút "Cấp tài khoản cho tất cả" ở danh sách để thử lại.`} />
        ) : (
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
