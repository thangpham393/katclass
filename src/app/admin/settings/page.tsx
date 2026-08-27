"use client";

import { Fragment, useState } from "react";
import { Building2, Check, DoorOpen, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useBranch } from "@/components/shell/branch-provider";
import { updateBranch, type Branch } from "@/lib/branch";
import {
  fetchRooms,
  createRoom,
  deleteRoom,
  dbErrorMessage,
} from "@/lib/db";
import {
  PERMISSION_GROUPS,
  fetchPermissionMatrix,
  grantPermission,
  revokePermission,
  type Permission,
} from "@/lib/permissions";
import { useLoad } from "@/lib/use-load";
import type { Role } from "@/lib/types";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cài đặt</h1>
        <p className="mt-1 text-muted-foreground">
          Chi nhánh, quyền của từng vai trò và phòng học.
        </p>
      </div>

      <BranchManager isAdmin={isAdmin} />
      <PermissionMatrix isAdmin={isAdmin} />
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

/* ================= Ma trận quyền theo vai trò ================= */

/** Vai trò được cấu hình quyền — admin luôn toàn quyền nên không có ở đây. */
const MATRIX_ROLES: { value: Role; label: string; note?: string }[] = [
  { value: "staff", label: "Hành chính" },
  { value: "accountant", label: "Kế toán" },
  { value: "teacher", label: "Giáo viên", note: "ngoài quyền sẵn có với lớp mình dạy" },
];

function PermissionMatrix({ isAdmin }: { isAdmin: boolean }) {
  const matrix = useLoad(fetchPermissionMatrix);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Ghi đè lạc quan để ô tích phản hồi ngay, không chờ tải lại cả bảng. */
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const cellKey = (role: Role, perm: Permission) => `${role}:${perm}`;

  function checked(role: Role, perm: Permission): boolean {
    const k = cellKey(role, perm);
    if (k in draft) return draft[k];
    return (matrix.data?.[role] ?? []).includes(perm);
  }

  async function toggle(role: Role, perm: Permission) {
    const k = cellKey(role, perm);
    const next = !checked(role, perm);
    setBusy(k);
    setActionError(null);
    setDraft((d) => ({ ...d, [k]: next }));
    try {
      if (next) await grantPermission(role, perm);
      else await revokePermission(role, perm);
    } catch (e) {
      setDraft((d) => {
        const copy = { ...d };
        delete copy[k];
        return copy;
      });
      setActionError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-600" /> Phân quyền theo vai trò
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tích là bật quyền <span className="font-semibold text-foreground">thật</span> ở cả
          database — bỏ tích thì gõ thẳng địa chỉ trang cũng không lấy được dữ liệu.
          Quản lý luôn có mọi quyền nên không nằm trong bảng này.
        </p>
        {!isAdmin && (
          <p className="text-sm font-medium text-gold-700">
            Chỉ tài khoản Quản lý mới sửa được bảng này.
          </p>
        )}
      </CardHeader>
      {matrix.error && <ErrorNote message={matrix.error} />}
      {actionError && <ErrorNote message={actionError} />}
      {matrix.loading ? (
        <LoadingRows rows={6} />
      ) : (
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="scroll-x">
            <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Chức năng
                  </th>
                  {MATRIX_ROLES.map((r) => (
                    <th
                      key={r.value}
                      className="w-28 px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
                    >
                      {r.label}
                      {r.note && (
                        <span className="block text-[10px] font-normal normal-case opacity-70">
                          {r.note}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((g) => (
                  <Fragment key={g.group}>
                    <tr>
                      <td
                        colSpan={MATRIX_ROLES.length + 1}
                        className="bg-secondary/40 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {g.group}
                      </td>
                    </tr>
                    {g.items.map((item) => (
                      <tr key={item.key} className="border-t">
                        <td className="sticky left-0 z-10 border-t bg-card px-2 py-2.5 align-top">
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.hint}</div>
                        </td>
                        {MATRIX_ROLES.map((r) => {
                          const k = cellKey(r.value, item.key);
                          return (
                            <td key={r.value} className="border-t px-2 py-2.5 text-center align-middle">
                              <input
                                type="checkbox"
                                aria-label={`${item.label} — ${r.label}`}
                                className="h-5 w-5 cursor-pointer rounded border-input accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                                checked={checked(r.value, item.key)}
                                disabled={!isAdmin || busy === k}
                                onChange={() => toggle(r.value, item.key)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tổng quan và Thời khóa biểu không có trong bảng: hai trang này chỉ đọc khung lớp /
            buổi học mà mọi mục khác đều cần, nên ai vào được khu quản trị là xem được. Người
            đang đăng nhập phải tải lại trang thì quyền mới đổi mới có hiệu lực trên giao diện.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
