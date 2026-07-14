import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers,
  ListChecks,
  Mic2,
  Sparkles,
  Star,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="container flex h-16 items-center justify-between">
        <Link href="/"><Logo /></Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="#features" className="text-muted-foreground hover:text-foreground">Tính năng</a>
          <a href="#audience" className="text-muted-foreground hover:text-foreground">Đối tượng</a>
          <a href="#how" className="text-muted-foreground hover:text-foreground">Cách hoạt động</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">Đăng nhập</Button></Link>
          <Link href="/login"><Button size="sm">Bắt đầu học <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
        </div>
      </header>

      {/* HERO */}
      <section className="container relative grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <Badge variant="gold" className="mb-4">
            <Sparkles className="h-3 w-3" /> KAT Education · Tiếng Trung
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Học tiếng Trung{" "}
            <span className="text-gradient-brand">vui hơn</span>,<br />
            ôn tập <span className="zh text-brand-700">高效</span> hơn.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            <strong className="text-foreground">KAT CLASS</strong> giúp giáo viên giao bài, quản lý lớp;
            học viên ôn lại bài qua slide, flashcard và quiz đa dạng — trắc nghiệm, điền từ,
            gõ pinyin, nghe hiểu, sắp xếp câu.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login"><Button size="lg">Vào học ngay <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">Dành cho Giáo viên</Button></Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center -space-x-2">
              {["1", "2", "3", "4"].map((s) => (
                <img
                  key={s}
                  src={`https://api.dicebear.com/9.x/notionists/svg?seed=${s}`}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-white bg-muted"
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />
              ))}
              <span className="ml-1 font-semibold text-foreground">4.9</span> · 1.2k học viên
            </div>
          </div>
        </div>

        {/* Hero Card mock */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-brand opacity-20 blur-3xl" />
          <div className="relative rounded-3xl border bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Flashcard · HSK2
                </div>
                <div className="mt-1 text-sm font-semibold">Bài 5 — Sở thích</div>
              </div>
              <Badge variant="default">3 / 12</Badge>
            </div>
            <div className="my-6 grid place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-gold-50 p-10">
              <div className="text-xs font-medium text-muted-foreground">xué xí</div>
              <div className="zh mt-2 text-7xl font-bold text-brand-700">学习</div>
              <div className="mt-2 text-sm text-muted-foreground">Học tập</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm">Khó</Button>
              <Button variant="secondary" size="sm">Bình thường</Button>
              <Button size="sm">Dễ</Button>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Mic2 className="h-3.5 w-3.5" /> Phát âm tự động</div>
              <div className="flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5 text-brand-500" /> Spaced Repetition</div>
            </div>
          </div>

          <div className="absolute -left-6 -bottom-6 hidden w-56 rotate-[-4deg] rounded-2xl border bg-white p-4 shadow-soft md:block">
            <div className="text-xs font-semibold text-muted-foreground">Streak hôm nay</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-brand-700">🔥 7</span>
              <span className="text-xs text-muted-foreground">ngày liên tục</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-brand-500 to-gold-400" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container py-16">
        <div className="text-center mb-12">
          <Badge>Tính năng</Badge>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            Mọi thứ KAT cần — <span className="text-gradient-brand">trong một nơi</span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border bg-white p-6 card-hover">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-gold-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AUDIENCE */}
      <section id="audience" className="container py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {audiences.map((a) => (
            <Link href={a.href} key={a.title} className="group relative overflow-hidden rounded-3xl border bg-white p-8 card-hover">
              <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${a.gradient} opacity-40 transition-transform group-hover:scale-110`} />
              <a.icon className="relative h-7 w-7 text-brand-700" />
              <h3 className="relative mt-3 text-xl font-bold">{a.title}</h3>
              <p className="relative mt-1 text-sm text-muted-foreground">{a.desc}</p>
              <div className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                Xem demo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="container border-t py-8 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>© 2026 KAT Education — Tiếng Trung · Du học · Kỹ năng.</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">Điều khoản</a>
            <a href="#" className="hover:text-foreground">Bảo mật</a>
            <a href="#" className="hover:text-foreground">Liên hệ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: BookOpen, title: "Slide bài giảng", desc: "Ôn lại nội dung lớp học bất kỳ lúc nào — slide có chú thích & audio." },
  { icon: Layers, title: "Flashcard SRS", desc: "Thuật toán Spaced Repetition giúp ghi nhớ Hán tự lâu dài, ôn đúng lúc." },
  { icon: ListChecks, title: "Quiz đa dạng", desc: "Trắc nghiệm, điền từ, gõ pinyin, nghe chọn nghĩa, sắp xếp câu, ghép cặp." },
  { icon: Mic2, title: "Phát âm chuẩn", desc: "Audio TTS cho mọi từ vựng — luyện nghe & phát âm cùng học viên." },
  { icon: Wand2, title: "Tự động chấm", desc: "Giáo viên không tốn thời gian chấm bài về nhà — kết quả tức thì." },
  { icon: Sparkles, title: "Streak & Huy hiệu", desc: "Tạo động lực học mỗi ngày bằng gamification phù hợp Gen-Z." },
];

const audiences = [
  { icon: GraduationCap, title: "Học viên", desc: "Học, ôn, làm bài tập với giao diện tươi sáng, trực quan.", href: "/student", gradient: "from-brand-200 to-brand-50" },
  { icon: BookOpen, title: "Giáo viên", desc: "Soạn bài, giao homework, theo dõi tiến độ từng học viên.", href: "/teacher", gradient: "from-gold-200 to-gold-50" },
  { icon: Users, title: "Quản lý trung tâm", desc: "Quản lý lớp, giáo viên, doanh thu và báo cáo chất lượng.", href: "/admin", gradient: "from-emerald-200 to-emerald-50" },
];
