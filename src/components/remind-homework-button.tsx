"use client";

import { useState } from "react";
import { BellRing, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import { remindHomework } from "@/lib/db-classroom";

/**
 * Nút "Nhắc con làm bài" cho phụ huynh (giáo viên dùng được luôn): gửi thông
 * báo in-app tới học viên. Server chặn nhắc lại trong 6 giờ nên bấm nhiều lần
 * cũng không làm phiền con.
 */
export function RemindHomeworkButton({
  homeworkId,
  studentId,
  className,
}: {
  homeworkId: string;
  studentId: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (state !== "idle") return;
    setState("sending");
    setError(null);
    try {
      await remindHomework(homeworkId, studentId);
      setState("sent");
    } catch (e) {
      setError(dbErrorMessage(e));
      setState("idle");
    }
  }

  return (
    <button
      onClick={send}
      disabled={state !== "idle"}
      title={error ?? "Gửi thông báo nhắc con làm bài"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
        state === "sent"
          ? "bg-emerald-50 text-emerald-700"
          : error
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary text-secondary-foreground hover:bg-brand-100",
        className,
      )}
    >
      {state === "sent" ? <Check className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
      {state === "sent" ? "Đã nhắc" : state === "sending" ? "Đang gửi…" : "Nhắc con làm bài"}
    </button>
  );
}
