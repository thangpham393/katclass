import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Crown,
  Flame,
  GraduationCap,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import {
  classStudentStats,
  getClass,
  getUser,
  lessons,
  users,
} from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cls = getClass(id);
  if (!cls) notFound();

  const teacher = getUser(cls.teacherId);
  const me = users.find((u) => u.role === "student")!;
  const classLessons = lessons
    .filter((l) => l.classId === cls.id)
    .sort((a, b) => a.unit - b.unit);

  const ranking = classStudentStats
    .filter((s) => s.classId === cls.id)
    .map((s) => {
      const user = getUser(s.userId);
      const homeworkPct = Math.round((s.homeworkDone / s.homeworkTotal) * 100);
      const score = homeworkPct * 0.4 + s.quizAvg * 0.4 + Math.min(s.vocabLearned, 200) * 0.1 + s.streak * 0.5;
      return { ...s, user, homeworkPct, score };
    })
    .sort((a, b) => b.score - a.score);

  const myRank = ranking.findIndex((r) => r.userId === me.id);
  const classAvgHw = Math.round(
    ranking.reduce((sum, r) => sum + r.homeworkPct, 0) / Math.max(ranking.length, 1),
  );
  const classAvgVocab = Math.round(
    ranking.reduce((sum, r) => sum + r.vocabLearned, 0) / Math.max(ranking.length, 1),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/student/classes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Lớp của tôi
      </Link>

      {/* Class hero */}
      <Card className="overflow-hidden">
        <div className="relative h-56">
          <img src={cls.cover} alt={cls.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6 text-white">
            <Badge variant="gold" className="mb-2">{cls.level}</Badge>
            <h1 className="text-3xl font-extrabold tracking-tight">{cls.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">{cls.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {cls.schedule}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {cls.studentIds.length} học viên
              </span>
              {teacher && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> GV: {teacher.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Trophy}
          accent="gold"
          label="Hạng của tôi"
          value={myRank >= 0 ? `#${myRank + 1} / ${ranking.length}` : "—"}
        />
        <StatCard
          icon={BookOpen}
          accent="brand"
          label="Tiến độ khóa"
          value={`${cls.progress}%`}
        />
        <StatCard
          icon={Flame}
          accent="jade"
          label="HW trung bình lớp"
          value={`${classAvgHw}%`}
        />
        <StatCard
          icon={Medal}
          accent="sky"
          label="Từ vựng TB / học viên"
          value={classAvgVocab}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Lessons */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold">Bài học ({classLessons.length})</h2>
            <span className="text-xs text-muted-foreground">Nhấn để ôn tập</span>
          </div>
          <div className="space-y-3">
            {classLessons.map((l) => (
              <Link key={l.id} href={`/student/lesson/${l.id}`} className="block">
                <Card className="card-hover">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-soft">
                      <span className="text-lg font-bold">{l.unit}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="zh text-base font-bold text-brand-700">{l.titleZh}</span>
                        <Badge variant="muted" className="text-[10px]">{formatDate(l.date)}</Badge>
                      </div>
                      <div className="mt-0.5 font-semibold">{l.title}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{l.summary}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {classLessons.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Chưa có bài học nào.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Ranking */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold">Bảng xếp hạng</h2>
            <span className="text-xs text-muted-foreground">Cập nhật hôm nay</span>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {ranking.map((r, i) => {
                const isMe = r.userId === me.id;
                const rankBadge =
                  i === 0
                    ? "bg-gold-100 text-gold-700"
                    : i === 1
                      ? "bg-slate-200 text-slate-700"
                      : i === 2
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-muted-foreground";
                return (
                  <div
                    key={r.userId}
                    className={`flex items-center gap-3 p-3 ${isMe ? "bg-brand-50/60" : ""}`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${rankBadge}`}>
                      {i < 3 ? <Crown className="h-4 w-4" /> : i + 1}
                    </div>
                    <Avatar name={r.user?.name ?? "?"} src={r.user?.avatar} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {r.user?.name ?? "Học viên"}
                        </span>
                        {isMe && (
                          <Badge variant="gold" className="text-[10px]">Bạn</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={r.homeworkPct} className="h-1.5 flex-1" />
                        <span className="w-10 text-right text-[11px] font-semibold text-muted-foreground">
                          {r.homeworkPct}%
                        </span>
                      </div>
                    </div>
                    <div className="hidden text-right text-[11px] text-muted-foreground sm:block">
                      <div>
                        <span className="font-bold text-foreground">{r.vocabLearned}</span> từ
                      </div>
                      <div className="inline-flex items-center gap-0.5">
                        <Flame className="h-3 w-3 text-orange-500" />
                        {r.streak}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cách tính điểm
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Bảng xếp hạng kết hợp tỉ lệ hoàn thành bài tập (40%), điểm quiz trung bình (40%),
                số từ vựng đã học (10%) và chuỗi ngày học liên tiếp (10%).
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
