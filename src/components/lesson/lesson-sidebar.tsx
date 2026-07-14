"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Languages,
  Layers,
  ListChecks,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LessonSection = "slides" | "vocab" | "flashcard" | "grammar" | "text";

const SECTION_ITEMS: { id: LessonSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "slides", label: "Slide bài giảng", icon: Presentation },
  { id: "vocab", label: "Từ vựng", icon: BookOpen },
  { id: "flashcard", label: "Flashcard", icon: Layers },
  { id: "grammar", label: "Ngữ pháp", icon: Languages },
  { id: "text", label: "Bài khoá", icon: BookMarked },
];

export function LessonView({
  lessonId,
  homeworkLinks,
  sections,
  summary,
}: {
  lessonId: string;
  homeworkLinks: { translate: string; mixed: string };
  sections: Record<LessonSection, ReactNode>;
  summary?: ReactNode;
}) {
  const [active, setActive] = useState<LessonSection>("slides");
  const [completed, setCompleted] = useState<Record<LessonSection, boolean>>({
    slides: false,
    vocab: false,
    flashcard: false,
    grammar: false,
    text: false,
  });
  const [openHomework, setOpenHomework] = useState(false);

  const currentIdx = SECTION_ITEMS.findIndex((s) => s.id === active);
  const nextItem = SECTION_ITEMS[currentIdx + 1];
  const isLast = currentIdx === SECTION_ITEMS.length - 1;

  function completeAndNext() {
    setCompleted((c) => ({ ...c, [active]: true }));
    if (nextItem) setActive(nextItem.id);
  }

  function completeLast() {
    setCompleted((c) => ({ ...c, [active]: true }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-6">
        {summary}
        {sections[active]}

        {/* Completion CTA */}
        {!isLast ? (
          <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-gold-50">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <CheckCircle2 className="h-4 w-4" /> Đã xem xong phần này?
                </div>
                <h3 className="mt-1 text-lg font-bold">
                  Hoàn thành & chuyển sang {nextItem.label}
                </h3>
              </div>
              <Button size="lg" variant="gold" onClick={completeAndNext}>
                Hoàn thành <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-gold-50">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <CheckCircle2 className="h-4 w-4" /> Đã xem hết bài học?
                </div>
                <h3 className="mt-1 text-lg font-bold">Hoàn thành bài học & làm quiz</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chuyển sang phần luyện tập để củng cố kiến thức.
                </p>
              </div>
              <Link href={`/student/lesson/${lessonId}/practice`} onClick={completeLast}>
                <Button size="lg" variant="gold">
                  Hoàn thành & làm quiz <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="sticky top-4 self-start">
        <div className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nội dung bài học
          </div>
          <nav className="space-y-0.5">
            {SECTION_ITEMS.map((it) => {
              const Icon = it.icon;
              const isActive = active === it.id;
              const isDone = completed[it.id];
              return (
                <button
                  key={it.id}
                  onClick={() => setActive(it.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-brand-500 text-white shadow-soft"
                      : isDone
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {it.label}
                  </span>
                  {isDone && (
                    <CheckCircle2
                      className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-emerald-500")}
                    />
                  )}
                </button>
              );
            })}

            <Link
              href={`/student/lesson/${lessonId}/practice`}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ListChecks className="h-4 w-4" /> Quiz
            </Link>

            <div>
              <button
                onClick={() => setOpenHomework((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Bài tập về nhà
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", openHomework && "rotate-180")}
                />
              </button>
              {openHomework && (
                <div className="mb-1 ml-3 mt-1 space-y-0.5 border-l-2 border-brand-100 pl-3">
                  <Link
                    href={homeworkLinks.translate}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-brand-50 hover:text-brand-700"
                  >
                    <FileText className="h-3.5 w-3.5" /> Bài tập luyện dịch
                  </Link>
                  <Link
                    href={homeworkLinks.mixed}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-brand-50 hover:text-brand-700"
                  >
                    <FileText className="h-3.5 w-3.5" /> Bài tập tổng hợp
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>
    </div>
  );
}
