import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { quizzes } from "@/lib/mock-data";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quiz = quizzes.find((q) => q.id === id);
  if (!quiz) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/student"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
      </Link>
      <div>
        <div className="text-xs uppercase tracking-widest text-brand-600">Quiz</div>
        <h1 className="text-2xl font-extrabold tracking-tight">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">{quiz.description}</p>
      </div>
      <QuizPlayer quiz={quiz} />
    </div>
  );
}
