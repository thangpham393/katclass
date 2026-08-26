"use client";

import { useState } from "react";
import { Building2, Check, DoorOpen, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useBranch } from "@/components/shell/branch-provider";
import { updateBranch, type Branch } from "@/lib/branch";
import {
  fetchAccountProfiles,
  updateProfileRole,
  fetchRooms,
  createRoom,
  deleteRoom,
  dbErrorMessage,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";
import type { Role } from "@/lib/types";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "student", label: "Học viên" },
  { value: "parent", label: "Phụ huynh" },
  { value: "teacher", label: "Giáo viên" },
  { value: "staff", label: "Hành chính" },
  { value: "accountant", label: "Kế toán" },
  { value: "admin", label: "Quản lý" },
];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cài đặt</h1>
        <p className="mt-1 text-muted-foreground">Chi nhánh, phân quyền tài khoản và phòng học.</p>
      </div>

      <BranchManager isAdmin={isAdmin} />
      <RoleManager isAdmin={isAdmin} currentUserId={user?.id} />
      <RoomManager />
    </div>
  );
}

function BranchManager({ isAdmin }: { isAdmin: boolean }) {
  const { branches, branchId, switchTo } = useBranch();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-600" /> Chi nhánh
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Học viên, giáo viên, lớp, buổi học, học phí và bảng công tách riêng theo từng cơ sở.
          Kho học liệu (giáo trình, bài học, từ vựng, ngân hàng câu hỏi) dùng chung cả hai.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
        {branches.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            isAdmin={isAdmin}
            isCurrent={b.id === branchId}
            onSelect={() => switchTo(b.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function BranchCard({
  branch,
  isAdmin,
  isCurrent,
  onSelect,
}: {
  branch: Branch;
  isAdmin: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const [address, setAddress] = useState(branch.address ?? "");
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirty = address !== (branch.address ?? "") || phone !== (branch.phone ?? "");

  async function handleSave() {
    setSaving(true);
    setActionError(null);
    try {
      await updateBranch(branch.id, { address: address.trim() || null, phone: phone.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setActionError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        "rounded-xl border p-4 " + (isCurrent ? "border-brand-500 bg-brand-50/40" : "bg-card")
      }
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{branch.name}</div>
          <div className="text-xs text-muted-foreground">
            {isCurrent ? "Đang xem cơ sở này" : "Bấm \"Xem cơ sở này\" để chuyển sang"}
          </div>
        </div>
        {isCurrent ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">
            <Check className="h-3 w-3" /> Đang xem
          </span>
        ) : (
          <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={onSelect}>
            Xem cơ sở này
          </Button>
        )}
      </div>

      {actionError && <ErrorNote message={actionError} />}

      <div className="mt-3 space-y-2">
        <Input
          placeholder="Địa chỉ cơ sở"
          value={address}
          disabled={!isAdmin}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="Điện thoại"
            value={phone}
            disabled={!isAdmin}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button onClick={handleSave} disabled={!isAdmin || !dirty || saving}>
            {saved ? "Đã lưu" : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoleManager({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId?: string }) {
  const { data: profiles, loading, error, reload } = useLoad(fetchAccountProfiles);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: Role) {
    setBusy(userId);
    setActionError(null);
    try {
      await updateProfileRole(userId, role);
      reload();
    } catch (e) {
      setActionError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Phân quyền tài khoản
        </CardTitle>
        {!isAdmin && (
          <p className="text-sm text-muted-foreground">
            Chỉ tài khoản Quản lý mới đổi được vai trò.
          </p>
        )}
      </CardHeader>
      {error && <ErrorNote message={error} />}
      {actionError && <ErrorNote message={actionError} />}
      {loading ? (
        <LoadingRows rows={4} />
      ) : (
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="divide-y">
            {(profiles ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <Avatar name={p.name} src={p.avatar ?? undefined} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(bạn)</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                <Select
                  wrapClassName="w-32 shrink-0 sm:w-auto"
                  className="w-full sm:w-36"
                  value={p.role}
                  disabled={!isAdmin || busy === p.id || p.id === currentUserId}
                  onChange={(e) => handleRoleChange(p.id, e.target.value as Role)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function RoomManager() {
  const { data: rooms, loading, error, reload } = useLoad(fetchRooms);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await createRoom({ name: name.trim(), capacity: capacity ? Number(capacity) : null });
      setName("");
      setCapacity("");
      reload();
    } catch (err) {
      setActionError(dbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, roomName: string) {
    if (!confirm(`Xóa phòng "${roomName}"?`)) return;
    setActionError(null);
    try {
      await deleteRoom(id);
      reload();
    } catch (err) {
      setActionError(dbErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-brand-600" /> Phòng học
        </CardTitle>
      </CardHeader>
      {error && <ErrorNote message={error} />}
      {actionError && <ErrorNote message={actionError} />}
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <form onSubmit={handleCreate} className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
          <Input
            className="w-full sm:w-48"
            placeholder="Tên phòng (P.101...)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="w-full sm:w-32"
            type="number"
            min={1}
            placeholder="Sức chứa"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <Button type="submit" disabled={saving || !name.trim()}>
            <Plus className="h-4 w-4" /> Thêm phòng
          </Button>
        </form>
        {loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : (rooms?.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có phòng học — thêm phòng để xếp lịch và chống trùng phòng tự động.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {rooms!.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-brand-700">
                  <DoorOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.capacity ? `${r.capacity} chỗ` : "Chưa rõ sức chứa"}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(r.id, r.name)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                  title="Xóa phòng"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
