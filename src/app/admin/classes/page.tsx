"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, School, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchClasses,
  fetchCourses,
  fetchRooms,
  fetchProfilesByRole,
  createClass,
  dbErrorMessage,
  formatSchedules,
  WEEKDAY_LABELS,
  CLASS_STATUS_LABELS,
  LEVEL_LABELS,
} from "@/lib/db";
import { fetchTextbooks } from "@/lib/db-library";
import { useLoad } from "@/lib/use-load";

export default function AdminClassesPage() {
  const { data: classes, loading, error, reload } = useLoad(fetchClasses);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = classes ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.teacher?.name.toLowerCase().includes(needle) ||
        c.course?.name.toLowerCase().includes(needle),
    );
  }, [classes, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Lớp & Lịch học</h1>
          <p className="mt-1 text-muted-foreground">
            {loading ? "Đang tải..." : `${classes?.length ?? 0} lớp trong hệ thống.`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Tạo lớp
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên lớp, giáo viên, khóa học..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={School}
          title={q ? "Không tìm thấy lớp nào" : "Chưa có lớp học"}
          description={q ? "Thử từ khóa khác." : "Tạo lớp đầu tiên từ một khóa học có sẵn."}
        />
      ) : (
        <Card>
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <div className="col-span-4">Lớp</div>
            <div className="col-span-3">Lịch tuần</div>
            <div className="col-span-2">Giáo viên</div>
            <div className="col-span-1">Sĩ số</div>
            <div className="col-span-2 text-right">Trạng thái</div>
          </div>
          <div className="divide-y">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/admin/classes/${c.id}`}
                className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand-50/40 md:grid-cols-12"
              >
                <div className="col-span-4 flex items-center gap-3">
                  <div className="zh grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                    {c.course?.level ? (LEVEL_LABELS[c.course.level] ?? c.course.level) : "—"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.course?.name ?? "Chưa gắn khóa"}</div>
                  </div>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground">{formatSchedules(c.class_schedules)}</div>
                <div className="col-span-2 text-sm">{c.teacher?.name ?? <span className="text-muted-foreground">Chưa có</span>}</div>
                <div className="col-span-1 text-sm font-semibold">{c.class_students?.[0]?.count ?? 0}</div>
                <div className="col-span-2 md:text-right">
                  <Badge variant={c.status === "active" ? "jade" : c.status === "planned" ? "gold" : "muted"}>
                    {CLASS_STATUS_LABELS[c.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {creating && (
        <CreateClassModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

interface ScheduleDraft {
  weekday: number;
  start_time: string;
  end_time: string;
  room_id: string;
}

function CreateClassModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const courses = useLoad(fetchCourses);
  const rooms = useLoad(fetchRooms);
  const teachers = useLoad(() => fetchProfilesByRole("teacher"));
  const textbooks = useLoad(fetchTextbooks);

  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [textbookId, setTextbookId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([
    { weekday: 1, start_time: "18:00", end_time: "19:30", room_id: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSchedule(i: number, patch: Partial<ScheduleDraft>) {
    setSchedules((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createClass({
        name: name.trim(),
        course_id: courseId || null,
        textbook_id: textbookId || null,
        teacher_id: teacherId || null,
        status: "planned",
        start_date: startDate || null,
        schedules: schedules.map((s) => ({
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          room_id: s.room_id || null,
        })),
      });
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tạo lớp mới" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên lớp" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HSK1-K12 tối T2-T5" required />
          </Field>
          <Field label="Khóa học" hint={courses.data?.length === 0 ? "Chưa có khóa — tạo ở mục Khóa học trước." : undefined}>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— Chọn khóa —</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.total_sessions} buổi)</option>
              ))}
            </Select>
          </Field>
          <Field label="Giáo viên phụ trách" hint={teachers.data?.length === 0 ? "Gán role giáo viên trong Cài đặt → Phân quyền." : undefined}>
            <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">— Chọn giáo viên —</option>
              {(teachers.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Giáo trình" hint="Lớp học theo giáo trình nào — GV gán bài / giao bài tập sẽ chỉ thấy bài của giáo trình này.">
            <Select value={textbookId} onChange={(e) => setTextbookId(e.target.value)}>
              <option value="">— Chưa gán —</option>
              {(textbooks.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ngày khai giảng">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Lịch học hằng tuần</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSchedules((prev) => [...prev, { weekday: 3, start_time: "18:00", end_time: "19:30", room_id: "" }])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Thêm buổi
            </Button>
          </div>
          <div className="space-y-2">
            {schedules.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                <Select
                  className="w-24"
                  value={s.weekday}
                  onChange={(e) => updateSchedule(i, { weekday: Number(e.target.value) })}
                >
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </Select>
                <Input
                  type="time"
                  className="w-28"
                  value={s.start_time}
                  onChange={(e) => updateSchedule(i, { start_time: e.target.value })}
                  required
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  className="w-28"
                  value={s.end_time}
                  onChange={(e) => updateSchedule(i, { end_time: e.target.value })}
                  required
                />
                <Select
                  className="w-36 flex-1"
                  value={s.room_id}
                  onChange={(e) => updateSchedule(i, { room_id: e.target.value })}
                >
                  <option value="">Phòng (tùy chọn)</option>
                  {(rooms.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
                {schedules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSchedules((prev) => prev.filter((_, idx) => idx !== i))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                    title="Xóa buổi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang tạo..." : "Tạo lớp"}</Button>
        </div>
      </form>
    </Modal>
  );
}
