import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ClipboardList,
  Flame,
  Layers,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import {
  classes,
  decks,
  homeworks,
  lessons,
  users,
  vocab,
} from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function StudentHome() {
  const me = users.find((u) => u.role === "student")!;
  const myClasses = classes.filter((c) => me.classIds?.includes(c.id));
  const myHomeworks = homeworks.filter((h) => me.classIds?.includes(h.classId));
  const upcoming = myHomeworks
    .filter((h) => h.status !== "graded")
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const latestLessons = lessons.filter((l) => me.classIds?.includes(l.classId)).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Hero greeting */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-gold-500 p-8 text-white shadow-soft">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-gold-300/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <Badge variant="gold" className="bg-white/20 text-white border-white/0">
              <Sparkles className="h-3 w-3" /> 你好, {me.name.split(" ").slice(-1)[0]}!
            </Badge>
            <h1 className="mt-3 text-3xl md:text-4xl font-extrabold">
              Sẵn sàng học <span className="zh">中文</span> hôm nay?
            </h1>
            <p className="mt-1 max-w-xl text-white/85">
              Bạn còn <span className="font-bold">{upcoming.length}</span> bài tập đang chờ.
              Học <span className="font-bold">10 phút</span> mỗi ngày để duy trì streak nhé!
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/student/homework">
                <Button variant="gold" className="bg-white text-brand-700 hover:bg-white/90">
                  <ClipboardList className="h-4 w-4" /> Làm bài tập
                </Button>
              </Link>
              <Link href={`/student/flashcard/${decks[0].id}`}>
                <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <Layers className="h-4 w-4" /> Ôn flashcard
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3 min-w-[88px]">
              <div className="text-2xl font-extrabold">🔥 7</div>
              <div className="text-[10px] uppercase tracking-wider text-white/80">Streak</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3">
              <div className="text-2xl font-extrabold">132</div>
              <div className="text-[10px] uppercase tracking-wider text-white/80">Từ đã học</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3">
              <div className="text-2xl font-extrabold">A2</div>
              <div className="text-[10px] uppercase tracking-wider text-white/80">Cấp độ</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Lớp đang học" value={myClasses.length} icon={BookOpen} accent="brand" delta={0} />
        <StatCard label="Bài tập chưa nộp" value={upcoming.length} icon={ClipboardList} accent="gold" delta={-12} />
        <StatCard label="Từ vựng đã biết" value={132} icon={Layers} accent="jade" delta={+8} />
        <StatCard label="Điểm trung bình" value="8.7" icon={Trophy} accent="sky" delta={+5} />
      </section>

      {/* My Classes */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Lớp của tôi</h2>
            <p className="text-sm text-muted-foreground">Tiếp tục bài học gần đây</p>
          </div>
          <Link href="/student/classes" className="text-sm font-semibold text-brand-600 hover:underline">
            Xem tất cả →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myClasses.map((c) => (
            <Card key={c.id} className="card-hover overflow-hidden">
              <div className="relative h-32 overflow-hidden">
                <img src={c.cover} alt={c.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Badge variant="gold" className="absolute left-3 top-3">{c.level}</Badge>
                <div className="absolute bottom-3 left-3 text-white">
                  <div className="text-sm font-bold">{c.name}</div>
                  <div className="text-xs text-white/80">{c.schedule}</div>
                </div>
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Tiến độ khóa học</span>
                  <span className="font-semibold text-foreground">{c.progress}%</span>
                </div>
                <Progress value={c.progress} />
                <Link href={`/student/lesson/${lessons.find((l) => l.classId === c.id)?.id ?? "l-1"}`}>
                  <Button variant="outline" className="w-full">
                    Tiếp tục học <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming homework */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600" /> Bài tập sắp tới
              </CardTitle>
              <Link href="/student/homework" className="text-xs font-semibold text-brand-600 hover:underline">
                Xem tất cả
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              {upcoming.slice(0, 4).map((h) => {
                const cls = classes.find((c) => c.id === h.classId);
                return (
                  <Link
                    key={h.id}
                    href={`/student/homework`}
                    className="flex items-center gap-4 rounded-xl border bg-white p-3 transition-all hover:border-brand-300 hover:shadow-sm"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{h.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{cls?.name}</span>
                        <span>·</span>
                        <Calendar className="h-3 w-3" />
                        <span>Hạn {formatDate(h.dueDate)}</span>
                      </div>
                    </div>
                    <Badge variant={h.status === "in-progress" ? "gold" : "outline"}>
                      {h.status === "in-progress" ? "Đang làm" : "Mới"}
                    </Badge>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Streak / vocab of day */}
        <div className="space-y-6">
          <Card className="overflow-hidden bg-gradient-to-br from-brand-50 to-gold-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
                <Flame className="h-4 w-4" /> Từ vựng hôm nay
              </div>
              <div className="zh mt-3 text-5xl font-bold text-brand-700">{vocab[2].hanzi}</div>
              <div className="mt-1 text-sm text-muted-foreground">{vocab[2].pinyin}</div>
              <div className="mt-1 text-sm">{vocab[2].meaning}</div>
              {vocab[2].example && (
                <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs">
                  <div className="zh font-medium">{vocab[2].example.zh}</div>
                  <div className="text-muted-foreground">{vocab[2].example.pinyin}</div>
                  <div className="mt-1 text-muted-foreground">→ {vocab[2].example.vi}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold-600" /> Huy hiệu
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 p-6 pt-0">
              {["🔥", "📚", "🎯", "🏆", "✨", "🐉"].map((emoji, i) => (
                <div
                  key={i}
                  className="aspect-square grid place-items-center rounded-2xl border bg-gradient-to-br from-gold-50 to-brand-50 text-3xl"
                >
                  {emoji}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Latest lessons */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-tight">Bài học gần đây</h2>
          <Link href="/student/library" className="text-sm font-semibold text-brand-600 hover:underline">
            Thư viện đầy đủ →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {latestLessons.map((l) => (
            <Link key={l.id} href={`/student/lesson/${l.id}`}>
              <Card className="card-hover h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Bài {l.unit}</Badge>
                    <span>{formatDate(l.date)}</span>
                  </div>
                  <div className="zh mt-3 text-3xl font-bold text-brand-700">{l.titleZh}</div>
                  <div className="mt-1 font-semibold">{l.title}</div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{l.slides.length} slide</span>
                    <span>·</span>
                    <span>{l.vocabIds.length} từ mới</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
