"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { dbErrorMessage } from "@/lib/db";

export const MANUAL_NOTE_KEY = "__teacher_note__";

/** Cùng một nguồn xác nhận cho giáo viên, học viên và phụ huynh. */
export function ManualHomeworkChecklist({ homeworkId, studentId, tasks, teacherNote, editable = false }: {
  homeworkId: string;
  studentId: string;
  tasks: string[];
  teacherNote: string;
  editable?: boolean;
}) {
  const hasItems = tasks.length > 0 || Boolean(teacherNote.trim());
  const [received, setReceived] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const version = useRef(0);
  useEffect(() => {
    if (!hasItems || !studentId) return;
    let active = true;
    setReceived([]);
    setLoading(true);
    async function refresh() {
      if (!studentId || savingRef.current || document.visibilityState === "hidden") return;
      const requestVersion = version.current;
      const { data, error: readError } = await getSupabase().from("manual_homework_receipts")
        .select("task, received").eq("homework_id", homeworkId).eq("student_id", studentId);
      if (!active || requestVersion !== version.current) return;
      if (readError) setError(dbErrorMessage(readError));
      else {
        setReceived((data ?? []).filter((r) => r.received).map((r) => r.task));
        setError(null);
      }
      setLoading(false);
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [homeworkId, studentId, hasItems]);

  async function toggle(task: string, checked: boolean) {
    if (savingRef.current) return;
    savingRef.current = true;
    version.current++;
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await getSupabase().rpc("set_manual_homework_receipt", {
        hw_id: homeworkId, sid: studentId, task_name: task, is_received: checked,
      });
      if (saveError) throw saveError;
      setReceived((current) => checked ? [...current.filter((t) => t !== task), task] : current.filter((t) => t !== task));
    } catch (e) { setError(dbErrorMessage(e)); }
    finally { savingRef.current = false; setSaving(false); }
  }

  const items = [...tasks.map((task) => ({ key: task, label: task })),
    ...(teacherNote.trim() ? [{ key: MANUAL_NOTE_KEY, label: "Dặn dò / bài tập khác" }] : [])];
  if (!items.length) return null;
  if (error && !saving) return <p role="alert" className="text-xs text-destructive">{error}</p>;
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">{loading ? "Đang tải xác nhận…" : `Đã nộp ${items.filter((item) => received.includes(item.key)).length}/${items.length} phần`}{saving ? " · Đang lưu…" : ""}</p>
      {items.map((item) => (
        <label key={item.key} className="flex items-center gap-2">
          <input type="checkbox" checked={received.includes(item.key)} disabled={!editable || loading || saving || Boolean(error)}
            onChange={(e) => void toggle(item.key, e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <span>{item.label} · {received.includes(item.key) ? "Đã nộp" : "Chưa nộp"}</span>
        </label>
      ))}
      {editable && <p className="text-muted-foreground">Tích để xác nhận đã nhận bài; tự động lưu.</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
