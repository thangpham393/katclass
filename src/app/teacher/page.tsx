import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { classes, homeworks, lessons, users } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function TeacherHome() {
  const me = users.find((u) => u.role === "teacher")!;
  const myClasses = classes.filter((c) => c.teacherId === me.id);
  const studentCount = new Set(myClasses.flatMap((c) => c.studentIds)).size;
  const pendingHomeworks = homeworks.filter((h) => h.status !== "graded");

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Chào cô <span className="text-gradient-brand">{me.name.split(" ").pop()}</span> 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Hôm nay là <span className="font-semibold">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</span>.
            Tiết học tiếp theo bắt đầu lúc <span className="font-semibold">18:30</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/teacher/homework/new"><Button><Plus className="h-4 w-4" /> Giao bài tập</Button></Link>
          <Link href="/teacher/lessons"><Button variant="outline"><BookOpen className="h-4 w-4" /> Soạn bài</Button></Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Lớp đang dạy" value={myClasses.length} icon={GraduationCap} accent="brand" />
        <StatCard label="Tổng học viên" value={studentCount} icon={Users} accent="gold" delta={+8} />
        <StatCard label="Bài tập chờ chấm" value={pendingHomeworks.length} icon={ClipboardList} accent="sky" />
        <StatCard label="Hoàn thành TB" value="84%" icon={TrendingUp} accent="jade" delta={+3} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" /> Lớp dạy hôm nay
              </CardTitle>
              <Link href="/teacher/classes" className="text-xs font-semibold text-brand-600">
                Xem tất cả
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0">
              {myClasses.map((c) => (
                <div key={c.id} className="flex items-center gap-4 rounded-xl border bg-white p-4">
                  <div className="zh grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 text-xl font-bold text-brand-700">
                    {c.level.slice(-1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.schedule} · {c.studentIds.length} học viên</div>
                    <div className="mt-1.5">
                      <Progress value={c.progress} />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/teacher/lessons`}>
                      <Button variant="outline" size="sm">Bài giảng</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand-600" /> Bài tập đã giao
              </CardTitle>
              <Link href="/teacher/homework" className="text-xs font-semibold text-brand-600">
                Tất cả
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
              {homeworks.slice(0, 4).map((h) => {
                const c = classes.find((cl) => cl.id === h.classId);
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-sm">{h.title}</div>
                      <div className="text-xs text-muted-foreground">{c?.name} · Hạn {formatDate(h.dueDate)}</div>
                    </div>
                    <Badge variant={h.status === "graded" ? "jade" : "gold"}>
                      {h.status === "graded" ? "Đã chấm" : "Đang làm"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden bg-gradient-to-br from-brand-500 to-gold-500 text-white">
            <CardContent className="p-6">
              <Sparkles className="h-5 w-5" />
              <h3 className="mt-3 text-xl font-bold">Gợi ý hôm nay</h3>
              <p className="mt-1 text-sm text-white/90">
                Lớp Mai Hoa có 3 học viên vắng homework. Gửi nhắc nhở tự động qua app?
              </p>
              <Button variant="gold" className="mt-4 bg-white text-brand-700 hover:bg-white/90">
                Gửi nhắc nhở <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bài giảng đã soạn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
              {lessons.map((l) => (
                <div key={l.id} className="rounded-lg border bg-white px-3 py-2">
                  <div className="text-sm font-semibold">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{l.slides.length} slide · {l.vocabIds.length} từ</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Học viên nổi bật tuần</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
              {[
                { name: "Nguyễn Minh An", score: 96 },
                { name: "Phạm Lan Hương", score: 92 },
                { name: "Đỗ Thành Nam", score: 88 },
              ].map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <Avatar name={s.name} size={28} />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</div>
                  <Badge variant="jade">{s.score}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
