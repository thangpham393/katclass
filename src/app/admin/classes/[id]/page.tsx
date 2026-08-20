"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, Pencil, Plus, Sparkles, Trash2, UserMinus, X } from "lucide-react";
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
} from "@/lib/db";
import { fetchTextbooks } from "@/lib/db-library";
import { parseScheduleFromName } from "@/lib/parse-schedule";
import { useLoad } from "@/lib/use-load";

export default function AdminClassDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classId = params.id;

  const cls = useLoad(() => fetchClass(classId), [classId]);
  const students = useLoad(() => fetchClassStudents(classId), [classId]);
  const sessions = useLoad(() => fetchClassSessions(classId), [classId]);
  const textbooks = useLoad(fetchTextbooks);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

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
    setActionError(null);
    try {
      await updateClassStatus(classId, status);
      cls.reload();
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
        <div className="flex items-center gap-4">
          <div className="zh grid h-14 w-14 place-items-center rounded-xl bg-brand-50 text-base font-bold text-brand-700">
            {c.course?.level ? LEVEL_LABELS[c.course.level] ?? c.course.level : "—"}
          </div>
          <div>
            {renaming ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  autoFocus
                  className="h-9 w-64 text-lg font-bold"
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
                <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
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
                className="h-8 w-56 text-xs"
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

      <TeacherScheduleCard cls={c} onSaved={() => { cls.reload(); sessions.reload(); }} />

      <SessionsCard
        cls={c}
        sessions={sessions.data ?? []}
        loading={sessions.loading}
        onChanged={sessions.reload}
      />

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

function TeacherScheduleCard({ cls, onSaved }: { cls: ClassRow; onSaved: () => void }) {
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

      let msg = "Đã lưu lịch tuần. Các buổi đã sinh trước đó không đổi — dùng “Sinh buổi học” cho lịch mới.";
      if (updateSessions) {
        const res = await applyScheduleTeachers(cls.id);
        msg = `Đã lưu lịch tuần. Cập nhật giáo viên cho ${res.updated} buổi sắp tới.`;
        if (res.conflicts.length) {
          msg += ` ${res.conflicts.length} buổi giữ nguyên vì GV trùng giờ dạy: ${res.conflicts.join(", ")}.`;
        }
      }
      setNotice(msg);
      onSaved();
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
      <CardContent className="space-y-5 p-6 pt-0">
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
              className="h-9 w-52 text-xs"
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
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                  <Select
                    className="w-24"
                    value={s.weekday}
                    onChange={(e) => updateDraft(i, { weekday: Number(e.target.value) })}
                  >
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <option key={idx} value={idx}>{label}</option>
                    ))}
                  </Select>
                  <Input
                    type="time"
                    className="w-28"
                    value={s.start_time}
                    onChange={(e) => updateDraft(i, { start_time: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="time"
                    className="w-28"
                    value={s.end_time}
                    onChange={(e) => updateDraft(i, { end_time: e.target.value })}
                    required
                  />
                  <Select
                    className="w-44"
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
                    className="w-36 flex-1"
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
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
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

/* ================= Buổi học ================= */

function SessionsCard({
  cls,
  sessions,
  loading,
  onChanged,
}: {
  cls: ClassRow;
  sessions: SessionRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [weeks, setWeeks] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateSessionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const upcoming = sessions.filter((s) => s.status !== "cancelled" && s.date >= todayISO());
  const visible = showAll ? sessions : upcoming;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const r = await generateSessions(cls.id, weeks);
      setResult(r);
      onChanged();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          Buổi học
          <Badge variant="muted" className="ml-2">{sessions.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
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
          <Button size="sm" disabled={generating} onClick={handleGenerate}>
            <CalendarPlus className="h-3.5 w-3.5" />
            {generating ? "Đang sinh..." : "Sinh buổi học"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {error && <ErrorNote message={error} />}
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
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{showAll ? "Tất cả các buổi" : `Buổi sắp tới (${upcoming.length})`}</span>
              <button className="font-semibold text-brand-600" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Chỉ hiện buổi sắp tới" : "Hiện tất cả"}
              </button>
            </div>
            <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {visible.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
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
