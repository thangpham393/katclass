"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, MessageSquareText, Star, Timer, UserCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_LABELS,
  dbErrorMessage,
  saveAttendance,
  upsertSessionComment,
  type AttendanceStatus,
  type SessionCommentRow,
  type SessionRow,
} from "@/lib/db";
import { createHomework, fetchQuestions, type LessonDetail } from "@/lib/db-content";
import { saveTeachingLog } from "@/lib/db-tuition";
import {
  countByReason,
  type ClassroomStudent,
  type PointReason,
} from "@/lib/db-classroom";

/** Điểm đã cộng trong giờ (bản đã lưu hoặc bản còn chờ đồng bộ đều dùng được). */
interface PointLite {
  student_id: string;
  points: number;
  reason: PointReason;
}

const STATUSES: AttendanceStatus[] = ["present", "absent_excused", "absent_unexcused", "makeup"];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white",
  absent_excused: "border-gold-600 bg-gold-600 text-white",
  absent_unexcused: "border-destructive bg-destructive text-white",
  makeup: "border-sky-600 bg-sky-600 text-white",
};

const STEPS = [
  { key: "attendance", label: "Điểm danh", icon: UserCheck },
  { key: "review", label: "Đánh giá học viên", icon: MessageSquareText },
  { key: "homework", label: "Bài về nhà", icon: ClipboardList },
  { key: "finish", label: "Chốt buổi & chấm công", icon: Timer },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/** Gợi ý nhận xét từ chính dữ liệu tương tác trong giờ — GV chỉ cần sửa nhẹ. */
function suggestComment(name: string, points: number, reasons: Record<string, number>): string {
  const parts: string[] = [];
  if (reasons.speak) parts.push(`phát biểu ${reasons.speak} lần`);
  if (reasons.correct) parts.push(`trả lời đúng ${reasons.correct} câu`);
  if (reasons.chinese) parts.push("chủ động nói tiếng Trung");
  if (reasons.help) parts.push("giúp đỡ bạn trong lớp");
  if (reasons.game) parts.push("hăng hái tham gia hoạt động");
  if (reasons.behavior) parts.push("còn nói chuyện riêng, cần tập trung hơn");
  if (!parts.length) return points > 0 ? `${name} tham gia tốt trong buổi học hôm nay.` : "";
  const head = points >= 5 ? "Rất tích cực" : points > 0 ? "Tích cực" : "Cần cố gắng thêm";
  return `${head}: ${parts.join(", ")} (${points}★).`;
}

function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Kết thúc buổi trong 4 bước — mọi ô đều đã điền sẵn từ những gì đã diễn ra
 * trong giờ, giáo viên chỉ xác nhận. Mỗi bước lưu ngay khi bấm "Tiếp tục" nên
 * nửa chừng thoát ra vẫn không mất dữ liệu.
 */
export function WrapUpModal({
  session,
  students,
  attendance,
  onAttendanceChange,
  points,
  comments,
  lessons,
  startedAt,
  currentUserId,
  onClose,
  onDone,
}: {
  session: SessionRow;
  students: ClassroomStudent[];
  attendance: Record<string, AttendanceStatus | undefined>;
  onAttendanceChange: (studentId: string, status: AttendanceStatus) => void;
  points: PointLite[];
  comments: SessionCommentRow[];
  lessons: LessonDetail[];
  startedAt: Date;
  currentUserId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<StepKey>("attendance");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* --- bước 2: nhận xét --- */
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of points) map[p.student_id] = (map[p.student_id] ?? 0) + p.points;
    return map;
  }, [points]);

  const [notes, setNotes] = useState<Record<string, { content: string; rating: number | null }>>({});
  useEffect(() => {
    const init: Record<string, { content: string; rating: number | null }> = {};
    for (const s of students) {
      const existing = comments.find((c) => c.student_id === s.id);
      const total = totals[s.id] ?? 0;
      init[s.id] = {
        content: existing?.content ?? suggestComment(s.name, total, countByReason(points, s.id)),
        rating: existing?.rating ?? (total >= 5 ? 5 : total >= 3 ? 4 : total > 0 ? 3 : null),
      };
    }
    setNotes(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length, comments.length]);

  /* --- bước 3: bài về nhà --- */
  const [hwLesson, setHwLesson] = useState<string>(lessons[0]?.id ?? "");
  const [hwTitle, setHwTitle] = useState("");
  const [hwDue, setHwDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(20, 0, 0, 0);
    return localInput(d);
  });
  const [hwCount, setHwCount] = useState<number | null>(null);
  const [hwIds, setHwIds] = useState<string[]>([]);
  const [hwSkip, setHwSkip] = useState(false);
  const [hwCreated, setHwCreated] = useState(false);

  useEffect(() => {
    if (!hwLesson) {
      setHwCount(null);
      setHwIds([]);
      return;
    }
    const l = lessons.find((x) => x.id === hwLesson);
    setHwTitle(`Luyện tập${l?.unit != null ? ` Bài ${l.unit}` : ""}${l ? ` — ${l.title}` : ""}`);
    fetchQuestions({ lessonId: hwLesson })
      .then((qs) => {
        setHwIds(qs.map((q) => q.id));
        setHwCount(qs.length);
      })
      .catch(() => setHwCount(0));
  }, [hwLesson, lessons]);

  /* --- bước 4: chấm công --- */
  const [start, setStart] = useState(() => localInput(startedAt).slice(11));
  const [end, setEnd] = useState(() => localInput(new Date()).slice(11));
  const [content, setContent] = useState(() =>
    lessons.map((l) => [l.unit ? `Bài ${l.unit}` : null, l.title].filter(Boolean).join(": ")).join("; "),
  );
  const [logNote, setLogNote] = useState("");

  async function next() {
    setBusy(true);
    setError(null);
    try {
      if (step === "attendance") {
        const records = students
          .filter((s) => attendance[s.id])
          .map((s) => ({ student_id: s.id, status: attendance[s.id]! }));
        if (!records.length) throw new Error("Chưa điểm danh học viên nào.");
        await saveAttendance(session.id, records, currentUserId);
        setStep("review");
      } else if (step === "review") {
        for (const s of students) {
          const n = notes[s.id];
          if (!n?.content.trim()) continue;
          await upsertSessionComment({
            session_id: session.id,
            student_id: s.id,
            teacher_id: session.teacher?.id ?? currentUserId,
            content: n.content.trim(),
            rating: n.rating,
          });
        }
        setStep("homework");
      } else if (step === "homework") {
        if (!hwSkip && !hwCreated && session.class_id && hwIds.length) {
          await createHomework({
            class_id: session.class_id,
            session_id: session.id,
            title: hwTitle.trim() || "Bài tập về nhà",
            kind: "homework",
            due_at: hwDue ? new Date(hwDue).toISOString() : null,
            question_ids: hwIds,
            created_by: currentUserId,
          });
          setHwCreated(true);
        }
        setStep("finish");
      } else {
        if (!content.trim()) throw new Error("Nhập nội dung bài học đã dạy.");
        if (end <= start) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
        await saveTeachingLog({
          sessionId: session.id,
          teacherId: session.teacher?.id ?? currentUserId,
          actualStart: start,
          actualEnd: end,
          lessonContent: content.trim(),
          note: logNote,
          createdBy: currentUserId,
        });
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error && !("code" in e) ? e.message : dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const idx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border bg-card shadow-soft">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-extrabold">Kết thúc buổi học</h2>
          <div className="mt-3 flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <div
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold",
                    i < idx
                      ? "bg-emerald-100 text-emerald-800"
                      : i === idx
                        ? "bg-brand-600 text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i < idx ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === "attendance" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Xác nhận lại điểm danh (đã tích từ đầu giờ) — sửa được ngay tại đây.
              </p>
              {students.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border p-2">
                  <Avatar name={s.name} src={s.avatar ?? undefined} size={32} />
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</div>
                  <div className="flex gap-1">
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => onAttendanceChange(s.id, st)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                          attendance[s.id] === st
                            ? STATUS_STYLE[st]
                            : "border-input text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {ATTENDANCE_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Nhận xét được gợi ý sẵn từ điểm ★ và hoạt động trong giờ. Học viên và phụ huynh
                sẽ thấy nội dung này.
              </p>
              {students.map((s) => {
                const n = notes[s.id] ?? { content: "", rating: null };
                return (
                  <div key={s.id} className="rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} src={s.avatar ?? undefined} size={28} />
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className="flex items-center gap-0.5 rounded-md bg-gold-50 px-1.5 py-0.5 text-xs font-bold text-gold-700">
                        <Star className="h-3 w-3 fill-gold-500 text-gold-500" />
                        {totals[s.id] ?? 0}
                      </span>
                      <div className="ml-auto flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            onClick={() =>
                              setNotes((p) => ({ ...p, [s.id]: { ...n, rating: n.rating === r ? null : r } }))
                            }
                            className="p-0.5"
                            title={`${r} sao`}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                n.rating && r <= n.rating
                                  ? "fill-gold-500 text-gold-500"
                                  : "text-muted-foreground",
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={n.content}
                      onChange={(e) => setNotes((p) => ({ ...p, [s.id]: { ...n, content: e.target.value } }))}
                      rows={2}
                      placeholder="Bỏ trống nếu không nhận xét học viên này"
                      className="mt-2 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {step === "homework" && (
            <div className="space-y-4">
              {!session.class_id ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Buổi học bù riêng không gắn lớp nên không giao bài tập theo lớp được.
                </div>
              ) : hwCreated ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Đã giao bài tập ✓ — học viên và phụ huynh đã nhận thông báo.
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={hwSkip} onChange={(e) => setHwSkip(e.target.checked)} />
                    Buổi này không giao bài tập
                  </label>
                  {!hwSkip && (
                    <>
                      <div>
                        <div className="mb-1 text-sm font-semibold">Bộ câu hỏi theo bài</div>
                        <div className="flex flex-wrap gap-2">
                          {lessons.length === 0 && (
                            <span className="text-sm text-muted-foreground">
                              Buổi chưa gán bài học nào — giao bài tập ở trang “Giao bài tập”.
                            </span>
                          )}
                          {lessons.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => setHwLesson(l.id)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-sm font-semibold",
                                hwLesson === l.id ? "border-brand-600 bg-brand-50 text-brand-700" : "hover:bg-secondary",
                              )}
                            >
                              {l.unit != null ? `Bài ${l.unit} — ` : ""}
                              {l.title}
                            </button>
                          ))}
                        </div>
                        {hwCount !== null && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            {hwCount > 0
                              ? `Có ${hwCount} câu trong ngân hàng cho bài này — giao cả bộ.`
                              : "Bài này chưa có câu hỏi trong ngân hàng."}
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="mb-1 text-sm font-semibold">Tiêu đề</div>
                          <Input value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} />
                        </div>
                        <div>
                          <div className="mb-1 text-sm font-semibold">Hạn nộp</div>
                          <Input type="datetime-local" value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {step === "finish" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-sm font-semibold">Giờ bắt đầu thực tế</div>
                  <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-semibold">Giờ kết thúc thực tế</div>
                  <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">Nội dung đã dạy</div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold">Ghi chú (tùy chọn)</div>
                <Input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Lớp vào muộn 10 phút…" />
              </div>
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                Bấm “Hoàn tất buổi” là hệ thống chấm công ca dạy, chuyển buổi sang <b>đã hoàn
                thành</b> và gửi báo cáo buổi học cho học viên + phụ huynh.
              </div>
            </div>
          )}

          {error && <div className="mt-4"><ErrorNote message={error} /></div>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Quay lại lớp
          </Button>
          <div className="flex gap-2">
            {idx > 0 && (
              <Button variant="outline" onClick={() => setStep(STEPS[idx - 1].key)} disabled={busy}>
                Bước trước
              </Button>
            )}
            <Button onClick={next} disabled={busy}>
              {busy ? "Đang lưu…" : step === "finish" ? "Hoàn tất buổi" : "Lưu & tiếp tục"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
