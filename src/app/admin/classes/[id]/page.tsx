"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarClock, CalendarPlus, Check, Pencil, Plus, Sparkles, Trash2, UserMinus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, Field } from "@/components/ui/select";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchClass,
  fetchClassStudents,
  fetchClassSessions,
  fetchProfilesByRole,
  fetchRooms,
  addStudentToClass,
  removeStudentFromClass,
  updateClassInfo,
  updateClassStatus,
  updateClassTeacher,
  updateClassTextbook,
  addClassTeacher,
  removeClassTeacher,
  applyScheduleTeachers,
  classTeachers,
  replaceClassSchedules,
  generateSessions,
  rescheduleClassSessions,
  deleteUnheldSessions,
  deleteClass,
  dbErrorMessage,
  formatSchedules,
  CLASS_STATUS_LABELS,
  SESSION_STATUS_LABELS,
  LEVEL_LABELS,
  WEEKDAY_LABELS,
  todayISO,
  type ClassRow,
  type SessionRow,
  type GenerateSessionsResult,
  type RescheduleRow,
} from "@/lib/db";
import { fmtDate, progressFromSessions } from "@/lib/class-progress";
import { fetchTextbooks } from "@/lib/db-library";
import { parseScheduleFromName } from "@/lib/parse-schedule";
import { useLoad } from "@/lib/use-load";
import { ClassPhotoManager } from "@/components/classes/class-photo-manager";
import type { ClassPhoto } from "@/lib/db-class-photos";

