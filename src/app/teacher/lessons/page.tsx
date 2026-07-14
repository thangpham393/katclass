import Link from "next/link";
import { ArrowRight, FileText, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { classes, lessons } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function TeacherLessonsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bài giảng</h1>
          <p className="mt-1 text-muted-foreground">Soạn nội dung, upload slide, gắn từ vựng cho từng buổi học.</p>
        </div>
        <Button><Plus className="h-4 w-4" /> Soạn bài mới</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l) => {
          const c = classes.find((cl) => cl.id === l.classId);
          return (
            <Card key={l.id} className="card-hover">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Bài {l.unit}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(l.date)}</span>
                </div>
                <div className="zh mt-3 text-3xl font-bold text-brand-700">{l.titleZh}</div>
                <div className="mt-1 font-semibold">{l.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c?.name}</div>
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{l.summary}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {l.slides.length} slide</span>
                  <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {l.vocabIds.length} từ</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1">Chỉnh sửa</Button>
                  <Link href={`/student/lesson/${l.id}`} className="flex-1">
                    <Button className="w-full">Xem <ArrowRight className="h-3.5 w-3.5" /></Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add-new tile */}
        <Card className="card-hover border-dashed bg-muted/30">
          <CardContent className="flex h-full min-h-[260px] flex-col items-center justify-center p-5 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 text-brand-600">
              <Plus className="h-5 w-5" />
            </div>
            <div className="mt-3 font-semibold">Tạo bài giảng mới</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload slide PPT/PDF, nhập từ vựng, thêm bài tập.
            </p>
            <Button className="mt-4" variant="outline">Bắt đầu soạn</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
