import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  DollarSign,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { classes } from "@/lib/mock-data";

export default function AdminHome() {
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Tổng quan trung tâm
          </h1>
          <p className="mt-1 text-muted-foreground">
            Theo dõi sức khỏe vận hành — học viên, lớp, doanh thu và chất lượng giảng dạy.
          </p>
        </div>
        <Badge variant="gold" className="text-sm">
          <Sparkles className="h-3.5 w-3.5" /> Tuần 20/2026
        </Badge>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Học viên đang học" value={142} icon={Users} accent="brand" delta={+12} />
        <StatCard label="Giáo viên" value={8} icon={GraduationCap} accent="gold" delta={+1} />
        <StatCard label="Lớp đang mở" value={classes.length} icon={BookOpen} accent="sky" delta={0} />
        <StatCard label="Doanh thu tháng" value="186M" icon={CircleDollarSign} accent="jade" delta={+18} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-600" /> Học viên mới theo tháng
            </CardTitle>
            <Link href="/admin/reports" className="text-xs font-semibold text-brand-600">
              Báo cáo đầy đủ
            </Link>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <MiniChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Doanh thu theo khóa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-0">
            {[
              { name: "HSK 1", value: 54, percent: 29 },
              { name: "HSK 2", value: 78, percent: 42 },
              { name: "HSK 3", value: 38, percent: 20 },
              { name: "HSK 4+", value: 16, percent: 9 },
            ].map((r) => (
              <div key={r.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-muted-foreground">{r.value}M · {r.percent}%</span>
                </div>
                <Progress value={r.percent} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-600" /> Lớp đang mở
            </CardTitle>
            <Link href="/admin/classes" className="text-xs font-semibold text-brand-600">
              Tất cả
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-0">
            {classes.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-xl border bg-white p-4">
                <div className="zh grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 text-base font-bold text-brand-700">
                  {c.level}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.schedule} · GV: Trần Thu Hà</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{c.studentIds.length} / 12</div>
                  <div className="text-[10px] text-muted-foreground">học viên</div>
                </div>
                <Badge variant={c.progress > 70 ? "jade" : c.progress > 40 ? "gold" : "outline"}>
                  {c.progress}% xong
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Giáo viên hàng đầu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-6 pt-0">
            {[
              { name: "Trần Thu Hà", rating: 4.9, classes: 3 },
              { name: "Vũ Quốc Hùng", rating: 4.8, classes: 2 },
              { name: "Lý Thuỳ Linh", rating: 4.7, classes: 2 },
            ].map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <Avatar name={t.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.classes} lớp</div>
                </div>
                <Badge variant="gold">⭐ {t.rating}</Badge>
              </div>
            ))}
            <Link href="/admin/teachers" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MiniChart() {
  const data = [12, 18, 24, 22, 30, 28, 35, 42, 38, 48, 56, 62];
  const max = Math.max(...data);
  const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((v, i) => (
        <div key={i} className="group flex-1 flex flex-col items-center gap-1.5">
          <div className="text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {v}
          </div>
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-gold-400 hover:from-brand-600 transition-all"
            style={{ height: `${(v / max) * 100}%` }}
          />
          <div className="text-[10px] text-muted-foreground">{months[i]}</div>
        </div>
      ))}
    </div>
  );
}
