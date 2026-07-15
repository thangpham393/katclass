"use client";

import { useState } from "react";
import { DoorOpen, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
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
  { value: "admin", label: "Quản lý" },
];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Cài đặt</h1>
        <p className="mt-1 text-muted-foreground">Phân quyền tài khoản và phòng học.</p>
      </div>

      <RoleManager isAdmin={isAdmin} currentUserId={user?.id} />
      <RoomManager />
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
        <CardContent className="p-5 pt-0">
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
                  className="w-36"
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
      <CardContent className="p-5 pt-0">
        <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-2">
          <Input
            className="w-48"
            placeholder="Tên phòng (P.101...)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="w-32"
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
