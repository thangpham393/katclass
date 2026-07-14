import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { GraduationCap, TrendingUp, Users, CircleDollarSign } from "lucide-react";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Báo cáo</h1>
          <p className="mt-1 text-muted-foreground">Quý 2 / 2026 — cập nhật mới nhất hôm nay.</p>
        </div>
        <Button variant="outline"><Download className="h-4 w-4" /> Xuất Excel</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Học viên active" value={138} icon={Users} accent="brand" delta={+9} />
        <StatCard label="Hoàn thành khoá" value="86%" icon={GraduationCap} accent="jade" delta={+3} />
        <StatCard label="Tỉ lệ giữ chân" value="91%" icon={TrendingUp} accent="gold" delta={+2} />
        <StatCard label="Doanh thu Q2" value="486M" icon={CircleDollarSign} accent="sky" delta={+22} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tỷ lệ hoàn thành bài tập theo cấp độ</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            {[
              { name: "HSK 1", v: 94 },
              { name: "HSK 2", v: 88 },
              { name: "HSK 3", v: 76 },
              { name: "HSK 4", v: 68 },
              { name: "HSK 5", v: 60 },
            ].map((r) => (
              <div key={r.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{r.v}%</span>
                </div>
                <Progress value={r.v} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Học viên đăng ký mới (12 tháng)</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="flex h-56 items-end gap-2">
              {[14, 22, 28, 30, 36, 38, 44, 52, 48, 56, 64, 72].map((v, i) => (
                <div key={i} className="flex-1">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-gold-400"
                    style={{ height: `${(v / 72) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
              {["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"].map((m) => (
                <span key={m} className="flex-1 text-center">{m}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo gần đây</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {[
            { name: "Báo cáo tháng 4/2026", date: "01/05/2026", size: "2.3 MB" },
            { name: "Doanh thu Q1/2026", date: "10/04/2026", size: "1.1 MB" },
            { name: "Đánh giá GV Q1/2026", date: "05/04/2026", size: "0.8 MB" },
          ].map((r) => (
            <div key={r.name} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.date} · {r.size}</div>
              </div>
              <Badge variant="outline">PDF</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
