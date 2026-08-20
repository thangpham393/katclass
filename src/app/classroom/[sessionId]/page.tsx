"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  CheckCheck,
  Dices,
  Flag,
  Maximize2,
  Minimize2,
  Presentation,
  Timer as TimerIcon,
  WifiOff,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { RosterRail } from "@/components/classroom/roster-rail";
import { RandomStage, SlideStage, TimerStage, VocabStage } from "@/components/classroom/stages";
import { WrapUpModal } from "@/components/classroom/wrap-up-modal";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_LABELS,
  WEEKDAY_LABELS,
  dbErrorMessage,
  fetchClassStudents,
  fetchMakeupForSession,
  fetchSession,
  fetchSessionAttendance,
  fetchSessionComments,
  saveAttendance,
  sessionClassLabel,
  type AttendanceStatus,
} from "@/lib/db";
import { fetchLesson, fetchSessionLessons, type LessonDetail } from "@/lib/db-content";
import {
  POINT_REASONS,
  addClassPoints,
  deleteClassPoint,
  fetchSessionPoints,
  flushPoints,
  logActivity,
  queuePoints,
  readQueue,
  unqueuePoint,
  type ClassroomStudent,
  type PointReason,
} from "@/lib/db-classroom";
import { useLoad } from "@/lib/use-load";

type Tool = "slide" | "vocab" | "random" | "timer";

const TOOLS: { key: Tool; label: string; icon: typeof Presentation; hotkey: string }[] = [
  { key: "slide", label: "Trình chiếu", icon: Presentation, hotkey: "1" },
  { key: "vocab", label: "Từ vựng", icon: BookMarked, hotkey: "2" },
  { key: "random", label: "Gọi tên", icon: Dices, hotkey: "3" },
  { key: "timer", label: "Bấm giờ", icon: TimerIcon, hotkey: "4" },
];

/** Một lần cộng điểm ở client: chưa có id server thì giữ tmp_id để hoàn tác/đồng bộ. */
interface LocalPoint {
  key: string;
  id?: string;
  tmp_id?: string;
  student_id: string;
  points: number;
  reason: PointReason;
  created_at: string;
}

const ABSENT: AttendanceStatus[] = ["absent_excused", "absent_unexcused"];

