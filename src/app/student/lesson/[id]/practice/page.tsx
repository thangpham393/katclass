import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PracticeHub } from "@/components/practice/practice-hub";
import {
  getClass,
  getLesson,
  getVocabByIds,
  vocab as allVocab,
} from "@/lib/mock-data";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const cls = getClass(lesson.classId);
  const vocab = getVocabByIds(lesson.vocabIds);
  const pool = allVocab.filter((v) => v.level === cls?.level || lesson.vocabIds.includes(v.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/student/classroom/${lesson.classId}`} className="hover:text-foreground">
          {cls?.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/student/lesson/${lesson.id}`} className="hover:text-foreground">
          Bài {lesson.unit}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-foreground">Luyện tập</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="gold">Bài {lesson.unit} · {cls?.level}</Badge>
          <div className="zh mt-2 text-3xl font-bold text-brand-700">{lesson.titleZh}</div>
          <h1 className="text-xl font-bold">{lesson.title}</h1>
        </div>
        <Link
          href={`/student/lesson/${lesson.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quay lại bài giảng
        </Link>
      </div>

      <PracticeHub vocab={vocab} pool={pool} classId={lesson.classId} />
    </div>
  );
}
