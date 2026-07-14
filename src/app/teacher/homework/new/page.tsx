"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Headphones,
  Layers,
  ListChecks,
  PenLine,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { classes, vocab } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const types = [
  { key: "mixed", label: "Tổng hợp", icon: Sparkles, desc: "Flashcard + Quiz" },
  { key: "flashcard", label: "Flashcard", icon: Layers, desc: "Ôn từ vựng" },
  { key: "quiz", label: "Quiz", icon: ListChecks, desc: "Trắc nghiệm" },
  { key: "writing", label: "Viết Hán tự", icon: PenLine, desc: "Luyện viết" },
  { key: "listening", label: "Nghe", icon: Headphones, desc: "Nghe hiểu" },
] as const;

export default function NewHomeworkPage() {
  const [type, setType] = useState<(typeof types)[number]["key"]>("mixed");
  const [classId, setClassId] = useState(classes[0].id);
  const [vocabIds, setVocabIds] = useState<string[]>([]);

  function toggleVocab(id: string) {
    setVocabIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <div className="space-y-6">
      <Link href="/teacher/homework" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Bài tập
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Giao bài tập mới</h1>
        <p className="mt-1 text-muted-foreground">Tạo bài tập về nhà chỉ trong vài bước.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>1. Chọn loại bài tập</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-6 pt-0 md:grid-cols-5">
              {types.map((t) => {
                const Icon = t.icon;
                const active = type === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setType(t.key)}
                    className={cn(
                      "rounded-xl border bg-white p-4 text-left transition-all",
                      active ? "border-brand-500 ring-2 ring-brand-200" : "hover:border-brand-300",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-muted-foreground")} />
                    <div className="mt-3 text-sm font-bold">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>2. Thông tin bài tập</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-6 pt-0">
              <div>
                <label className="text-sm font-medium">Tiêu đề</label>
                <Input placeholder="Ôn từ vựng Bài 6 — Du lịch" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">Mô tả / Hướng dẫn</label>
                <Textarea
                  placeholder="Hoàn thành flashcard, sau đó làm quiz để chốt từ vựng..."
                  className="mt-1.5"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Lớp</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="mt-1.5 flex h-10 w-full rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Hạn nộp</label>
                  <Input type="date" className="mt-1.5" defaultValue="2026-05-26" />
                </div>
              </div>
            </CardContent>
          </Card>

          {(type === "flashcard" || type === "mixed") && (
            <Card>
              <CardHeader>
                <CardTitle>3. Chọn từ vựng ({vocabIds.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="grid gap-2 sm:grid-cols-2">
                  {vocab.map((v) => {
                    const picked = vocabIds.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        onClick={() => toggleVocab(v.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition-all",
                          picked ? "border-brand-500 bg-brand-50/40 ring-2 ring-brand-200" : "hover:border-brand-300",
                        )}
                      >
                        <div className="zh text-2xl font-bold text-brand-700">{v.hanzi}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium">{v.pinyin}</div>
                          <div className="truncate text-xs text-muted-foreground">{v.meaning}</div>
                        </div>
                        <Badge variant="outline">{v.level}</Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 space-y-4 h-fit">
          <Card>
            <CardHeader><CardTitle className="text-base">Tóm tắt</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-6 pt-0 text-sm">
              <Row label="Loại" value={types.find((t) => t.key === type)?.label} />
              <Row label="Lớp" value={classes.find((c) => c.id === classId)?.name} />
              <Row label="Học viên" value={classes.find((c) => c.id === classId)?.studentIds.length} />
              {vocabIds.length > 0 && <Row label="Từ vựng" value={`${vocabIds.length} từ`} />}
              <Row label="Hạn" value="26/05/2026" icon={CalendarDays} />
            </CardContent>
          </Card>

          <Button className="w-full" size="lg">
            <Send className="h-4 w-4" /> Giao bài & Gửi thông báo
          </Button>
          <Button variant="outline" className="w-full">
            <ClipboardList className="h-4 w-4" /> Lưu bản nháp
          </Button>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: any;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-semibold">
        {Icon && <Icon className="h-3.5 w-3.5 text-brand-600" />}
        {value || "—"}
      </span>
    </div>
  );
}
