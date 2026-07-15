"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, UserMinus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select, Field } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchClass,
  fetchClassStudents,
  fetchProfilesByRole,
  addStudentToClass,
  removeStudentFromClass,
  updateClassStatus,
  deleteClass,
  dbErrorMessage,
  formatSchedules,
  CLASS_STATUS_LABELS,
  LEVEL_LABELS,
  type ClassRow,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

export default function AdminClassDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classId = params.id;

  const cls = useLoad(() => fetchClass(classId), [classId]);
  const students = useLoad(() => fetchClassStudents(classId), [classId]);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusChange(status: ClassRow["status"]) {
    setActionError(null);
    try {
      await updateClassStatus(classId, status);
      cls.reload();
    } catch (e) {
      setActionError(dbErrorMessage(e));
    }
  }

  async function handleRemove(studentId: string, name: string) {
    if (!confirm(`Đưa ${name} ra khỏi lớp?`)) return;
    setActionError(null);
    try {
      await removeStudentFromClass(classId, studentId);
      students.reload();
    } catch (e) {
      setActionError(dbErrorMessage(e));
    }
  }

  async function handleDeleteClass() {
    if (!confirm(`Xóa lớp "${cls.data?.name}"? Toàn bộ lịch và danh sách lớp sẽ bị xóa.`)) return;
    try {
      await deleteClass(classId);
      router.replace("/admin/classes");
    } catch (e) {
      setActionError(dbErrorMessage(e));
    }
  }

  if (cls.loading) return <Card><LoadingRows rows={5} /></Card>;
  if (cls.error) return <ErrorNote message={cls.error} />;
  if (!cls.data) {
    return (
      <div className="space-y-4">
        <ErrorNote message="Không tìm thấy lớp học này." />
        <Link href="/admin/classes" className="text-sm font-semibold text-brand-600">← Quay lại danh sách lớp</Link>
      </div>
    );
  }

  const c = cls.data;
  const memberIds = new Set((students.data ?? []).map((s) => s.student_id));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách lớp
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="zh grid h-14 w-14 place-items-center rounded-xl bg-brand-50 text-base font-bold text-brand-700">
            {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{c.course?.name ?? "Chưa gắn khóa học"}</span>
              <span className="text-border">·</span>
              <span>{formatSchedules(c.class_schedules)}</span>
              {c.teacher && (
                <>
                  <span className="text-border">·</span>
                  <span>GV: <span className="font-medium text-foreground">{c.teacher.name}</span></span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-40"
            value={c.status}
            onChange={(e) => handleStatusChange(e.target.value as ClassRow["status"])}
          >
            {(Object.keys(CLASS_STATUS_LABELS) as ClassRow["status"][]).map((s) => (
              <option key={s} value={s}>{CLASS_STATUS_LABELS[s]}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={handleDeleteClass} title="Xóa lớp">
            <Trash2 className="h-4 w-4 text-gold-700" />
          </Button>
        </div>
      </div>

      {actionError && <ErrorNote message={actionError} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Học viên trong lớp
            <Badge variant="muted" className="ml-2">{students.data?.length ?? 0}</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Thêm học viên
          </Button>
        </CardHeader>
        {students.loading ? (
          <LoadingRows rows={3} />
        ) : (
          <CardContent className="p-5 pt-0">
            {(students.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Chưa có học viên. Bấm &ldquo;Thêm học viên&rdquo; để xếp lớp.
              </div>
            ) : (
              <div className="divide-y">
                {students.data!.map((s) => (
                  <div key={s.student_id} className="flex items-center gap-3 py-3">
                    <Avatar name={s.student.name} src={s.student.avatar ?? undefined} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.student.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.student.email}
                        {s.student.phone ? ` · ${s.student.phone}` : ""}
                      </div>
                    </div>
                    <div className="hidden text-xs text-muted-foreground md:block">
                      Vào lớp {new Date(s.joined_at).toLocaleDateString("vi-VN")}
                    </div>
                    <button
                      onClick={() => handleRemove(s.student_id, s.student.name)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                      title="Đưa ra khỏi lớp"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {adding && (
        <AddStudentModal
          memberIds={memberIds}
          onClose={() => setAdding(false)}
          onAdd={async (studentId) => {
            await addStudentToClass(classId, studentId);
            students.reload();
          }}
        />
      )}
    </div>
  );
}

function AddStudentModal({
  memberIds,
  onClose,
  onAdd,
}: {
  memberIds: Set<string>;
  onClose: () => void;
  onAdd: (studentId: string) => Promise<void>;
}) {
  const all = useLoad(() => fetchProfilesByRole("student"));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const list = (all.data ?? []).filter((p) => !memberIds.has(p.id));
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
    );
  }, [all.data, memberIds, q]);

  async function handleAdd(id: string) {
    setBusy(id);
    setError(null);
    try {
      await onAdd(id);
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Thêm học viên vào lớp">
      <div className="space-y-3">
        {error && <ErrorNote message={error} />}
        <Field label="Tìm học viên">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tên hoặc email..."
            autoFocus
          />
        </Field>
        {all.loading ? (
          <LoadingRows rows={3} className="p-0" />
        ) : candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {q
              ? "Không tìm thấy học viên phù hợp."
              : "Không còn học viên nào chưa vào lớp này. Học viên mới cần đăng nhập vào hệ thống một lần để có hồ sơ."}
          </p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
            {candidates.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <Avatar name={p.name} src={p.avatar ?? undefined} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={() => handleAdd(p.id)}>
                  {busy === p.id ? "..." : "Thêm"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
