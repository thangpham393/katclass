"use client";

import { useMemo, useState } from "react";
import { BookMarked, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import {
  fetchCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  dbErrorMessage,
  LEVELS,
  LEVEL_LABELS,
  type CourseRow,
} from "@/lib/db";
import { useLoad } from "@/lib/use-load";

/** Bỏ dấu + chữ thường để gõ "thieu nhi" vẫn ra "Thiếu nhi". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminCoursesPage() {
  const { data: courses, loading, error, reload } = useLoad(fetchCourses);
  const [editing, setEditing] = useState<CourseRow | "new" | null>(null);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");

  // Cấp độ đang có khóa — chỉ hiện những cấp có dùng
  const levels = useMemo(
    () => LEVELS.filter((l) => courses?.some((c) => c.level === l)),
    [courses],
  );

  // Khớp khi khóa chứa ĐỦ các từ khoá (tên, mô tả, cấp độ, số buổi), không cần đúng thứ tự
  const filtered = useMemo(() => {
    const terms = normalize(q).split(" ").filter(Boolean);
    return (courses ?? []).filter((c) => {
      if (level && c.level !== level) return false;
      if (!terms.length) return true;
      const hay = normalize(
        [c.name, c.description ?? "", c.level ? LEVEL_LABELS[c.level] ?? c.level : "", `${c.total_sessions} buoi`].join(" "),
      );
      return terms.every((t) => hay.includes(t));
    });
  }, [courses, q, level]);

  async function handleDelete(c: CourseRow) {
    if (!confirm(`Xóa khóa học "${c.name}"? Lớp thuộc khóa này sẽ mất liên kết.`)) return;
    try {
      await deleteCourse(c.id);
      reload();
    } catch (e) {
      alert(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Khóa học</h1>
          <p className="mt-1 text-muted-foreground">
            Chương trình chuẩn của trung tâm — lớp học được mở ra từ đây.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Tạo khóa học
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      {!loading && (courses?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên khóa, giáo trình, cấp độ..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {levels.length > 1 && (
            <Select value={level} onChange={(e) => setLevel(e.target.value)} wrapClassName="w-full sm:w-44">
              <option value="">Mọi cấp độ</option>
              {levels.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </Select>
          )}
          <span className="text-sm text-muted-foreground">
            {filtered.length}/{courses!.length} khóa
          </span>
        </div>
      )}

      {loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : (courses?.length ?? 0) === 0 ? (
        <Empty
          icon={BookMarked}
          title="Chưa có khóa học nào"
          description='Tạo khóa đầu tiên, ví dụ "HSK 1 cơ bản — 24 buổi", rồi mở lớp từ khóa đó.'
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={Search}
          title="Không tìm thấy khóa học"
          description="Thử từ khoá khác hoặc bỏ lọc cấp độ."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="card-hover p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="zh grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-lg font-bold text-brand-700">
                  课
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Sửa"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-gold-50 hover:text-gold-700"
                    title="Xóa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 font-bold">{c.name}</div>
              <div className="mt-1 flex items-center gap-2">
                {c.level && <Badge variant="default">{LEVEL_LABELS[c.level] ?? c.level}</Badge>}
                <Badge variant="muted">{c.total_sessions} buổi</Badge>
              </div>
              {c.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <CourseModal
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </div>
  );
}

function CourseModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: CourseRow | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const course = isNew ? null : editing;
  const [name, setName] = useState(course?.name ?? "");
  const [level, setLevel] = useState(course?.level ?? "HSK1");
  const [totalSessions, setTotalSessions] = useState(course?.total_sessions ?? 24);
  const [description, setDescription] = useState(course?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), level, total_sessions: totalSessions, description: description.trim() || null };
    try {
      if (isNew) await createCourse(payload);
      else await updateCourse(course!.id, payload);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open={editing !== null} onClose={onClose} title={isNew ? "Tạo khóa học" : "Sửa khóa học"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Tên khóa học" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HSK 1 cơ bản" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cấp độ" required>
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Số buổi chuẩn" required>
            <Input
              type="number"
              min={1}
              value={totalSessions}
              onChange={(e) => setTotalSessions(Number(e.target.value))}
              required
            />
          </Field>
        </div>
        <Field label="Mô tả">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Giáo trình, mục tiêu đầu ra..."
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu..." : isNew ? "Tạo khóa" : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
