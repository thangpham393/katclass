import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FlashcardPlayer } from "@/components/flashcard/flashcard-player";
import { decks, getVocabByIds } from "@/lib/mock-data";

export default async function FlashcardPlayerPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) notFound();
  const vocab = getVocabByIds(deck.vocabIds);

  return (
    <div className="space-y-6">
      <Link
        href="/student/flashcard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tất cả bộ thẻ
      </Link>
      <div>
        <div className="text-xs uppercase tracking-widest text-brand-600">Flashcard</div>
        <h1 className="text-2xl font-extrabold tracking-tight">{deck.name}</h1>
        <p className="text-sm text-muted-foreground">{deck.description}</p>
      </div>
      <FlashcardPlayer vocab={vocab} />
    </div>
  );
}
