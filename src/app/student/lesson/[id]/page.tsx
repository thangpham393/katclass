import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Languages,
  Layers,
  ListChecks,
  Presentation,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlashcardPlayer } from "@/components/flashcard/flashcard-player";
import { LessonView } from "@/components/lesson/lesson-sidebar";
import { decks, getClass, getLesson, getVocabByIds, homeworks, quizzes } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default async function LessonViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const cls = getClass(lesson.classId);
  const vocab = getVocabByIds(lesson.vocabIds);
  const relatedQuiz = quizzes.find((q) => q.lessonId === lesson.id);
  const relatedDeck = decks.find((d) => d.classId === lesson.classId);

  const classHomeworks = homeworks.filter((h) => h.classId === lesson.classId);
  const translateHomework = classHomeworks.find((h) => h.type === "writing") ?? classHomeworks[0];
  const mixedHomework = classHomeworks.find((h) => h.type === "mixed" || h.type === "quiz") ?? classHomeworks[0];

  const summary = (
    <Card>
      <CardContent className="p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Tóm tắt
        </h3>
        <p className="mt-2 leading-relaxed">{lesson.summary}</p>
      </CardContent>
    </Card>
  );

  const slidesSection = (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Presentation className="h-5 w-5 text-brand-600" /> Slide bài giảng
        </h2>
        <span className="text-xs text-muted-foreground">Nhúng từ Google Slides</span>
      </div>
      <Card className="overflow-hidden">
        <div className="relative aspect-video w-full bg-muted">
          {lesson.slideEmbedUrl ? (
            <iframe
              src={lesson.slideEmbedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={`Slide bài ${lesson.unit}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chưa có slide bài giảng.
            </div>
          )}
        </div>
      </Card>

      {lesson.slides.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {lesson.slides.map((s, i) => (
            <div key={s.id} className="rounded-xl border bg-white p-2 text-xs">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <img src={s.thumb} alt={s.title} className="h-full w-full object-cover" />
                <Badge variant="default" className="absolute left-1.5 top-1.5 bg-white text-brand-700">
                  {i + 1}
                </Badge>
              </div>
              <div className="mt-2 line-clamp-2 font-semibold">{s.title}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const vocabSection = (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <BookOpen className="h-5 w-5 text-brand-600" /> Từ vựng trong bài ({vocab.length})
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {vocab.map((v) => (
          <Card key={v.id} className="card-hover">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="zh text-4xl font-bold text-brand-700">{v.hanzi}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{v.pinyin}</span>
                  <button className="text-muted-foreground hover:text-brand-500">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-sm">{v.meaning}</div>
                {v.example && (
                  <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
                    <div className="zh">{v.example.zh}</div>
                    <div className="text-muted-foreground">{v.example.vi}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );

  const flashcardSection = vocab.length > 0 ? (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-gold-500" /> Ôn tập nhanh bằng Flashcard
        </h2>
        <span className="text-xs text-muted-foreground">{vocab.length} thẻ</span>
      </div>
      <Card>
        <CardContent className="p-6">
          <FlashcardPlayer vocab={vocab} />
        </CardContent>
      </Card>
    </section>
  ) : (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">Chưa có thẻ ôn tập.</CardContent>
    </Card>
  );

  const grammarSection = (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Languages className="h-5 w-5 text-brand-600" /> Ngữ pháp
      </h2>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Cấu trúc 1</div>
            <div className="zh mt-2 text-xl font-bold">Chủ ngữ + 喜欢 + Danh từ / Động từ</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Dùng để diễn tả sự thích thú với một sự vật, sự việc hoặc hành động cụ thể.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="rounded-lg bg-white p-2">
                <span className="zh">我喜欢学习中文。</span>
                <span className="ml-2 text-muted-foreground">→ Tôi thích học tiếng Trung.</span>
              </li>
              <li className="rounded-lg bg-white p-2">
                <span className="zh">他喜欢喝咖啡。</span>
                <span className="ml-2 text-muted-foreground">→ Anh ấy thích uống cà phê.</span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Cấu trúc 2</div>
            <div className="zh mt-2 text-xl font-bold">不 + Động từ / Tính từ</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Phủ định, đứng trước động từ hoặc tính từ. Đặc biệt 不 đổi thanh khi đi với chữ thanh 4.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="rounded-lg bg-white p-2">
                <span className="zh">我不喜欢咖啡。</span>
                <span className="ml-2 text-muted-foreground">→ Tôi không thích cà phê.</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );

  const textSection = (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <BookMarked className="h-5 w-5 text-brand-600" /> Bài khoá
      </h2>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="zh text-2xl leading-relaxed">
              我叫小明，今年二十岁。我喜欢学习中文，也喜欢看中国电影。周末的时候，我和朋友一起去公园散步，或者去咖啡馆喝咖啡。
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pinyin</div>
            <p className="mt-1 text-sm italic text-muted-foreground">
              Wǒ jiào Xiǎomíng, jīnnián èrshí suì. Wǒ xǐhuān xuéxí Zhōngwén, yě xǐhuān kàn Zhōngguó diànyǐng.
              Zhōumò de shíhou, wǒ hé péngyǒu yīqǐ qù gōngyuán sànbù, huòzhě qù kāfēi guǎn hē kāfēi.
            </p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bản dịch</div>
            <p className="mt-1 text-sm leading-relaxed">
              Tôi tên là Tiểu Minh, năm nay 20 tuổi. Tôi thích học tiếng Trung và thích xem phim Trung Quốc.
              Cuối tuần, tôi cùng bạn bè đi dạo công viên, hoặc đến quán cà phê uống cà phê.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/student/classroom/${lesson.classId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Về lớp {cls?.name}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="gold">Bài {lesson.unit} · {cls?.level}</Badge>
          <div className="zh mt-3 text-5xl font-bold text-brand-700">{lesson.titleZh}</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{lesson.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cls?.name} · {formatDate(lesson.date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {relatedDeck && (
            <Link href={`/student/flashcard/${relatedDeck.id}`}>
              <Button variant="outline"><Layers className="h-4 w-4" /> Flashcard đầy đủ</Button>
            </Link>
          )}
          {relatedQuiz && (
            <Link href={`/student/quiz/${relatedQuiz.id}`}>
              <Button><ListChecks className="h-4 w-4" /> Làm quiz</Button>
            </Link>
          )}
        </div>
      </div>

      <LessonView
        lessonId={lesson.id}
        homeworkLinks={{
          translate: translateHomework ? `/student/homework` : "/student/homework",
          mixed: mixedHomework ? `/student/homework` : "/student/homework",
        }}
        summary={summary}
        sections={{
          slides: slidesSection,
          vocab: vocabSection,
          flashcard: flashcardSection,
          grammar: grammarSection,
          text: textSection,
        }}
      />
    </div>
  );
}