export default function ClassroomPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { user } = useAuth();
  const router = useRouter();

  const session = useLoad(() => fetchSession(sessionId), [sessionId]);
  const classId = session.data?.class_id ?? "";
  const classStudents = useLoad(
    () => (classId ? fetchClassStudents(classId) : Promise.resolve([])),
    [classId],
  );
  const makeups = useLoad(() => fetchMakeupForSession(sessionId), [sessionId]);
  const attendanceRows = useLoad(() => fetchSessionAttendance(sessionId), [sessionId]);
  const pointRows = useLoad(() => fetchSessionPoints(sessionId), [sessionId]);
  const comments = useLoad(() => fetchSessionComments(sessionId), [sessionId]);
  const sessionLessons = useLoad(() => fetchSessionLessons(sessionId), [sessionId]);

  // Bài học gán cho buổi → cần bản đầy đủ để lấy slide + từ vựng
  const lessons = useLoad<LessonDetail[]>(async () => {
    const ids = (sessionLessons.data ?? []).map((r) => r.lesson.id);
    if (!ids.length) return [];
    const rows = await Promise.all(ids.map((id) => fetchLesson(id)));
    return rows.filter(Boolean) as LessonDetail[];
  }, [sessionLessons.data]);

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | undefined>>({});
  const [points, setPoints] = useState<LocalPoint[]>([]);
  const [reason, setReason] = useState<PointReason>("speak");
  const [tool, setTool] = useState<Tool>("slide");
  const [phase, setPhase] = useState<"checkin" | "teach">("checkin");
  const [wrapOpen, setWrapOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* --- Giờ vào lớp: giữ ở localStorage để F5 giữa giờ không mất --- */
  const startKey = `classroom:start:${sessionId}`;
  const [startedAt] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date();
    const saved = window.localStorage.getItem(startKey);
    if (saved) return new Date(saved);
    const d = new Date();
    window.localStorage.setItem(startKey, d.toISOString());
    return d;
  });

  /* --- Danh sách học viên trong buổi (lớp + học bù) --- */
  const students: ClassroomStudent[] = useMemo(() => {
    const list: ClassroomStudent[] = (classStudents.data ?? [])
      .filter((s) => s.status === "active")
      .map((s) => ({ id: s.student_id, name: s.student.name, avatar: s.student.avatar, makeup: false }));
    const ids = new Set(list.map((s) => s.id));
    for (const m of makeups.data ?? []) {
      if (!ids.has(m.student.id)) {
        list.push({ id: m.student.id, name: m.student.name, avatar: m.student.avatar, makeup: true });
      }
    }
    return list;
  }, [classStudents.data, makeups.data]);

  /* --- Nạp điểm danh đã có; đã điểm danh rồi thì vào thẳng chế độ dạy --- */
  useEffect(() => {
    if (!attendanceRows.data) return;
    if (attendanceRows.data.length) {
      const map: Record<string, AttendanceStatus> = {};
      for (const a of attendanceRows.data) map[a.student_id] = a.status;
      setAttendance((prev) => ({ ...map, ...prev }));
      setPhase("teach");
    }
  }, [attendanceRows.data]);

  /* --- Nạp điểm đã lưu + điểm còn kẹt trong hàng chờ offline --- */
  useEffect(() => {
    if (!pointRows.data) return;
    const saved: LocalPoint[] = pointRows.data.map((p) => ({
      key: p.id,
      id: p.id,
      student_id: p.student_id,
      points: p.points,
      reason: p.reason,
      created_at: p.created_at,
    }));
    const pending: LocalPoint[] = readQueue(sessionId).map((p) => ({
      key: p.tmp_id,
      tmp_id: p.tmp_id,
      student_id: p.student_id,
      points: p.points,
      reason: p.reason,
      created_at: p.created_at,
    }));
    setPoints([...saved, ...pending]);
  }, [pointRows.data, sessionId]);

  const pendingCount = points.filter((p) => !p.id).length;

  /* --- Đẩy lại điểm còn kẹt mỗi 20 giây (lớp hay rớt wifi giữa giờ) --- */
  const flush = useCallback(async () => {
    if (!user) return;
    if (!readQueue(sessionId).length) return;
    try {
      const { saved, tmpIds } = await flushPoints(sessionId, user.id);
      if (!saved.length) return;
      setPoints((prev) => {
        const rest = prev.filter((p) => !p.tmp_id || !tmpIds.includes(p.tmp_id));
        return [
          ...rest,
          ...saved.map((p) => ({
            key: p.id,
            id: p.id,
            student_id: p.student_id,
            points: p.points,
            reason: p.reason,
            created_at: p.created_at,
          })),
        ];
      });
    } catch {
      /* vẫn chưa có mạng — thử lại ở lần sau */
    }
  }, [sessionId, user]);

  useEffect(() => {
    const id = window.setInterval(flush, 20000);
    window.addEventListener("online", flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", flush);
    };
  }, [flush]);

  /* --- Đồng hồ buổi học + giữ màn hình không tắt --- */
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  /* --- Phím tắt đổi công cụ (bỏ qua khi đang gõ vào ô nhập) --- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const t = TOOLS.find((x) => x.hotkey === e.key);
      if (t) setTool(t.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* --- Cộng điểm: hiện ngay trên màn, lưu nền, rớt mạng thì xếp hàng chờ --- */
  function give(studentId: string, pts?: number, why?: PointReason) {
    if (!user) return;
    const r = why ?? reason;
    const value = pts ?? POINT_REASONS.find((x) => x.value === r)?.points ?? 1;
    const tmp_id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random()}`;
    const created_at = new Date().toISOString();
    setPoints((prev) => [...prev, { key: tmp_id, tmp_id, student_id: studentId, points: value, reason: r, created_at }]);
    addClassPoints(sessionId, [{ student_id: studentId, points: value, reason: r }], user.id)
      .then(([row]) => {
        if (!row) return;
        setPoints((prev) =>
          prev.map((p) => (p.key === tmp_id ? { ...p, key: row.id, id: row.id, tmp_id: undefined } : p)),
        );
      })
      .catch(() => {
        queuePoints(sessionId, [{ tmp_id, student_id: studentId, points: value, reason: r, created_at }]);
      });
  }

  function undo() {
    const last = points[points.length - 1];
    if (!last) return;
    setPoints((prev) => prev.slice(0, -1));
    if (last.id) deleteClassPoint(last.id).catch(() => pointRows.reload());
    else if (last.tmp_id) unqueuePoint(sessionId, last.tmp_id);
  }

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of points) map[p.student_id] = (map[p.student_id] ?? 0) + p.points;
    return map;
  }, [points]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  async function startTeaching() {
    if (!user) return;
    const records = students
      .filter((s) => attendance[s.id])
      .map((s) => ({ student_id: s.id, status: attendance[s.id]! }));
    if (!records.length) {
      setError("Chọn trạng thái điểm danh cho học viên trước khi bắt đầu.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAttendance(sessionId, records, user.id);
      setPhase("teach");
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    } else {
      rootRef.current?.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    }
  }

  if (session.loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 text-ink-200">Đang mở lớp…</div>
    );
  }
  if (!session.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 p-6 text-center text-ink-200">
        <div>
          <p>Không mở được buổi học này (hoặc bạn không phụ trách buổi).</p>
          <Link href="/teacher" className="mt-3 inline-block font-semibold text-brand-300">
            ← Về trang chủ giáo viên
          </Link>
        </div>
      </div>
    );
  }

  const s = session.data;
  const d = new Date(s.date + "T00:00:00");
  const elapsed = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
  const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(
    Math.floor((elapsed % 3600) / 60),
  ).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  const presentStudents = students.filter((st) => {
    const a = attendance[st.id];
    return !a || !ABSENT.includes(a);
  });
  const vocab = (lessons.data ?? []).flatMap((l) => l.vocab);

  /* ---------- Màn điểm danh đầu giờ ---------- */
  if (phase === "checkin") {
    return (
      <div className="min-h-screen bg-ink-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href={s.class ? `/teacher/classes/${s.class.id}` : "/teacher"}
            className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Thoát
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
            {sessionClassLabel(s)} — điểm danh đầu giờ
          </h1>
          <p className="mt-1 text-ink-300">
            {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")} ·{" "}
            {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
            {s.room ? ` · Phòng ${s.room.name}` : ""} · {students.length} học viên
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const map: Record<string, AttendanceStatus> = {};
                for (const st of students) map[st.id] = st.makeup ? "makeup" : "present";
                setAttendance((prev) => ({ ...prev, ...map }));
              }}
            >
              <CheckCheck className="h-4 w-4" /> Tất cả có mặt
            </Button>
            <Button onClick={startTeaching} disabled={saving || !students.length}>
              {saving ? "Đang lưu…" : "Bắt đầu dạy →"}
            </Button>
          </div>

          {error && <div className="mt-4"><ErrorNote message={error} /></div>}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((st) => {
              const cur = attendance[st.id];
              const absent = cur ? ABSENT.includes(cur) : false;
              return (
                <div
                  key={st.id}
                  className={cn(
                    "rounded-2xl border p-3 transition-colors",
                    !cur
                      ? "border-ink-700 bg-ink-900"
                      : absent
                        ? "border-gold-600/60 bg-gold-600/10"
                        : "border-emerald-600/60 bg-emerald-600/10",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={st.name} src={st.avatar ?? undefined} size={40} className="ring-ink-700" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{st.name}</div>
                      <div className="text-xs text-ink-300">
                        {st.makeup ? "Học bù buổi này" : cur ? ATTENDANCE_LABELS[cur] : "Chưa điểm danh"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["present", "makeup", "absent_excused", "absent_unexcused"] as AttendanceStatus[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setStatus(st.id, v)}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-xs font-semibold",
                          cur === v ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700",
                        )}
                      >
                        {ATTENDANCE_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Màn dạy ---------- */
  return (
    <div ref={rootRef} className="flex h-screen flex-col overflow-hidden bg-ink-950 text-white">
      <header className="flex items-center gap-3 border-b border-ink-800 bg-ink-900 px-4 py-2">
        <Link href="/teacher" className="text-ink-300 hover:text-white" title="Thoát lớp">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{sessionClassLabel(s)}</div>
          <div className="truncate text-[11px] text-ink-300">
            {WEEKDAY_LABELS[d.getDay()]} {d.toLocaleDateString("vi-VN")} · {s.start_time.slice(0, 5)}–
            {s.end_time.slice(0, 5)}
            {s.session_no ? ` · Buổi ${s.session_no}` : ""}
          </div>
        </div>
        <div className="ml-4 rounded-lg bg-ink-800 px-3 py-1 font-mono text-sm tabular-nums text-brand-200">
          {clock}
        </div>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-gold-300">
            <WifiOff className="h-3.5 w-3.5" /> {pendingCount} chờ đồng bộ
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="grid h-9 w-9 place-items-center rounded-lg bg-ink-800 text-ink-100 hover:bg-ink-700"
            title="Toàn màn hình"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <Button variant="gold" onClick={() => setWrapOpen(true)}>
            <Flag className="h-4 w-4" /> Kết thúc buổi
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-4">
            {tool === "slide" && (
              <SlideStage
                lessons={lessons.data ?? []}
                onOpen={(l) =>
                  user &&
                  logActivity({
                    session_id: sessionId,
                    kind: "slide",
                    title: l.unit != null ? `Bài ${l.unit}: ${l.title}` : l.title,
                    ref_id: l.id,
                    created_by: user.id,
                  })
                }
              />
            )}
            {tool === "vocab" && <VocabStage vocab={vocab} />}
            {tool === "random" && (
              <RandomStage students={presentStudents} onAward={(id, pts, why) => give(id, pts, why)} />
            )}
            {tool === "timer" && (
              <TimerStage
                onFinish={(sec) =>
                  user &&
                  logActivity({
                    session_id: sessionId,
                    kind: "timer",
                    title: `Bấm giờ ${sec}s`,
                    payload: { seconds: sec },
                    created_by: user.id,
                  })
                }
              />
            )}
          </div>

          <nav className="flex items-center gap-2 border-t border-ink-800 bg-ink-900 px-4 py-2">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  tool === t.key ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700",
                )}
                title={`Phím tắt ${t.hotkey}`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-ink-400">
              Phím 1–4 để đổi công cụ · chạm học viên bên phải để cộng điểm
            </span>
          </nav>
        </div>

        <RosterRail
          students={students}
          attendance={attendance}
          points={totals}
          reason={reason}
          onReasonChange={setReason}
          onGive={give}
          onUndo={undo}
          canUndo={points.length > 0}
          pendingCount={pendingCount}
        />
      </div>

      {wrapOpen && (
        <WrapUpModal
          session={s}
          students={students}
          attendance={attendance}
          onAttendanceChange={setStatus}
          points={points}
          comments={comments.data ?? []}
          lessons={lessons.data ?? []}
          startedAt={startedAt}
          currentUserId={user?.id ?? ""}
          onClose={() => setWrapOpen(false)}
          onDone={() => {
            window.localStorage.removeItem(startKey);
            router.replace(`/teacher/sessions/${sessionId}`);
          }}
        />
      )}
    </div>
  );
}