export default function AdminClassDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classId = params.id;
  const [classPhotos, setClassPhotos] = useState<ClassPhoto[]>([]);

  const cls = useLoad(() => fetchClass(classId), [classId]);
  const students = useLoad(() => fetchClassStudents(classId), [classId]);
  const sessions = useLoad(() => fetchClassSessions(classId), [classId]);
  const textbooks = useLoad(fetchTextbooks);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  async function handleRename() {
    const name = nameDraft.trim();
    if (!name) return setActionError("Tên lớp không được để trống.");
    setSavingName(true);
    setActionError(null);
    try {
      await updateClassInfo(classId, { name });
      setRenaming(false);
      cls.reload();
    } catch (e) {
      setActionError(dbErrorMessage(e));
    } finally {
      setSavingName(false);
    }
  }

  async function handleStatusChange(status: ClassRow["status"]) {
    const ending = status === "completed" || status === "cancelled";
    if (
      ending &&
      !confirm("Các buổi chưa diễn ra (chưa chấm công, chưa điểm danh) của lớp sẽ bị xoá khỏi lịch. Tiếp tục?")
    ) return;
    setActionError(null);
    try {
      await updateClassStatus(classId, status);
      cls.reload();
      if (ending) sessions.reload();
    } catch (e) {
      setActionError(dbErrorMessage(e));
    }
  }

  async function handleTextbookChange(textbookId: string | null) {
    setActionError(null);
    try {
      await updateClassTextbook(classId, textbookId);
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
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="zh grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 sm:h-14 sm:w-14 sm:text-base">
            {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
          </div>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  autoFocus
                  className="h-10 w-full text-base font-bold sm:w-64 sm:text-lg"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(false);
                  }}
                />
                <Button size="sm" onClick={handleRename} disabled={savingName}>
                  <Check className="h-3.5 w-3.5" /> {savingName ? "Đang lưu…" : "Lưu"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={savingName}>
                  <X className="h-3.5 w-3.5" /> Hủy
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 text-xl font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
                <button
                  onClick={() => {
                    setNameDraft(c.name);
                    setRenaming(true);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title="Đổi tên lớp"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{c.course?.name ?? "Chưa gắn khóa học"}</span>
              <span className="text-border">·</span>
              <span>{formatSchedules(c.class_schedules)}</span>
              {classTeachers(c).length > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    GV:{" "}
                    <span className="font-medium text-foreground">
                      {classTeachers(c).map((t) => t.name).join(", ")}
                    </span>
                  </span>
                </>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Giáo trình:</span>
              <Select
                wrapClassName="w-full sm:w-auto"
                className="h-9 w-full text-xs sm:h-8 sm:w-56"
                value={c.textbook?.id ?? ""}
                onChange={(e) => handleTextbookChange(e.target.value || null)}
              >
                <option value="">— Chưa gán —</option>
                {(textbooks.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Select
            wrapClassName="w-full sm:w-auto"
            className="w-full sm:w-40"
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

      <ClassPhotoManager classId={classId} students={students.data ?? []} onPhotosChange={setClassPhotos} />
      {actionError && <ErrorNote message={actionError} />}

      <ClassProgressCard cls={c} sessions={sessions.data ?? []} loading={sessions.loading} />

      <TeacherScheduleCard
        cls={c}
        onSaved={() => { cls.reload(); sessions.reload(); }}
        onScheduleSaved={() => {
          // Còn buổi chưa học đã sinh theo lịch cũ → mời áp lịch mới luôn
          const today = todayISO();
          if ((sessions.data ?? []).some((s) => s.status === "scheduled" && s.date >= today)) setRescheduling(true);
        }}
      />

      <SessionsCard
        cls={c}
        sessions={sessions.data ?? []}
        loading={sessions.loading}
        onChanged={sessions.reload}
        onReschedule={() => setRescheduling(true)}
      />

      {rescheduling && (
        <RescheduleModal
          cls={c}
          onClose={() => setRescheduling(false)}
          onApplied={() => { sessions.reload(); }}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
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
          <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
            {(students.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Chưa có học viên. Bấm &ldquo;Thêm học viên&rdquo; để xếp lớp.
              </div>
            ) : (
              <div className="divide-y">
                {students.data!.map((s) => (
                  <div key={s.student_id} className="flex items-center gap-3 py-3">
                    <Avatar name={s.student.name} src={classPhotos.find(p => p.key === s.student_id)?.url ?? s.student.avatar ?? undefined} size={38} />
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

/* ================= Giáo viên & lịch tuần ================= */

interface ScheduleDraft {
  weekday: number;
  start_time: string;
  end_time: string;
  room_id: string;
  teacher_id: string; // "" = theo GV chính của lớp
}

function draftsFromClass(c: ClassRow): ScheduleDraft[] {
  return c.class_schedules
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((s) => ({
      weekday: s.weekday,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      room_id: s.room_id ?? "",
      teacher_id: s.teacher_id ?? "",
    }));
}

function TeacherScheduleCard({
  cls,
  onSaved,
  onScheduleSaved,
}: {
  cls: ClassRow;
  onSaved: () => void;
  /** Gọi sau khi lưu lịch tuần — trang mở hộp áp lịch mới cho các buổi đã sinh. */
  onScheduleSaved: () => void;
}) {
  const teachers = useLoad(() => fetchProfilesByRole("teacher"));
  const rooms = useLoad(fetchRooms);

  const [teacherId, setTeacherId] = useState(cls.teacher?.id ?? "");
  const [updateSessions, setUpdateSessions] = useState(true);
  const [drafts, setDrafts] = useState<ScheduleDraft[]>(() => draftsFromClass(cls));
  const [addTeacherId, setAddTeacherId] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [busyTeam, setBusyTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Đồng bộ lại khi dữ liệu lớp được reload
  useEffect(() => {
    setTeacherId(cls.teacher?.id ?? "");
    setDrafts(draftsFromClass(cls));
    setAddTeacherId("");
  }, [cls]);

  const team = useMemo(() => classTeachers(cls), [cls]);
  const teamIds = useMemo(() => new Set(team.map((t) => t.id)), [team]);
  const others = useMemo(
    () => (teachers.data ?? []).filter((t) => !teamIds.has(t.id)),
    [teachers.data, teamIds],
  );

  const suggestion = useMemo(() => parseScheduleFromName(cls.name), [cls.name]);

  function applySuggestion() {
    if (!suggestion) return;
    setDrafts(
      suggestion.weekdays.map((wd) => ({
        weekday: wd,
        start_time: suggestion.start_time,
        end_time: suggestion.end_time,
        room_id: "",
        teacher_id: "",
      })),
    );
    setNotice("Đã điền lịch gợi ý từ tên lớp — chọn giáo viên cho từng buổi rồi bấm “Lưu lịch tuần”.");
  }

  function updateDraft(i: number, patch: Partial<ScheduleDraft>) {
    setDrafts((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleSaveTeacher() {
    setSavingTeacher(true);
    setError(null);
    setNotice(null);
    try {
      await updateClassTeacher(cls.id, teacherId || null, updateSessions);
      setNotice("Đã cập nhật giáo viên chính.");
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSavingTeacher(false);
    }
  }

  async function handleAddTeacher(id: string) {
    if (!id) return;
    setBusyTeam(true);
    setError(null);
    setNotice(null);
    try {
      await addClassTeacher(cls.id, id);
      setAddTeacherId("");
      setNotice("Đã thêm giáo viên vào lớp — chọn ngày dạy ở lịch tuần bên dưới.");
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusyTeam(false);
    }
  }

  async function handleRemoveTeacher(id: string, name: string) {
    if (!confirm(`Bỏ ${name} khỏi lớp này? Các buổi trong lịch tuần đang gán cho GV sẽ trở về GV chính.`)) return;
    setBusyTeam(true);
    setError(null);
    setNotice(null);
    try {
      await removeClassTeacher(cls.id, id);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusyTeam(false);
    }
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    setError(null);
    setNotice(null);
    try {
      // GV được chọn cho một ngày mà chưa có trong lớp → thêm vào lớp luôn
      const extra = Array.from(
        new Set(drafts.map((s) => s.teacher_id).filter((id) => id && !teamIds.has(id))),
      );
      for (const id of extra) await addClassTeacher(cls.id, id);

      await replaceClassSchedules(
        cls.id,
        drafts.map((s) => ({
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          room_id: s.room_id || null,
          teacher_id: s.teacher_id || null,
        })),
      );

      let msg = "Đã lưu lịch tuần.";
      if (updateSessions) {
        const res = await applyScheduleTeachers(cls.id);
        msg = `Đã lưu lịch tuần. Cập nhật giáo viên cho ${res.updated} buổi sắp tới.`;
        if (res.conflicts.length) {
          msg += ` ${res.conflicts.length} buổi giữ nguyên vì GV trùng giờ dạy: ${res.conflicts.join(", ")}.`;
        }
      }
      setNotice(msg);
      onSaved();
      onScheduleSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Giáo viên & lịch tuần</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
        {error && <ErrorNote message={error} />}
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs">
            <Field label="Giáo viên chính">
              <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">— Chưa có giáo viên —</option>
                {(teachers.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={updateSessions}
              onChange={(e) => setUpdateSessions(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-brand-600"
            />
            Gán luôn cho các buổi sắp tới
          </label>
          <Button
            variant="secondary"
            disabled={savingTeacher || teacherId === (cls.teacher?.id ?? "")}
            onClick={handleSaveTeacher}
          >
            {savingTeacher ? "Đang lưu..." : "Lưu giáo viên"}
          </Button>
        </div>

        {/* Danh sách GV của lớp */}
        <div className="border-t pt-4">
          <div className="mb-2 text-sm font-medium">Giáo viên của lớp</div>
          <div className="flex flex-wrap items-center gap-2">
            {team.length === 0 && (
              <span className="text-sm text-muted-foreground">Chưa có giáo viên nào.</span>
            )}
            {team.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/50 px-3 py-1 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                {t.isMain && <Badge variant="muted">GV chính</Badge>}
                <button
                  type="button"
                  disabled={busyTeam}
                  onClick={() => handleRemoveTeacher(t.id, t.name)}
                  className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                  title="Bỏ khỏi lớp"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Select
              wrapClassName="w-full sm:w-auto"
              className="h-9 w-full text-xs sm:w-52"
              value={addTeacherId}
              disabled={busyTeam || others.length === 0}
              onChange={(e) => {
                setAddTeacherId(e.target.value);
                handleAddTeacher(e.target.value);
              }}
            >
              <option value="">+ Thêm giáo viên…</option>
              {others.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Một lớp có thể có nhiều giáo viên — chọn ai dạy ngày nào ở lịch tuần bên dưới.
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Lịch học hằng tuần</span>
            <div className="flex gap-2">
              {suggestion && (
                <Button type="button" variant="outline" size="sm" onClick={applySuggestion}>
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                  Gợi ý từ tên lớp: {suggestion.weekdays.map((w) => WEEKDAY_LABELS[w]).join(", ")}{" "}
                  {suggestion.start_time}–{suggestion.end_time}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDrafts((prev) => [
                    ...prev,
                    { weekday: 1, start_time: "18:00", end_time: "19:30", room_id: "", teacher_id: "" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Thêm buổi
              </Button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chưa có lịch tuần. {suggestion ? "Dùng nút gợi ý phía trên hoặc thêm thủ công." : "Bấm “Thêm buổi” để nhập."}
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border p-2.5 sm:flex sm:flex-wrap"
                >
                  {/* Mobile: lưới 2 cột (thứ / giờ / GV / phòng) — desktop: một hàng ngang */}
                  <Select
                    wrapClassName="col-span-2 sm:col-auto"
                    className="w-full sm:w-24"
                    value={s.weekday}
                    onChange={(e) => updateDraft(i, { weekday: Number(e.target.value) })}
                  >
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>{label}</option>
                    ))}
                  </Select>
                  <Input
                    type="time"
                    className="w-full sm:w-28"
                    value={s.start_time}
                    onChange={(e) => updateDraft(i, { start_time: e.target.value })}
                    required
                  />
                  <span className="hidden text-muted-foreground sm:inline">→</span>
                  <Input
                    type="time"
                    className="w-full sm:w-28"
                    value={s.end_time}
                    onChange={(e) => updateDraft(i, { end_time: e.target.value })}
                    required
                  />
                  <Select
                    wrapClassName="col-span-2 sm:col-auto"
                    className="w-full sm:w-44"
                    value={s.teacher_id}
                    onChange={(e) => updateDraft(i, { teacher_id: e.target.value })}
                    title="Giáo viên dạy buổi này"
                  >
                    <option value="">GV chính{cls.teacher ? ` (${cls.teacher.name})` : ""}</option>
                    {team.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                    {others.length > 0 && (
                      <optgroup label="Giáo viên khác (sẽ thêm vào lớp)">
                        {others.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                  <Select
                    className="w-full sm:w-36 sm:flex-1"
                    value={s.room_id}
                    onChange={(e) => updateDraft(i, { room_id: e.target.value })}
                  >
                    <option value="">Phòng (tùy chọn)</option>
                    {(rooms.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                    className="grid h-9 w-9 shrink-0 place-items-center justify-self-end rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700 sm:h-8 sm:w-8"
                    title="Xóa buổi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <Button disabled={savingSchedule} onClick={handleSaveSchedule}>
              {savingSchedule ? "Đang lưu..." : "Lưu lịch tuần"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================= Tiến độ lớp ================= */

function ClassProgressCard({
  cls,
  sessions,
  loading,
}: {
  cls: ClassRow;
  sessions: SessionRow[];
  loading: boolean;
}) {
  const p = useMemo(
    () =>
      progressFromSessions(sessions, {
        total: cls.course?.total_sessions,
        classStartDate: cls.start_date,
        schedules: cls.class_schedules,
      }),
    [sessions, cls],
  );
  if (loading) return <Card><LoadingRows rows={2} /></Card>;

  const items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] = [
    {
      label: "Ngày bắt đầu",
      value: fmtDate(p.startDate),
      hint: sessions.some((s) => s.status !== "cancelled") ? "Buổi đầu tiên" : "Theo ngày khai giảng",
    },
    {
      label: p.endProjected ? "Kết thúc dự kiến" : "Ngày kết thúc",
      value: fmtDate(p.endDate),
      hint: p.endProjected
        ? `Đếm tiếp ${p.notGenerated} buổi theo lịch tuần`
        : p.total ? `Buổi thứ ${p.total}` : "Buổi cuối đã sinh",
    },
    {
      label: "Đã học",
      value: (
        <>
          {p.learned}
          {p.total && <span className="text-sm font-semibold text-muted-foreground">/{p.total}</span>}
        </>
      ),
      hint: p.pastPending > 0 ? (
        <span className="text-gold-700">{p.pastPending} buổi đã qua chưa chấm công</span>
      ) : `${p.done} buổi đã chấm công`,
    },
    {
      label: "Còn lại dự kiến",
      value: p.remaining ?? p.upcoming,
      hint: p.total
        ? p.notGenerated > 0
          ? `${p.upcoming} đã xếp lịch · ${p.notGenerated} chưa sinh`
          : `${p.upcoming} buổi đã xếp lịch`
        : "Khóa chưa ghi tổng số buổi — đếm buổi đã sinh",
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.label}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{it.label}</div>
              <div className="mt-1 text-xl font-extrabold">{it.value}</div>
              {it.hint && <div className="mt-0.5 text-xs text-muted-foreground">{it.hint}</div>}
            </div>
          ))}
        </div>
        {p.total && <Progress value={p.learned} max={p.total} />}
      </CardContent>
    </Card>
  );
}

/* ================= Buổi học ================= */

function SessionsCard({
  cls,
  sessions,
  loading,
  onChanged,
  onReschedule,
}: {
  cls: ClassRow;
  sessions: SessionRow[];
  loading: boolean;
  onChanged: () => void;
  onReschedule: () => void;
}) {
  const [weeks, setWeeks] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateSessionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const upcoming = sessions.filter((s) => s.status !== "cancelled" && s.date >= todayISO());
  const visible = showAll ? sessions : upcoming;
  // Buổi chưa học (DB kiểm lại: chưa chấm công, chưa điểm danh mới xoá được)
  const deletable = visible.filter((s) => s.status === "scheduled");
  const progress = useMemo(
    () =>
      progressFromSessions(sessions, {
        total: cls.course?.total_sessions,
        classStartDate: cls.start_date,
        schedules: cls.class_schedules,
      }),
    [sessions, cls],
  );

  // Danh sách thay đổi (reload / đổi bộ lọc) thì bỏ chọn buổi không còn hiện
  useEffect(() => {
    const ids = new Set(deletable.map((s) => s.id));
    setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, showAll]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate(limit?: number) {
    setGenerating(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      // Sinh đủ khóa: đủ số tuần để phủ số buổi còn thiếu (+1 tuần dự phòng ngày trùng)
      const perWeek = Math.max(1, cls.class_schedules.length);
      const w = limit ? Math.min(104, Math.ceil(limit / perWeek) + 1) : weeks;
      const r = await generateSessions(cls.id, w, limit);
      setResult(r);
      onChanged();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!selected.size) return;
    if (!confirm(`Xoá ${selected.size} buổi chưa học đã chọn? Buổi đã chấm công hoặc đã điểm danh sẽ được giữ lại.`)) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const n = await deleteUnheldSessions([...selected]);
      const kept = selected.size - n;
      setNotice(`Đã xoá ${n} buổi.${kept > 0 ? ` Giữ lại ${kept} buổi vì đã chấm công / điểm danh.` : ""}`);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = deletable.length > 0 && deletable.every((s) => selected.has(s.id));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          Buổi học
          <Badge variant="muted" className="ml-2">{sessions.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Sinh buổi cho</span>
          <Input
            type="number"
            min={1}
            max={26}
            className="w-16 text-center"
            value={weeks}
            onChange={(e) => setWeeks(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
          />
          <span className="text-sm text-muted-foreground">tuần tới</span>
          <Button size="sm" disabled={generating} onClick={() => handleGenerate()}>
            <CalendarPlus className="h-3.5 w-3.5" />
            {generating ? "Đang sinh..." : "Sinh buổi học"}
          </Button>
          {progress.notGenerated > 0 && (
            <Button size="sm" variant="secondary" disabled={generating} onClick={() => handleGenerate(progress.notGenerated)}>
              Sinh đủ {progress.notGenerated} buổi còn thiếu
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onReschedule} title="Dời các buổi chưa học theo lịch tuần hiện tại">
            <CalendarClock className="h-3.5 w-3.5" /> Áp lịch tuần mới
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {error && <ErrorNote message={error} />}
        {notice && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        )}
        {result && (
          <div className="mb-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Đã tạo <b>{result.created}</b> buổi mới, bỏ qua {result.skipped} buổi đã tồn tại.
            {result.conflicts.length > 0 && (
              <div className="mt-1 text-gold-800">
                ⚠ {result.conflicts.length} buổi bị trùng lịch phòng/giáo viên, không tạo được:{" "}
                {result.conflicts.join("; ")}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <LoadingRows rows={3} className="p-0" />
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Chưa có buổi học nào. Nhập lịch tuần rồi bấm &ldquo;Sinh buổi học&rdquo;.
          </div>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-brand-600"
                  disabled={deletable.length === 0}
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(deletable.map((s) => s.id)))}
                />
                <span>{showAll ? "Tất cả các buổi" : `Buổi sắp tới (${upcoming.length})`}</span>
              </label>
              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <Button size="sm" variant="outline" disabled={deleting} onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5 text-gold-700" />
                    {deleting ? "Đang xoá..." : `Xoá ${selected.size} buổi`}
                  </Button>
                )}
                <button className="font-semibold text-brand-600" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Chỉ hiện buổi sắp tới" : "Hiện tất cả"}
                </button>
              </div>
            </div>
            <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {visible.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-brand-600 disabled:opacity-30"
                    disabled={s.status !== "scheduled"}
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    title={s.status === "scheduled" ? "Chọn để xoá" : "Buổi đã học / đã hủy không xoá được"}
                  />
                  <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                    {s.session_no ? `Buổi ${s.session_no}` : "—"}
                  </span>
                  <span className="font-medium">
                    {WEEKDAY_LABELS[new Date(s.date + "T00:00:00").getDay()]}{" "}
                    {new Date(s.date + "T00:00:00").toLocaleDateString("vi-VN")}
                  </span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                  {s.room && <span className="text-xs text-muted-foreground">Phòng {s.room.name}</span>}
                  {s.teacher && <span className="text-xs text-muted-foreground">GV {s.teacher.name}</span>}
                  <span className="ml-auto">
                    <Badge variant={s.status === "completed" ? "jade" : s.status === "cancelled" ? "muted" : "gold"}>
                      {SESSION_STATUS_LABELS[s.status]}
                    </Badge>
                  </span>
                </div>
              ))}
              {visible.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Không có buổi sắp tới — bấm &ldquo;Hiện tất cả&rdquo; để xem buổi đã qua.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ================= Áp lịch tuần mới cho buổi đã sinh ================= */

function RescheduleModal({
  cls,
  onClose,
  onApplied,
}: {
  cls: ClassRow;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [from, setFrom] = useState(todayISO());
  const [rows, setRows] = useState<RescheduleRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    rescheduleClassSessions(cls.id, from, false)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && setError(dbErrorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [cls.id, from]);

  const conflicts = (rows ?? []).filter((r) => r.conflict);

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const r = await rescheduleClassSessions(cls.id, from, true);
      setDone(r.length);
      onApplied();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setApplying(false);
    }
  }

  const fmt = (d: string, a: string, b: string) =>
    `${WEEKDAY_LABELS[new Date(d + "T00:00:00").getDay()]} ${fmtDate(d)} ${a.slice(0, 5)}–${b.slice(0, 5)}`;

  return (
    <Modal open onClose={onClose} title="Áp lịch tuần mới cho các buổi đã sinh" className="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Lịch tuần hiện tại: <b className="text-foreground">{formatSchedules(cls.class_schedules)}</b>. Các buổi
          chưa học (chưa chấm công, chưa điểm danh) được dời sang lịch này, giữ nguyên thứ tự buổi — slide, ghi chú
          chuẩn bị và học viên học bù đi theo buổi. Học viên & phụ huynh nhận một thông báo tổng hợp.
        </p>
        {error && <ErrorNote message={error} />}

        {done !== null ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Đã dời {done} buổi theo lịch mới.
          </div>
        ) : (
          <>
            <Field label="Áp dụng từ ngày">
              <Input type="date" className="w-full sm:w-48" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </Field>

            {loading ? (
              <LoadingRows rows={3} className="p-0" />
            ) : !rows || rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Các buổi chưa học đã khớp lịch tuần — không có gì cần đổi.
              </div>
            ) : (
              <>
                {conflicts.length > 0 && (
                  <div className="flex gap-2 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {conflicts.length} buổi trùng giờ giáo viên/phòng với lớp khác — đổi GV/phòng ở lịch tuần
                    hoặc chọn ngày áp dụng khác rồi thử lại.
                  </div>
                )}
                <div className="max-h-80 divide-y overflow-y-auto rounded-lg border scrollbar-thin">
                  {rows.map((r) => (
                    <div key={r.session_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">
                        {r.session_no ? `Buổi ${r.session_no}` : "—"}
                      </span>
                      <span className="text-muted-foreground line-through">{fmt(r.old_date, r.old_start, r.old_end)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{fmt(r.new_date, r.new_start, r.new_end)}</span>
                      {r.conflict && <span className="w-full text-xs text-gold-700">⚠ {r.conflict}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{done !== null ? "Đóng" : "Để nguyên"}</Button>
          {done === null && (
            <Button disabled={loading || applying || !rows?.length || conflicts.length > 0} onClick={handleApply}>
              {applying ? "Đang dời..." : `Dời ${rows?.length ?? 0} buổi`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ================= Thêm học viên ================= */

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
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        (p.student_code ?? "").toLowerCase().includes(needle),
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
            placeholder="Tên, email hoặc mã học viên..."
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
                  <div className="truncate text-xs text-muted-foreground">
                    {p.student_code ? `${p.student_code} · ` : ""}{p.email}
                  </div>
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
